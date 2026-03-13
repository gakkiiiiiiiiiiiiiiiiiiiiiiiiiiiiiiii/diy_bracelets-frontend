import { ref, watch, onMounted, onUnmounted, nextTick, type Ref, type ComputedRef } from 'vue';
import * as THREE from 'three';
import type { BraceletBead } from '@/types';
import { API_BASE } from '@/config';

/** 手串圆环：初始半径约等于视口宽度的 1/4，随珠子数量增加而增大 */
const INITIAL_RING_RADIUS = 0.7;
const MAX_RING_RADIUS = 1.2;
const RING_GROWTH_PER_BEAD = 0.056;
const RING_TUBE = 0.018;
const BEAD_SCALE = 0.018;
/** 拖出环半径+该余量外视为删除 */
const DELETE_MARGIN = 0.5;

function getRingRadius(beadCount: number): number {
	return Math.min(INITIAL_RING_RADIUS + beadCount * RING_GROWTH_PER_BEAD, MAX_RING_RADIUS);
}
/** 动画体系：珠子添加 320–400ms，重排 320ms */
const ADD_BEAD_DURATION_MS = 350;
const REFLOW_DURATION_MS = 320;
/** brand-ease 近似：平滑、无 overshoot（缓动函数，平滑动画过渡） */
const easeBrand = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** 旋转惯性衰减系数，停止阈值 */
const INERTIA_DECAY = 0.96;
const INERTIA_STOP = 0.0008;
/** 水晶珠子：降亮度、冷色 tint，避免过曝 */
const CRYSTAL_OPACITY = 0.9;
const CRYSTAL_COLOR = 0xe0dce8;
const RING_COLOR = 0xd5d2d8;
const BEAD_FLOAT_Y = 0.026;

export interface UseBracelet3dOptions {
	onReorder?: (fromIndex: number, toIndex: number) => void;
	onRemove?: (beadId: string) => void;
}

// 珠子网格结构（包含三维对象和珠子id）
interface BeadMesh {
	mesh: THREE.Mesh;
	root: THREE.Group;
	beadId: string;
}

// 新珠子加入时的动画结构
interface AddAnimation {
	mesh: THREE.Object3D;
	startTime: number;
	duration: number;
}

// 珠子重定位时的动画结构
interface PositionAnimation {
	mesh: THREE.Object3D;
	fromX: number;
	fromZ: number;
	toX: number;
	toZ: number;
	startTime: number;
	duration: number;
}

/**
 * useBracelet3d 3D手串渲染与交互hook
 * @param containerRef - 绑定canvas父级元素的ref
 * @param beads - 手串珠子列表
 * @param options - onReorder 拖拽排序回调，onRemove 拖出删除回调
 */
