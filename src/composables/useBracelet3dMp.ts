/**
 * 微信小程序端 3D 手串渲染（基于 threejs-miniprogram）
 * 仅在 mp-weixin 平台使用，与 useBracelet3d 逻辑对齐，使用 createScopedThreejs 绑定 canvas
 */
import { ref, watch, onMounted, onUnmounted, nextTick, getCurrentInstance, type ComputedRef } from 'vue';
import { createScopedThreejs } from 'threejs-miniprogram';
import type { BraceletBead } from '@/types';
import { API_BASE } from '@/config';

/** 手串圆环：初始半径约等于视口宽度的 1/4，随珠子数量增加而增大 */
const INITIAL_RING_RADIUS = 0.7;
const MAX_RING_RADIUS = 1.2;
const RING_GROWTH_PER_BEAD = 0.056;
const RING_TUBE = 0.018;
const BEAD_SCALE = 0.018;
const DELETE_MARGIN = 0.5;

function getRingRadius(beadCount: number): number {
	return Math.min(INITIAL_RING_RADIUS + beadCount * RING_GROWTH_PER_BEAD, MAX_RING_RADIUS);
}
const ADD_BEAD_DURATION_MS = 350;
const REFLOW_DURATION_MS = 320;
const easeBrand = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const INERTIA_DECAY = 0.96;
const INERTIA_STOP = 0.0008;
const CRYSTAL_OPACITY = 0.9;
const CRYSTAL_COLOR = 0xe0dce8;
const RING_COLOR = 0xd5d2d8;
const BEAD_FLOAT_Y = 0.026;

interface BeadMesh {
	mesh: any;
	root: any;
	beadId: string;
}

interface AddAnimation {
	mesh: any;
	startTime: number;
	duration: number;
}

interface PositionAnimation {
	mesh: any;
	fromX: number;
	fromZ: number;
	toX: number;
	toZ: number;
	startTime: number;
	duration: number;
}

export interface UseBracelet3dMpOptions {
	onReorder?: (fromIndex: number, toIndex: number) => void;
	onRemove?: (beadId: string) => void;
}

/**
 * 小程序端 3D 手串 hook
 * @param canvasSelector - canvas 的 id 选择器，如 '#bracelet-gl'
 * @param beads - 手串珠子列表
 * @param options - onReorder / onRemove 拖拽排序与拖出删除回调
 */