export function useBracelet3d(
	containerRef: Ref<HTMLElement | null>,
	beads: ComputedRef<BraceletBead[]>,
	options?: UseBracelet3dOptions,
) {
	const { onReorder, onRemove } = options ?? {};
	// 仅 Y 轴旋转（手串绕竖直轴转）
	const rotationY = ref(0);
	// 视角：俯视 / 侧面
	const viewMode = ref<'top' | 'side'>('top');
	// 是否正在拖拽
	const isDragging = ref(false);
	// 拖拽起始信息
	const dragStart = ref({ x: 0, y: 0, rotY: 0 });
	// 惯性旋转速度（仅 Y 轴）
	let rotationVelocityY = 0;

	// ThreeJS相关对象
	let scene: THREE.Scene; // 场景
	let camera: THREE.PerspectiveCamera; // 摄像机
	let renderer: THREE.WebGLRenderer; // 渲染器
	let braceletGroup: THREE.Group; // 手串整体Group
	let ringMesh: THREE.Mesh; // 环
	let canvasEl: HTMLCanvasElement | null = null; // canvas引用

	// 珠子 mesh 缓存表，方便查找添加/删除
	const beadMeshMap = new Map<string, BeadMesh>();
	// 新增动画队列
	const addAnimations: AddAnimation[] = [];
	// 位置动画队列（珠子重排）
	const positionAnimations: PositionAnimation[] = [];
	// 动画帧id
	let rafId = 0;
	// 指针是否按下（用于旋转）
	let pointerDown = false;
	// 正在拖拽的珠子 id（用于排序/删除）
	let draggingBeadId: string | null = null;
	let dragBeadFromIndex = 0;
	// 是否已初始化
	let inited = false;
	// 射线与平面（用于拾取与投影）
	const raycaster = new THREE.Raycaster();
	const mouseNDC = new THREE.Vector2();
	const plane = new THREE.Plane();
	const planeNormal = new THREE.Vector3();
	const intersectPoint = new THREE.Vector3();
	// 监听容器尺寸变化
	let resizeObserver: ResizeObserver | null = null;
	// threejs 纹理加载器和缓存
	const textureLoader = new THREE.TextureLoader();
	const textureCache = new Map<string, THREE.Texture>();
	let shadowGradientTexture: THREE.CanvasTexture | null = null;
	let highlightBandTexture: THREE.CanvasTexture | null = null;

	/** 参考图：阴影更贴地、略偏左下，边缘非常柔和 */
	function getShadowGradientTexture(): THREE.CanvasTexture | null {
		if (shadowGradientTexture) return shadowGradientTexture;
		if (typeof document === 'undefined') return null;
		const size = 128;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const cx = size / 2;
		const r = size / 2;
		const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
		gradient.addColorStop(0, 'rgba(66, 62, 72, 0.125)');
		gradient.addColorStop(0.14, 'rgba(62, 58, 68, 0.085)');
		gradient.addColorStop(0.34, 'rgba(56, 52, 62, 0.038)');
		gradient.addColorStop(0.62, 'rgba(48, 44, 54, 0.012)');
		gradient.addColorStop(0.84, 'rgba(40, 36, 46, 0.003)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, size, size);
		shadowGradientTexture = new THREE.CanvasTexture(canvas);
		shadowGradientTexture.needsUpdate = true;
		return shadowGradientTexture;
	}

	/** 参考图：珠体中间有一条横向柔光带 */
	function getHighlightBandTexture(): THREE.CanvasTexture | null {
		if (highlightBandTexture) return highlightBandTexture;
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 64;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, 'rgba(255,255,255,0)');
		gradient.addColorStop(0.2, 'rgba(255,255,255,0.1)');
		gradient.addColorStop(0.5, 'rgba(255,255,255,0.9)');
		gradient.addColorStop(0.8, 'rgba(255,255,255,0.1)');
		gradient.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		highlightBandTexture = new THREE.CanvasTexture(canvas);
		highlightBandTexture.needsUpdate = true;
		return highlightBandTexture;
	}

	/**
	 * 计算第i个珠子的角度
	 * @param i - 当前索引
	 * @param total - 珠子总数
	 */
	function angleForIndex(i: number, total: number) {
		if (total <= 0) return 0;
		// 平均分布在环上，起点为顶部
		return (i / total) * Math.PI * 2 - Math.PI / 2;
	}

	/** 解析纹理 URL：优先用后端 API 基地址拼接；否则 H5 下 / 开头转同源绝对 URL */
	function resolveTextureUrl(url: string): string {
		if (url.startsWith('http')) return url;
		if (API_BASE && url.startsWith('/')) {
			const base = API_BASE.replace(/\/$/, '');
			return base + url;
		}
		if (typeof window !== 'undefined' && url.startsWith('/')) return window.location.origin + url;
		return url;
	}

	/**
	 * 创建单个珠子mesh
	 * @param bead - 珠子数据
	 * @param index - 序号
	 * @param total - 总数
	 */
	function createBeadMesh(bead: BraceletBead, index: number, total: number) {
		const angle = angleForIndex(index, total);
		const ringR = getRingRadius(total);
		const x = ringR * Math.cos(angle);
		const z = ringR * Math.sin(angle);
		const radius = bead.size * BEAD_SCALE;
		const geometry = new THREE.SphereGeometry(radius, 20, 20);
		const imageUrl = bead.image?.trim();
		const hasTexture = !!(imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/')));
		// 水晶质感：透光、折射、柔和高光（参考图：半透、冷色、柔和反光）
		const material = new THREE.MeshPhysicalMaterial({
			color: CRYSTAL_COLOR,
			transparent: true,
			opacity: CRYSTAL_OPACITY,
			roughness: 0.18,
			metalness: 0.0,
			transmission: 0.68,
			thickness: 0.85,
			clearcoat: 1,
			clearcoatRoughness: 0.15,
			reflectivity: 0.7,
			ior: 1.22,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(0, BEAD_FLOAT_Y, 0);
		mesh.userData = { beadId: bead.id };
		// 参考图：阴影贴近珠子、偏左下，中心更轻，边缘更散
		const shadowGroup = new THREE.Group();
		const gradientTex = getShadowGradientTexture();
		const shadowMat = new THREE.MeshBasicMaterial({
			map: gradientTex ?? undefined,
			transparent: true,
			opacity: gradientTex ? 0.92 : 0.06,
			depthWrite: false,
			color: gradientTex ? 0xffffff : 0x3a3644,
		});
		const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.26, 44), shadowMat);
		shadowMesh.rotation.x = -Math.PI / 2;
		shadowMesh.scale.set(1.16, 0.9, 1);
		shadowMesh.position.set(-radius * 0.38, -radius * 1.02, radius * 0.2);
		shadowGroup.add(shadowMesh);
		const highlightGroup = new THREE.Group();
		const highlightBandTex = getHighlightBandTexture();
		const highlightGlow = new THREE.Mesh(
			new THREE.PlaneGeometry(radius * 1.72, radius * 0.36),
			new THREE.MeshBasicMaterial({
				map: highlightBandTex ?? undefined,
				color: 0xffffff,
				transparent: true,
				opacity: highlightBandTex ? 0.34 : 0.14,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			}),
		);
		highlightGlow.rotation.x = -Math.PI / 2;
		highlightGlow.rotation.z = -0.08;
		highlightGlow.position.set(0, BEAD_FLOAT_Y + radius * 0.78, radius * 0.04);
		const highlightCore = new THREE.Mesh(
			new THREE.PlaneGeometry(radius * 1.66, radius * 0.08),
			new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.42,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			}),
		);
		highlightCore.rotation.x = -Math.PI / 2;
		highlightCore.rotation.z = -0.08;
		highlightCore.position.set(0, BEAD_FLOAT_Y + radius * 0.82, radius * 0.045);
		highlightGroup.add(highlightGlow);
		highlightGroup.add(highlightCore);
		const root = new THREE.Group();
		root.position.set(x, 0, z);
		root.add(shadowGroup);
		root.add(highlightGroup);
		root.add(mesh);

		if (hasTexture && imageUrl) {
			const cacheKey = imageUrl;
			const cached = textureCache.get(cacheKey);
			if (cached) {
				const matWithMap = new THREE.MeshPhysicalMaterial({
					map: cached,
					color: CRYSTAL_COLOR,
					transparent: true,
					opacity: CRYSTAL_OPACITY,
					roughness: 0.18,
					metalness: 0.0,
					transmission: 0.68,
					thickness: 0.85,
					clearcoat: 1,
					clearcoatRoughness: 0.15,
					reflectivity: 0.7,
					ior: 1.22,
				});
				(material as THREE.Material).dispose();
				mesh.material = matWithMap;
			} else {
				if (imageUrl.startsWith('http')) textureLoader.setCrossOrigin('anonymous');
				const tryLoad = (url: string, isRetry = false) => {
					const fullUrl = url.startsWith('http') ? url : resolveTextureUrl(url);
					textureLoader.load(
						fullUrl,
						(tex: THREE.Texture) => {
							if (!mesh.parent) return;
							tex.colorSpace = THREE.SRGBColorSpace;
							tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
							tex.needsUpdate = true;
							textureCache.set(cacheKey, tex);
							const matWithMap = new THREE.MeshPhysicalMaterial({
								map: tex,
								color: CRYSTAL_COLOR,
								transparent: true,
								opacity: CRYSTAL_OPACITY,
								roughness: 0.18,
								metalness: 0.0,
								transmission: 0.68,
								thickness: 0.85,
								clearcoat: 1,
								clearcoatRoughness: 0.15,
								reflectivity: 0.7,
								ior: 1.22,
							});
							(material as THREE.Material).dispose();
							mesh.material = matWithMap;
						},
						undefined,
						() => {
							if (isRetry) return;
							const alt = imageUrl.startsWith('/static/')
								? imageUrl.slice(7)
								: imageUrl.startsWith('/')
									? '/static' + imageUrl
									: null;
							if (alt) tryLoad(alt, true);
						},
					);
				};
				tryLoad(imageUrl);
			}
		}
		return { mesh, root };
	}

	/**
	 * 添加/移除/重排珠子入口
	 * @param newBeads - 最新珠子列表
	 * @param oldBeads - 历史珠子列表
	 */
	function updateBeads(newBeads: BraceletBead[], oldBeads: BraceletBead[] = []) {
		if (!braceletGroup) return;
		const oldIds = new Set(oldBeads.map((b) => b.id));
		const newIds = new Set(newBeads.map((b) => b.id));

		// 移除被删掉的mesh
		for (const id of beadMeshMap.keys()) {
			if (!newIds.has(id)) {
				const { root } = beadMeshMap.get(id)!;
				braceletGroup.remove(root);
				root.traverse((child) => {
					const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
					const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
					geometry?.dispose?.();
					if (Array.isArray(material)) material.forEach((m) => m.dispose());
					else material?.dispose?.();
				});
				beadMeshMap.delete(id);
			}
		}

		// 添加或调整移动中的珠子
		const ringR = getRingRadius(newBeads.length);
		newBeads.forEach((bead, index) => {
			const total = newBeads.length;
			const angle = angleForIndex(index, total);
			const x = ringR * Math.cos(angle);
			const z = ringR * Math.sin(angle);

			if (beadMeshMap.has(bead.id)) {
				// 正在被拖拽的珠子不更新位置，由拖拽逻辑控制
				if (bead.id === draggingBeadId) return;
				// 更新已存在珠子的动画和缩放几何体
				const { mesh, root } = beadMeshMap.get(bead.id)!;
				const curX = root.position.x;
				const curZ = root.position.z;
				// 位置有变化时，触发动画平滑过渡
				if (Math.abs(curX - x) > 1e-5 || Math.abs(curZ - z) > 1e-5) {
					positionAnimations.push({
						mesh: root,
						fromX: curX,
						fromZ: curZ,
						toX: x,
						toZ: z,
						startTime: performance.now(),
						duration: REFLOW_DURATION_MS,
					});
				} else {
					root.position.set(x, 0, z);
				}
				// 更新珠子大小（与 createBeadMesh 一致：半径为 bead.size * BEAD_SCALE）
				const radius = bead.size * BEAD_SCALE;
				mesh.scale.setScalar(1);
				mesh.geometry.dispose();
				mesh.geometry = new THREE.SphereGeometry(radius, 20, 20);
				return;
			}

			// 新珠子，先 scale=0
			const { mesh, root } = createBeadMesh(bead, index, total);
			root.scale.set(0, 0, 0);
			braceletGroup.add(root); /* 只加入手串 group，不加入 scene */
			beadMeshMap.set(bead.id, { mesh, root, beadId: bead.id });
			addAnimations.push({
				mesh: root,
				startTime: performance.now(),
				duration: ADD_BEAD_DURATION_MS,
			});
		});
		if (ringMesh) ringMesh.scale.setScalar(ringR);
	}

	/**
	 * 设置渲染尺寸与相机宽高比
	 */
	function setSize(width: number, height: number) {
		if (!renderer || !camera || !canvasEl) return;
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	/** 根据当前视角设置相机位置与朝向 */
	function applyCameraView() {
		if (!camera) return;
		if (viewMode.value === 'top') {
			camera.position.set(0, 4, 0);
			camera.up.set(0, 0, -1);
		} else {
			camera.position.set(0, 0.5, 4);
			camera.up.set(0, 1, 0);
		}
		camera.lookAt(0, 0, 0);
	}

	/** 切换俯视 / 侧面视角 */
	function setViewMode(mode: 'top' | 'side') {
		viewMode.value = mode;
		applyCameraView();
	}

	/** 获取所有珠子 mesh（用于射线检测） */
	function getBeadMeshes(): THREE.Mesh[] {
		return Array.from(beadMeshMap.values()).map((b) => b.mesh);
	}

	/** 将指针坐标转为 NDC [-1,1] */
	function pointerToNDC(clientX: number, clientY: number): THREE.Vector2 {
		if (!canvasEl) return mouseNDC;
		const rect = canvasEl.getBoundingClientRect();
		const x = ((clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((clientY - rect.top) / rect.height) * 2 + 1;
		mouseNDC.set(x, y);
		return mouseNDC;
	}

	/** 将角度（弧度，与 angleForIndex 一致）转为槽位索引 */
	function angleToIndex(angle: number, total: number): number {
		if (total <= 0) return 0;
		let t = (angle + Math.PI / 2) / (2 * Math.PI);
		if (t < 0) t += 1;
		let idx = Math.round(t * total) % total;
		if (idx < 0) idx += total;
		return Math.min(idx, total - 1);
	}

	/** 将指针投影到手串平面（group 局部 XZ），返回 x,z、距中心距离、角度 */
	function projectPointerToRingPlane(
		clientX: number,
		clientY: number,
	): { x: number; z: number; distance: number; angle: number } {
		if (!canvasEl || !camera || !braceletGroup) return { x: 0, z: 0, distance: 0, angle: 0 };
		pointerToNDC(clientX, clientY);
		raycaster.setFromCamera(mouseNDC, camera);
		planeNormal.set(0, 1, 0).applyQuaternion(braceletGroup.quaternion);
		plane.setFromNormalAndCoplanarPoint(planeNormal, braceletGroup.position.clone());
		if (!raycaster.ray.intersectPlane(plane, intersectPoint)) return { x: 0, z: 0, distance: 0, angle: 0 };
		braceletGroup.worldToLocal(intersectPoint);
		const x = intersectPoint.x;
		const z = intersectPoint.z;
		const distance = Math.sqrt(x * x + z * z);
		const angle = Math.atan2(z, x);
		return { x, z, distance, angle };
	}

	/**
	 * 动画主循环
	 */
	function tick(now: number) {
		if (!inited || !scene || !camera || !renderer || !braceletGroup) return;

		// 处理珠子添加动画
		const toRemove: number[] = [];
		addAnimations.forEach((anim, idx) => {
			const elapsed = now - anim.startTime;
			const t = Math.min(1, elapsed / anim.duration);
			const eased = easeBrand(t);
			anim.mesh.scale.setScalar(eased);
			if (t >= 1) toRemove.push(idx);
		});
		// 删除已结束动画
		toRemove.reverse().forEach((idx) => addAnimations.splice(idx, 1));

		// 处理珠子位置重排动画
		const posToRemove: number[] = [];
		positionAnimations.forEach((anim, idx) => {
			const elapsed = now - anim.startTime;
			const t = Math.min(1, elapsed / anim.duration);
			const eased = easeBrand(t);
			anim.mesh.position.x = anim.fromX + (anim.toX - anim.fromX) * eased;
			anim.mesh.position.z = anim.fromZ + (anim.toZ - anim.fromZ) * eased;
			if (t >= 1) posToRemove.push(idx);
		});
		posToRemove.reverse().forEach((idx) => positionAnimations.splice(idx, 1));

		// 松手后仅 Y 轴惯性
		if (!pointerDown && !draggingBeadId) {
			if (Math.abs(rotationVelocityY) > INERTIA_STOP) {
				rotationY.value += rotationVelocityY;
				rotationVelocityY *= INERTIA_DECAY;
			} else {
				rotationVelocityY = 0;
			}
		}

		// 仅 Y 轴旋转
		braceletGroup.rotation.y = rotationY.value;
		braceletGroup.rotation.x = 0;
		// 渲染
		renderer.render(scene, camera);
		// 递归下一帧
		rafId = requestAnimationFrame(tick);
	}

	/**
	 * 鼠标/触摸 按下事件：优先检测是否点中珠子（拖拽排序/删除），否则旋转手串
	 */
	function onPointerDown(e: PointerEvent | Touch) {
		const clientX = (e as { clientX: number }).clientX;
		const clientY = (e as { clientY: number }).clientY;
		const meshes = getBeadMeshes();
		if (meshes.length > 0 && (onReorder || onRemove)) {
			pointerToNDC(clientX, clientY);
			raycaster.setFromCamera(mouseNDC, camera);
			const hits = raycaster.intersectObjects(meshes, false);
			if (hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
				const beadId = (hits[0].object as THREE.Mesh).userData?.beadId as string | undefined;
				if (beadId) {
					draggingBeadId = beadId;
					dragBeadFromIndex = beads.value.findIndex((b) => b.id === beadId);
					if (dragBeadFromIndex < 0) draggingBeadId = null;
					else {
						isDragging.value = true;
						dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
						return;
					}
				}
			}
		}
		pointerDown = true;
		isDragging.value = true;
		dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
	}

	/**
	 * 鼠标/触摸 移动事件
	 */
	function onPointerMove(e: PointerEvent | Touch) {
		const clientX = (e as { clientX: number }).clientX;
		const clientY = (e as { clientY: number }).clientY;
		if (draggingBeadId && braceletGroup) {
			const proj = projectPointerToRingPlane(clientX, clientY);
			const meshEntry = beadMeshMap.get(draggingBeadId);
			if (meshEntry) {
				meshEntry.root.position.set(proj.x, 0, proj.z);
				const deleteRadius = getRingRadius(beads.value.length) + DELETE_MARGIN;
				if (proj.distance <= deleteRadius && onReorder) {
					const total = beads.value.length;
					const toIndex = angleToIndex(proj.angle, total);
					if (toIndex !== dragBeadFromIndex && toIndex >= 0 && toIndex < total) {
						onReorder(dragBeadFromIndex, toIndex);
						dragBeadFromIndex = toIndex;
					}
				}
			}
			return;
		}
		if (!pointerDown) return;
		const dx = clientX - dragStart.value.x;
		dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
		rotationY.value += dx * 0.01;
		rotationVelocityY = dx * 0.008;
	}

	/**
	 * 鼠标/触摸 松开事件：环外视为删除；未删除且未改序时珠子回原位
	 */
	function onPointerUp() {
		if (draggingBeadId) {
			const meshEntry = beadMeshMap.get(draggingBeadId);
			if (meshEntry) {
				const dist = Math.sqrt(meshEntry.root.position.x ** 2 + meshEntry.root.position.z ** 2);
				const deleteRadius = getRingRadius(beads.value.length) + DELETE_MARGIN;
				// 珠子拖到环外即视为删除
				if (dist > deleteRadius && onRemove) {
					onRemove(draggingBeadId);
					draggingBeadId = null;
					pointerDown = false;
					isDragging.value = false;
					return;
				}
			}
			// 未删除：先清空拖拽标记再强制同步，使该珠子参与位置更新并动画回槽位
			draggingBeadId = null;
			if (braceletGroup) updateBeads(beads.value, beads.value);
		}
		pointerDown = false;
		isDragging.value = false;
	}

	/**
	 * 初始化 threejs，创建场景/camera/group/监听事件
	 * @param canvas - 承载渲染的canvas
	 */
	function init(canvas: HTMLCanvasElement) {
		canvasEl = canvas;
		// 获取画布尺寸
		const width = canvas.clientWidth || 400;
		const height = canvas.clientHeight || 400;

		// 创建threejs基本对象
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xebe8f0);

		camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
		applyCameraView();

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;

		// 灯光：整体压暗，避免过曝；主光左上前，补光与轮廓减弱
		const ambient = new THREE.AmbientLight(0xffffff, 0.7);
		scene.add(ambient);
		const key = new THREE.DirectionalLight(0xffffff, 0.65);
		key.position.set(-2.2, 2.8, 2.0);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xebe8f0, 0.28);
		fill.position.set(2.0, 1.2, 1.5);
		scene.add(fill);
		const rim = new THREE.PointLight(0xffffff, 0.25, 8);
		rim.position.set(0, 1.5, 1.0);
		scene.add(rim);

		// 创建手串Group（珠子/环都放到group中场景里只加group）
		braceletGroup = new THREE.Group();
		scene.add(braceletGroup);
		/* 珠子和圆环都只加到手串 group，不往 scene 直接加珠子，保证添加的珠子只在手串上 */

		// 创建圆环 mesh（几何半径 1，用 scale 控制实际半径）
		const ringGeom = new THREE.TorusGeometry(1, RING_TUBE, 16, 64);
		const ringMat = new THREE.MeshPhysicalMaterial({
			color: RING_COLOR,
			transparent: true,
			opacity: 0.88,
			roughness: 0.28,
			metalness: 0.02,
			transmission: 0.32,
			clearcoat: 0.65,
			clearcoatRoughness: 0.18,
		});
		ringMesh = new THREE.Mesh(ringGeom, ringMat);
		ringMesh.rotation.x = -Math.PI / 2;
		ringMesh.scale.setScalar(getRingRadius(beads.value.length));
		braceletGroup.add(ringMesh);

		// 启动初始珠子渲染
		updateBeads(beads.value, []);

		// 禁用用户选择和默认手势，绑定交互事件
		canvas.style.touchAction = 'none';
		canvas.style.userSelect = 'none';
		// 绑定PC端指针事件
		canvas.addEventListener('pointerdown', onPointerDown as EventListener);
		canvas.addEventListener('pointermove', onPointerMove as EventListener);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointerleave', onPointerUp);
		// 绑定移动端touch事件，转发为pointer操作
		canvas.addEventListener(
			'touchstart',
			(e) => {
				e.preventDefault();
				if (e.touches.length) onPointerDown(e.touches[0]);
			},
			{ passive: false },
		);
		canvas.addEventListener(
			'touchmove',
			(e) => {
				e.preventDefault();
				if (e.touches.length) onPointerMove(e.touches[0]);
			},
			{ passive: false },
		);
		canvas.addEventListener('touchend', onPointerUp);
		canvas.addEventListener('touchcancel', onPointerUp);

		// 标记已初始化，启动动画循环
		inited = true;
		rafId = requestAnimationFrame(tick);

		// 监听容器尺寸自动调整画布和相机
		const container = getContainerEl();
		if (container && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				const w = container.clientWidth || canvas.clientWidth || 400;
				const h = container.clientHeight || canvas.clientHeight || 400;
				if (w > 0 && h > 0) {
					canvas.width = w;
					canvas.height = h;
					setSize(w, h);
				}
			});
			resizeObserver.observe(container);
		}
	}

	/**
	 * 销毁three对象与事件，清理显存
	 */
	function dispose() {
		inited = false;
		cancelAnimationFrame(rafId);
		rafId = 0;
		resizeObserver?.disconnect();
		resizeObserver = null;
		// 移除事件绑定
		if (canvasEl) {
			canvasEl.removeEventListener('pointerdown', onPointerDown as EventListener);
			canvasEl.removeEventListener('pointermove', onPointerMove as EventListener);
			canvasEl.removeEventListener('pointerup', onPointerUp);
			canvasEl.removeEventListener('pointerleave', onPointerUp);
		}
		// 释放所有mesh与缓存纹理
		beadMeshMap.forEach(({ root }) => {
			root.traverse((child) => {
				const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
				const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
				geometry?.dispose?.();
				if (Array.isArray(material)) material.forEach((m) => m.dispose());
				else material?.dispose?.();
			});
		});
		beadMeshMap.clear();
		textureCache.forEach((tex) => tex.dispose());
		textureCache.clear();
		shadowGradientTexture?.dispose();
		shadowGradientTexture = null;
		highlightBandTexture?.dispose();
		highlightBandTexture = null;
		addAnimations.length = 0;
		positionAnimations.length = 0;
		// 释放环mesh内存
		ringMesh?.geometry?.dispose();
		(ringMesh?.material as THREE.Material)?.dispose();
		renderer?.dispose();
		canvasEl = null;
	}

	// 监听beads数据变化，重建/重排珠子
	watch(
		beads,
		(newBeads, oldBeads) => {
			if (!inited || !braceletGroup) return;
			updateBeads(newBeads, oldBeads || []);
		},
		{ deep: true },
	);

	/**
	 * 获取绑定容器dom节点（考虑ref或$el用法）
	 */
	function getContainerEl(): HTMLElement | null {
		const refVal = containerRef.value;
		if (!refVal) return null;
		if (refVal instanceof HTMLElement) return refVal;
		const el = (refVal as { $el?: HTMLElement }).$el;
		return el instanceof HTMLElement ? el : null;
	}

	// 组件挂载时初始化threejs渲染
	onMounted(() => {
		nextTick(() => {
			const container = getContainerEl();
			if (!container) return;
			// 创建canvas元素并追加到容器
			const canvas = document.createElement('canvas');
			canvas.style.display = 'block';
			canvas.style.width = '100%';
			canvas.style.height = '100%';
			canvas.style.touchAction = 'none';
			container.appendChild(canvas);
			// 设置尺寸
			const w = container.clientWidth || 400;
			const h = container.clientHeight || 400;
			canvas.width = w;
			canvas.height = h;
			init(canvas);
			// hack：初次渲染尺寸为0，延时重新设定
			if (w === 0 || h === 0) {
				setTimeout(() => {
					const w2 = container.clientWidth || 400;
					const h2 = container.clientHeight || 400;
					if (w2 > 0 && h2 > 0 && canvasEl) {
						canvasEl.width = w2;
						canvasEl.height = h2;
						setSize(w2, h2);
					}
				}, 150);
			}
		});
	});

	// 组件卸载时自动销毁canvas和threejs对象
	onUnmounted(() => {
		const container = getContainerEl();
		if (canvasEl && container && canvasEl.parentNode === container) {
			container.removeChild(canvasEl);
		}
		dispose();
	});

	return {
		rotationY,
		viewMode,
		setViewMode,
		isDragging,
	};
}