export function useBracelet3dMp(
	canvasSelector: string,
	beads: ComputedRef<BraceletBead[]>,
	options?: UseBracelet3dMpOptions,
) {
	const { onReorder, onRemove } = options ?? {};
	const rotationY = ref(0);
	const viewMode = ref<'top' | 'side'>('top');
	const isDragging = ref(false);
	const dragStart = ref({ x: 0, y: 0, rotY: 0 });

	let THREE: ReturnType<typeof createScopedThreejs> | null = null;
	let scene: any = null;
	let camera: any = null;
	let renderer: any = null;
	let braceletGroup: any = null;
	let ringMesh: any = null;
	const beadMeshMap = new Map<string, BeadMesh>();
	const addAnimations: AddAnimation[] = [];
	const positionAnimations: PositionAnimation[] = [];
	let rafId = 0;
	let pointerDown = false;
	let draggingBeadId: string | null = null;
	let dragBeadFromIndex = 0;
	let inited = false;
	let canvasRect: { left: number; top: number; width: number; height: number } = {
		left: 0,
		top: 0,
		width: 1,
		height: 1,
	};
	let raycaster: any = null;
	let mouseNDC: any = null;
	let plane: any = null;
	let planeNormal: any = null;
	let intersectPoint: any = null;
	let textureLoader: any = null;
	const textureCache = new Map<string, any>();
	// 小程序无全局 requestAnimationFrame，需用 canvas 上的
	let requestRAF: (callback: (timestamp: number) => void) => number = () => 0;
	let cancelRAF: (id: number) => void = () => {};

	function angleForIndex(i: number, total: number) {
		if (total <= 0) return 0;
		return (i / total) * Math.PI * 2 - Math.PI / 2;
	}

	/** 小程序端纹理 URL：支持 http 或相对路径；/ 开头时用后端 API 基地址拼接 */
	function resolveTextureUrlMp(url: string): string {
		if (url.startsWith('http')) return url;
		if (API_BASE && url.startsWith('/')) {
			const base = API_BASE.replace(/\/$/, '');
			return base + url;
		}
		return url;
	}

	function createBeadMesh(bead: BraceletBead, index: number, total: number) {
		if (!THREE) return null;
		const angle = angleForIndex(index, total);
		const ringR = getRingRadius(total);
		const x = ringR * Math.cos(angle);
		const z = ringR * Math.sin(angle);
		const radius = bead.size * BEAD_SCALE;
		const geometry = new THREE.SphereGeometry(radius, 20, 20);
		const imageUrl = bead.image?.trim();
		const hasTexture = !!(imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/')));
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
		// 阴影参考图：更贴地、偏左下，边缘更柔和
		const shadowGroup = new THREE.Group();
		const shadowFar = new THREE.Mesh(
			new THREE.CircleGeometry(radius * 1.24, 44),
			new THREE.MeshBasicMaterial({
				color: 0x625b68,
				transparent: true,
				opacity: 0.03,
				depthWrite: false,
			}),
		);
		shadowFar.rotation.x = -Math.PI / 2;
		shadowFar.scale.set(1.16, 0.9, 1);
		shadowFar.position.set(-radius * 0.38, -radius * 1.02, radius * 0.2);
		const shadowCore = new THREE.Mesh(
			new THREE.CircleGeometry(radius * 0.92, 40),
			new THREE.MeshBasicMaterial({
				color: 0x605968,
				transparent: true,
				opacity: 0.048,
				depthWrite: false,
			}),
		);
		shadowCore.rotation.x = -Math.PI / 2;
		shadowCore.scale.set(1.02, 0.84, 1);
		shadowCore.position.set(-radius * 0.22, -radius * 0.99, radius * 0.1);
		shadowGroup.add(shadowFar);
		shadowGroup.add(shadowCore);
		const highlightGroup = new THREE.Group();
		const highlightGlow = new THREE.Mesh(
			new THREE.PlaneGeometry(radius * 1.72, radius * 0.34),
			new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.16,
				depthWrite: false,
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
				opacity: 0.28,
				depthWrite: false,
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
				(material as any).dispose();
				mesh.material = matWithMap;
			} else {
				const fullUrl = resolveTextureUrlMp(imageUrl);
				textureLoader.load(
					fullUrl,
					(tex: any) => {
						if (!mesh.parent) return;
						if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
						else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
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
						(material as any).dispose();
						mesh.material = matWithMap;
					},
					undefined,
					() => {},
				);
			}
		}
		return { mesh, root };
	}

	function updateBeads(newBeads: BraceletBead[], oldBeads: BraceletBead[] = []) {
		if (!braceletGroup || !THREE) return;
		const oldIds = new Set(oldBeads.map((b) => b.id));
		const newIds = new Set(newBeads.map((b) => b.id));

		for (const id of beadMeshMap.keys()) {
			if (!newIds.has(id)) {
				const { root } = beadMeshMap.get(id)!;
				braceletGroup.remove(root);
				root.traverse((child: any) => {
					child.geometry?.dispose?.();
					if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
					else child.material?.dispose?.();
				});
				beadMeshMap.delete(id);
			}
		}

		const ringR = getRingRadius(newBeads.length);
		newBeads.forEach((bead, index) => {
			const total = newBeads.length;
			const angle = angleForIndex(index, total);
			const x = ringR * Math.cos(angle);
			const z = ringR * Math.sin(angle);

			if (beadMeshMap.has(bead.id)) {
				if (bead.id === draggingBeadId) return;
				const { mesh, root } = beadMeshMap.get(bead.id)!;
				const curX = root.position.x;
				const curZ = root.position.z;
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
				// 与 createBeadMesh 一致：半径为 bead.size * BEAD_SCALE
				const radius = bead.size * BEAD_SCALE;
				mesh.scale.setScalar(1);
				mesh.geometry.dispose();
				mesh.geometry = new THREE.SphereGeometry(radius, 20, 20);
				return;
			}

			const beadEntry = createBeadMesh(bead, index, total);
			if (!beadEntry) return;
			beadEntry.root.scale.set(0, 0, 0);
			braceletGroup.add(beadEntry.root);
			beadMeshMap.set(bead.id, { ...beadEntry, beadId: bead.id });
			addAnimations.push({
				mesh: beadEntry.root,
				startTime: performance.now(),
				duration: ADD_BEAD_DURATION_MS,
			});
		});
		if (ringMesh) ringMesh.scale.setScalar(ringR);
	}

	function setSize(width: number, height: number) {
		if (!renderer || !camera) return;
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(2, typeof uni !== 'undefined' ? uni.getSystemInfoSync().pixelRatio || 2 : 2));
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	/** 根据当前视角设置相机位置与朝向（与 H5 useBracelet3d 一致） */
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

	function setViewMode(mode: 'top' | 'side') {
		viewMode.value = mode;
		applyCameraView();
	}

	function getBeadMeshes(): any[] {
		return Array.from(beadMeshMap.values()).map((b) => b.mesh);
	}

	function pointerToNDC(clientX: number, clientY: number): any {
		const r = canvasRect;
		const x = ((clientX - r.left) / r.width) * 2 - 1;
		const y = -((clientY - r.top) / r.height) * 2 + 1;
		mouseNDC.set(x, y);
		return mouseNDC;
	}

	function angleToIndex(angle: number, total: number): number {
		if (total <= 0) return 0;
		let t = (angle + Math.PI / 2) / (2 * Math.PI);
		if (t < 0) t += 1;
		let idx = Math.round(t * total) % total;
		if (idx < 0) idx += total;
		return Math.min(idx, total - 1);
	}

	function projectPointerToRingPlane(
		clientX: number,
		clientY: number,
	): { x: number; z: number; distance: number; angle: number } {
		if (!THREE || !camera || !braceletGroup || !raycaster) return { x: 0, z: 0, distance: 0, angle: 0 };
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

	function tick(now: number) {
		if (!inited || !scene || !camera || !renderer || !braceletGroup) return;

		const toRemove: number[] = [];
		addAnimations.forEach((anim, idx) => {
			const elapsed = now - anim.startTime;
			const t = Math.min(1, elapsed / anim.duration);
			const eased = easeBrand(t);
			anim.mesh.scale.setScalar(eased);
			if (t >= 1) toRemove.push(idx);
		});
		toRemove.reverse().forEach((idx) => addAnimations.splice(idx, 1));

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

		if (!pointerDown && !draggingBeadId) {
			if (Math.abs(rotationVelocityY) > INERTIA_STOP) {
				rotationY.value += rotationVelocityY;
				rotationVelocityY *= INERTIA_DECAY;
			} else {
				rotationVelocityY = 0;
			}
		}

		braceletGroup.rotation.y = rotationY.value;
		braceletGroup.rotation.x = 0;
		renderer.render(scene, camera);
		rafId = requestRAF(tick);
	}

	let rotationVelocityY = 0;

	function onPointerDown(e: { clientX: number; clientY: number }) {
		const clientX = e.clientX;
		const clientY = e.clientY;
		const meshes = getBeadMeshes();
		if (meshes.length > 0 && (onReorder || onRemove) && THREE && raycaster) {
			pointerToNDC(clientX, clientY);
			raycaster.setFromCamera(mouseNDC, camera);
			const hits = raycaster.intersectObjects(meshes, false);
			if (hits.length > 0 && hits[0].object) {
				const beadId = hits[0].object.userData?.beadId as string | undefined;
				if (beadId) {
					draggingBeadId = beadId;
					dragBeadFromIndex = beads.value.findIndex((b) => b.id === beadId);
					if (dragBeadFromIndex >= 0) {
						isDragging.value = true;
						dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
						return;
					}
					draggingBeadId = null;
				}
			}
		}
		pointerDown = true;
		isDragging.value = true;
		dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
	}

	function onPointerMove(e: { clientX: number; clientY: number }) {
		const clientX = e.clientX;
		const clientY = e.clientY;
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

	function onPointerUp() {
		if (draggingBeadId) {
			const meshEntry = beadMeshMap.get(draggingBeadId);
			if (meshEntry) {
				const dist = Math.sqrt(meshEntry.root.position.x ** 2 + meshEntry.root.position.z ** 2);
				// 珠子拖到环外即视为删除
				const deleteRadius = getRingRadius(beads.value.length) + DELETE_MARGIN;
				if (dist > deleteRadius && onRemove) {
					onRemove(draggingBeadId);
					draggingBeadId = null;
					pointerDown = false;
					isDragging.value = false;
					return;
				}
			}
			// 未删除：清空拖拽标记并强制同步，珠子动画回槽位
			draggingBeadId = null;
			if (braceletGroup) updateBeads(beads.value, beads.value);
		}
		pointerDown = false;
		isDragging.value = false;
	}

	function init(canvas: any, proxy?: any) {
		// 小程序环境下必须使用 canvas 上的 requestAnimationFrame / cancelAnimationFrame
		if (typeof canvas.requestAnimationFrame === 'function') {
			requestRAF = canvas.requestAnimationFrame.bind(canvas);
			cancelRAF = canvas.cancelAnimationFrame.bind(canvas);
		} else {
			const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : ({} as any);
			if (typeof g.requestAnimationFrame === 'function') {
				requestRAF = g.requestAnimationFrame.bind(g);
				cancelRAF = typeof g.cancelAnimationFrame === 'function' ? g.cancelAnimationFrame.bind(g) : () => {};
			} else {
				requestRAF = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
				cancelRAF = (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
			}
		}

		THREE = createScopedThreejs(canvas);
		raycaster = new THREE.Raycaster();
		mouseNDC = new THREE.Vector2();
		plane = new THREE.Plane();
		planeNormal = new THREE.Vector3();
		intersectPoint = new THREE.Vector3();
		textureLoader = new THREE.TextureLoader();

		const sys =
			typeof uni !== 'undefined' ? uni.getSystemInfoSync() : { windowWidth: 375, windowHeight: 375, pixelRatio: 2 };
		const size = Math.min(sys.windowWidth ?? 375, 500 * ((sys.windowWidth ?? 375) / 750));
		const width = size;
		const height = size;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xebe8f0);

		camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
		applyCameraView();

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(2, (sys as any).pixelRatio || 2));
		if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
		else if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

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

		braceletGroup = new THREE.Group();
		scene.add(braceletGroup);

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

		updateBeads(beads.value, []);
		inited = true;
		rafId = requestRAF(tick);
		// 异步获取 canvas 在页面中的位置，用于 touch 转 NDC
		if (proxy && typeof proxy.createSelectorQuery === 'function') {
			proxy
				.createSelectorQuery()
				.select(canvasSelector)
				.boundingClientRect()
				.exec((res: any) => {
					if (res?.[0]) canvasRect = res[0];
				});
		}
	}

	function dispose() {
		inited = false;
		cancelRAF(rafId);
		rafId = 0;
		beadMeshMap.forEach(({ root }) => {
			root.traverse((child: any) => {
				child.geometry?.dispose?.();
				if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
				else child.material?.dispose?.();
			});
		});
		beadMeshMap.clear();
		textureCache.forEach((tex: any) => tex.dispose());
		textureCache.clear();
		addAnimations.length = 0;
		positionAnimations.length = 0;
		ringMesh?.geometry?.dispose();
		(ringMesh?.material as any)?.dispose();
		renderer?.dispose();
		THREE = null;
		scene = null;
		camera = null;
		renderer = null;
		braceletGroup = null;
		ringMesh = null;
	}

	watch(
		beads,
		(newBeads, oldBeads) => {
			if (!inited || !braceletGroup) return;
			updateBeads(newBeads, oldBeads || []);
		},
		{ deep: true },
	);

	function tryGetCanvasAndInit(proxy: any, retryCount = 0) {
		const maxRetry = 8;
		// 模拟器下 canvas 可能晚于组件 mount 才可用，首帧延后并多次重试
		const delays = [200, 400, 700, 1100, 1600, 2200, 2800, 3500];
		const delay = delays[Math.min(retryCount, delays.length - 1)];

		const doQuery = () => {
			if (inited) return;
			if (!proxy) return;
			// 必须用 proxy.createSelectorQuery() 才能查到自定义组件内的 canvas，不能用 uni.createSelectorQuery().in(proxy)
			const query =
				typeof proxy.createSelectorQuery === 'function'
					? proxy.createSelectorQuery()
					: uni.createSelectorQuery().in(proxy);
			query
				.select(canvasSelector)
				.node()
				.exec((res: any) => {
					if (inited) return;
					const canvas = res?.[0]?.node;
					if (canvas) {
						init(canvas, proxy);
						return;
					}
					if (retryCount < maxRetry - 1) {
						setTimeout(() => tryGetCanvasAndInit(proxy, retryCount + 1), 150);
					}
				});
		};

		setTimeout(doQuery, delay);
	}

	onMounted(() => {
		const instance = getCurrentInstance();
		const proxy = instance?.proxy;
		if (!proxy) return;
		nextTick(() => {
			tryGetCanvasAndInit(proxy as any, 0);
		});
	});

	onUnmounted(() => {
		dispose();
	});

	return {
		rotationY,
		viewMode,
		setViewMode,
		isDragging,
		onTouchStart(e: any) {
			const touch = e.touches?.[0] ?? e;
			onPointerDown({ clientX: touch.clientX ?? touch.x, clientY: touch.clientY ?? touch.y });
		},
		onTouchMove(e: any) {
			const touch = e.touches?.[0] ?? e;
			onPointerMove({ clientX: touch.clientX ?? touch.x, clientY: touch.clientY ?? touch.y });
		},
		onTouchEnd: onPointerUp,
		onTouchCancel: onPointerUp,
	};
}
