/**
 * 微信小程序端 3D 手串渲染（基于 threejs-miniprogram）
 * 仅在 mp-weixin 平台使用，与 useBracelet3d 逻辑对齐，使用 createScopedThreejs 绑定 canvas
 */
import { ref, watch, onMounted, onUnmounted, nextTick, getCurrentInstance, type ComputedRef } from 'vue';
import { createScopedThreejs } from 'threejs-miniprogram';
import type { BraceletBead } from '@/types';
import { RESOLVED_API_BASE } from '@/config';
import { getCrystalMaterialRenderConfig, type CrystalPhysicalMaterialConfig } from '@/data/crystalMaterials';

/** 手串圆环：初始半径约等于视口宽度的 1/4，随珠子数量增加而增大 */
const INITIAL_RING_RADIUS = 0.7;
const MAX_RING_RADIUS = 1.08;
const RING_GROWTH_PER_BEAD = 0.036;
const RING_TUBE = 0.014;
const BEAD_SCALE = 0.018;
const DELETE_MARGIN = 0.5;

function getRingRadius(beadCount: number): number {
	return Math.min(INITIAL_RING_RADIUS + beadCount * RING_GROWTH_PER_BEAD, MAX_RING_RADIUS);
}
const ADD_BEAD_DURATION_MS = 520;
const REFLOW_DURATION_MS = 420;
const REMOVE_BEAD_DURATION_MS = 340;
const REPLACE_BEAD_DURATION_MS = 460;
const easeBrand = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
	const c1 = 1.42;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easePower3InOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const nowMs = () => Date.now();
const INERTIA_DECAY = 0.96;
const INERTIA_STOP = 0.0008;
const CRYSTAL_OPACITY = 0.9;
const RING_COLOR = 0xd8ceca;
const BEAD_FLOAT_Y = 0.026;
const SHADOW_TINT = 0x4e4958;
const SHADOW_SLANT = -0.72;
const CAMERA_DISTANCE_DEFAULT = 4.8;
const CAMERA_DISTANCE_MIN = 3.1;
const CAMERA_DISTANCE_MAX = 6.8;
const PINCH_ZOOM_SPEED = 0.0045;
const ADD_STAGGER_MS = 44;
const IDLE_ROTATION_DELAY_MS = 760;
const IDLE_ROTATION_SPEED = 0.0001;
const BEAD_TEXTURE_SPIN = 0.00016;
const BEAD_IDLE_FLOAT_Y = 0.018;
const BEAD_IDLE_FLOAT_SPEED = 0.76;
const BEAD_IDLE_SCALE = 0.008;
const BRACELET_IDLE_BREATHE_Y = 0.016;
const BRACELET_IDLE_BREATHE_SCALE = 0.006;
const BRACELET_IDLE_BREATHE_SPEED = 0.58;
const STAGE_GLOW_BASE_OPACITY = 0.12;
const STAGE_REFLECTION_BASE_OPACITY = 0.05;
const DRAG_LIFT_Y = 0.16;
const DRAG_SCALE = 1.16;
const VISUAL_LERP = 0.22;
const RING_SCALE_LERP = 0.14;
const BEAD_START_ANGLE = (5 * Math.PI) / 12;
const LONG_PRESS_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE = 8;
const POINTER_PICK_TOLERANCE = 46;
const SINGLE_ROW_MAX = 5;
const SINGLE_SLOT_SPACING_X = 0.56;
const SINGLE_SLOT_SPACING_Z = 0.42;
const SINGLE_DELETE_DISTANCE = 1.46;
const SINGLE_BEAD_PREVIEW_SCALE = 1.24;

function getBeadTextureRotation(beadId: string): number {
	let hash = 2166136261;
	for (let index = 0; index < beadId.length; index += 1) {
		hash ^= beadId.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}

function getMpQualityProfile(beadCount: number) {
	if (beadCount >= 24) return { sphereSegments: 16, innerSegments: 12, pixelRatio: 1, frameInterval: 34 };
	if (beadCount >= 16) return { sphereSegments: 20, innerSegments: 14, pixelRatio: 1.25, frameInterval: 25 };
	return { sphereSegments: 24, innerSegments: 18, pixelRatio: 1.5, frameInterval: 16 };
}

export type BraceletLayoutMode = 'bracelet' | 'single';

interface BeadMesh {
	mesh: any;
	root: any;
	beadId: string;
	key: string;
}

interface AddAnimation {
	mesh: any;
	fromX: number;
	fromY: number;
	fromZ: number;
	toX: number;
	toZ: number;
	fromScale: number;
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

interface RemoveAnimation {
	mesh: any;
	fromX: number;
	fromY: number;
	fromZ: number;
	toX: number;
	toY: number;
	toZ: number;
	startTime: number;
	duration: number;
	disposeOnEnd: boolean;
}

interface CameraAnimation {
	fromX: number;
	fromY: number;
	fromZ: number;
	fromUpX: number;
	fromUpY: number;
	fromUpZ: number;
	toX: number;
	toY: number;
	toZ: number;
	toUpX: number;
	toUpY: number;
	toUpZ: number;
	startTime: number;
	duration: number;
}

export interface UseBracelet3dMpOptions {
	onReorder?: (fromIndex: number, toIndex: number) => void;
	onRemove?: (beadId: string) => void;
	onSelect?: (beadId: string | null) => void;
	selectedBeadId?: () => string | null;
	onLongPress?: (beadId: string) => void;
	layoutMode?: () => BraceletLayoutMode;
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
	const { onReorder, onRemove, onSelect, selectedBeadId, onLongPress } = options ?? {};
	const rotationY = ref(0);
	const viewMode = ref<'top' | 'side'>('side');
	const cameraDistance = ref(CAMERA_DISTANCE_DEFAULT);
	const isDragging = ref(false);
	const isBeadDragging = ref(false);
	const isBeadDeleteTarget = ref(false);
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
	const removeAnimations: RemoveAnimation[] = [];
	let cameraAnimation: CameraAnimation | null = null;
	let rafId = 0;
	let pointerDown = false;
	let isPinching = false;
	let pinchStartDistance = 0;
	let pinchStartZoom = CAMERA_DISTANCE_DEFAULT;
	let draggingBeadId: string | null = null;
	let dragBeadFromIndex = 0;
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressBeadId: string | null = null;
	let longPressStartX = 0;
	let longPressStartY = 0;
	let inited = false;
	let lastBeadsSnapshot: BraceletBead[] = [];
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
	let showcaseSurfaceGroup: any = null;
	let stageGlowMesh: any = null;
	let stageReflectionMesh: any = null;
	let targetRingRadius = getRingRadius(beads.value.length);
	let targetRingOpacity = 0.72;
	let lastInteractionTime = nowMs();
	let lastFrameTime = nowMs();
	let lastRenderedAt = 0;
	let renderLoopPaused = false;
	let devicePixelRatio = 2;
	// 小程序无全局 requestAnimationFrame，需用 canvas 上的
	let requestRAF: (callback: (timestamp: number) => void) => number = () => 0;
	let cancelRAF: (id: number) => void = () => {};

	function applyAdaptiveQuality() {
		const count = beads.value.length;
		const profile = getMpQualityProfile(count);
		if (renderer) renderer.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatio));
		if (stageReflectionMesh) stageReflectionMesh.visible = count < 24;
	}

	function canRender() {
		return inited && !renderLoopPaused;
	}

	function stopRenderLoop() {
		if (!rafId) return;
		cancelRAF(rafId);
		rafId = 0;
	}

	function startRenderLoop() {
		if (!canRender() || rafId) return;
		lastFrameTime = nowMs();
		rafId = requestRAF(tick);
	}

	function pauseRendering() {
		renderLoopPaused = true;
		stopRenderLoop();
	}

	function resumeRendering() {
		renderLoopPaused = false;
		lastRenderedAt = 0;
		startRenderLoop();
	}

	function getLayoutMode(): BraceletLayoutMode {
		return options?.layoutMode?.() ?? 'bracelet';
	}

	function isSingleLayout(): boolean {
		return getLayoutMode() === 'single';
	}

	function beadContentKey(bead: BraceletBead) {
		return [bead.materialId, bead.image, bead.name, bead.size, bead.price].join('|');
	}

	function beadsSignature(list: BraceletBead[]) {
		return list.map((b) => `${b.id}:${beadContentKey(b)}`).join('~');
	}

	function snapshotBeads(list: BraceletBead[]) {
		return list.map((b) => ({ ...b }));
	}

	function setObjectOpacity(object: any, opacity: number) {
		object.traverse?.((child: any) => {
			const material = child.material;
			const materials = Array.isArray(material) ? material : material ? [material] : [];
			materials.forEach((mat: any) => {
				if (mat.opacity == null) return;
				if (mat.userData == null) mat.userData = {};
				if (mat.userData.baseOpacity == null) mat.userData.baseOpacity = mat.opacity;
				mat.transparent = true;
				mat.opacity = Number(mat.userData.baseOpacity) * opacity;
			});
		});
	}

	function disposeObject(object: any) {
		object.traverse?.((child: any) => {
			child.geometry?.dispose?.();
			if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
			else child.material?.dispose?.();
		});
	}

	function noteInteraction() {
		lastInteractionTime = nowMs();
	}

	function setDraggedAppearance(beadId: string | null, active: boolean) {
		if (!beadId) return;
		const entry = beadMeshMap.get(beadId);
		if (!entry) return;
		entry.root.userData.dragActive = active;
		entry.root.userData.dragDelete = false;
	}

	function setBeadDragState(active: boolean, deleteTarget = false) {
		isBeadDragging.value = active;
		isBeadDeleteTarget.value = active && deleteTarget;
	}

	function createCrystalMaterial(
		params: Record<string, any> = {},
		config?: Partial<CrystalPhysicalMaterialConfig> | null,
	) {
		const usesBaseColorMap = !!params.map;
		const material = new THREE!.MeshPhysicalMaterial({
			color: usesBaseColorMap ? 0xffffff : config?.color ?? 0xe3dfeb,
			transparent: false,
			opacity: 1,
			roughness: usesBaseColorMap ? 0.32 : Math.max(config?.roughness ?? 0.25, 0.2),
			metalness: config?.metalness ?? 0.0,
			// 颜色图已经包含珠子的透光与明暗，避免再折射浅色工作台形成白色光圈。
			transmission: usesBaseColorMap ? 0 : config?.transmission ?? 0.7,
			thickness: config?.thickness ?? 0.72,
			clearcoat: usesBaseColorMap ? 0.28 : Math.min(config?.clearcoat ?? 0.42, 0.52),
			clearcoatRoughness: usesBaseColorMap ? 0.34 : Math.max(config?.clearcoatRoughness ?? 0.28, 0.24),
			reflectivity: usesBaseColorMap ? 0.32 : Math.min(config?.reflectivity ?? 0.42, 0.5),
			specularIntensity: usesBaseColorMap ? 0.28 : 0.42,
			specularColor: new THREE!.Color(0xf4f7f5),
			ior: Math.max(config?.ior ?? 1.46, 1.42),
			envMapIntensity: usesBaseColorMap ? 0.48 : Math.min(config?.envMapIntensity ?? 0.82, 0.9),
			attenuationColor: new THREE!.Color(config?.attenuationColor ?? 0xded8ea),
			attenuationDistance: config?.attenuationDistance ?? 2.2,
			...params,
		});
		const normalScale = usesBaseColorMap ? 0.16 : Math.min(config?.normalScale ?? 0.34, 0.44);
		material.normalScale?.set?.(normalScale, normalScale);
		return material;
	}

	function angleForIndex(i: number, total: number) {
		if (total <= 0) return 0;
		return BEAD_START_ANGLE + (i / total) * Math.PI * 2;
	}

	function singleSlotForIndex(index: number, total: number) {
		const columns = Math.min(Math.max(total, 1), SINGLE_ROW_MAX);
		const rows = Math.max(1, Math.ceil(total / SINGLE_ROW_MAX));
		const row = Math.floor(index / SINGLE_ROW_MAX);
		const col = index % SINGLE_ROW_MAX;
		const rowCount = row === rows - 1 ? total - row * SINGLE_ROW_MAX || columns : columns;
		const visibleColumns = Math.max(rowCount, 1);
		const centeredCol = col - (visibleColumns - 1) / 2;
		const x =
			centeredCol * SINGLE_SLOT_SPACING_X +
			(row % 2 === 1 ? SINGLE_SLOT_SPACING_X * 0.16 : 0) +
			Math.sin((index + 1) * 1.73) * 0.035;
		const z =
			(row - (rows - 1) / 2) * SINGLE_SLOT_SPACING_Z +
			Math.cos((col / Math.max(visibleColumns - 1, 1)) * Math.PI) * 0.08 +
			Math.sin(index * 0.91) * 0.025;
		return { x, z, angle: 0, ringRadius: 0 };
	}

	function slotForIndex(index: number, total: number) {
		if (isSingleLayout()) return singleSlotForIndex(index, total);
		const angle = angleForIndex(index, total);
		const ringRadius = getRingRadius(total);
		return {
			x: ringRadius * Math.cos(angle),
			z: ringRadius * Math.sin(angle),
			angle,
			ringRadius,
		};
	}

	function indexForProjectedPoint(x: number, z: number, angle: number, total: number): number {
		if (total <= 0) return 0;
		if (!isSingleLayout()) return angleToIndex(angle, total);
		let nearestIndex = 0;
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (let i = 0; i < total; i += 1) {
			const slot = singleSlotForIndex(i, total);
			const distance = Math.hypot(x - slot.x, z - slot.z);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestIndex = i;
			}
		}
		return nearestIndex;
	}

	function getDeleteDistance() {
		return isSingleLayout() ? SINGLE_DELETE_DISTANCE : getRingRadius(beads.value.length) + DELETE_MARGIN;
	}

	function createShowcaseSurface() {
		if (!THREE || !scene) return;
		showcaseSurfaceGroup = new THREE.Group();
		stageGlowMesh = new THREE.Mesh(
			new THREE.CircleGeometry(1.42, 64),
			new THREE.MeshBasicMaterial({
				color: 0xd9d5e2,
				transparent: true,
				opacity: STAGE_GLOW_BASE_OPACITY,
				depthWrite: false,
			}),
		);
		stageGlowMesh.rotation.x = -Math.PI / 2;
		stageGlowMesh.scale.set(1.2, 0.58, 1);
		stageGlowMesh.position.set(-0.1, -0.092, 0.08);
		stageGlowMesh.userData.baseOpacity = STAGE_GLOW_BASE_OPACITY;
		showcaseSurfaceGroup.add(stageGlowMesh);

		stageReflectionMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(1.82, 0.28),
			new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: STAGE_REFLECTION_BASE_OPACITY,
				depthWrite: false,
			}),
		);
		stageReflectionMesh.rotation.x = -Math.PI / 2;
		stageReflectionMesh.rotation.z = -0.06;
		stageReflectionMesh.position.set(0.12, -0.082, -0.08);
		stageReflectionMesh.userData.baseOpacity = STAGE_REFLECTION_BASE_OPACITY;
		showcaseSurfaceGroup.add(stageReflectionMesh);
		scene.add(showcaseSurfaceGroup);
	}

	/** 小程序端纹理 URL：支持 http 或相对路径；/ 开头时用后端 API 基地址拼接 */
	function resolveTextureUrlMp(url: string): string {
		if (url.startsWith('http')) return url;
		if (url.startsWith('/static/')) return url;
		if (RESOLVED_API_BASE && url.startsWith('/')) {
			const base = RESOLVED_API_BASE.replace(/\/$/, '');
			return base + url;
		}
		return url;
	}

	function getAltTextureUrl(url: string): string | null {
		if (url.startsWith('/static/')) return url.slice(7);
		if (url.startsWith('/')) return '/static' + url;
		return null;
	}

	function configureTexture(tex: any, isColor = false) {
		if (!THREE) return tex;
		if (isColor) {
			if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
			else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
		}
		// 裁掉圆珠方形贴图外围白底，避免俯视时白底在球面 UV 两端形成白色缺口。
		tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
		tex.repeat?.set?.(0.66, 0.66);
		tex.offset?.set?.(0.17, 0.17);
		if (THREE.LinearFilter !== undefined) tex.magFilter = THREE.LinearFilter;
		if (THREE.LinearMipmapLinearFilter !== undefined) tex.minFilter = THREE.LinearMipmapLinearFilter;
		tex.generateMipmaps = true;
		tex.needsUpdate = true;
		return tex;
	}

	function deriveTextureUrls(imageUrl: string) {
		const match = imageUrl.match(/^(.*)-basecolor\.(png|jpe?g|webp)$/i);
		if (!match) return { map: imageUrl };
		const prefix = match[1];
		return {
			map: imageUrl,
			roughnessMap: `${prefix}-roughness.png`,
			normalMap: `${prefix}-normal.png`,
			alphaMap: `${prefix}-alpha.png`,
		};
	}

	function getTextureUrlsForBead(bead: BraceletBead, imageUrl: string) {
		return getCrystalMaterialRenderConfig(bead.materialId)?.maps ?? deriveTextureUrls(imageUrl);
	}

	function loadTextureAsset(
		url: string,
		options: { isColor?: boolean; optional?: boolean } = {},
		onDone?: (tex: any | null) => void,
		isRetry = false,
	) {
		const cached = textureCache.get(url);
		if (cached) {
			onDone?.(cached);
			return;
		}
		textureLoader.load(
			resolveTextureUrlMp(url),
			(tex: any) => {
				configureTexture(tex, options.isColor);
				textureCache.set(url, tex);
				onDone?.(tex);
			},
			undefined,
			() => {
				if (!isRetry) {
					const alt = getAltTextureUrl(url);
					if (alt) {
						loadTextureAsset(
							alt,
							options,
							(tex) => {
								if (tex) textureCache.set(url, tex);
								onDone?.(tex);
							},
							true,
						);
						return;
					}
				}
					onDone?.(null);
				},
			);
	}

	function createBeadMesh(bead: BraceletBead, index: number, total: number) {
		if (!THREE) return null;
		const { x, z } = slotForIndex(index, total);
		const radius = bead.size * BEAD_SCALE * (isSingleLayout() ? SINGLE_BEAD_PREVIEW_SCALE : 1);
		const quality = getMpQualityProfile(total);
		const geometry = new THREE.SphereGeometry(radius, quality.sphereSegments, quality.sphereSegments);
		const imageUrl = bead.image?.trim();
		const renderConfig = getCrystalMaterialRenderConfig(bead.materialId);
		const textureUrls = imageUrl ? getTextureUrlsForBead(bead, imageUrl) : renderConfig?.maps;
		const hasTexture = !!(textureUrls?.map && (textureUrls.map.startsWith('http') || textureUrls.map.startsWith('/')));
		const material = createCrystalMaterial({}, renderConfig?.material);
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(0, BEAD_FLOAT_Y, 0);
		mesh.rotation.y = getBeadTextureRotation(bead.id);
		mesh.userData = { beadId: bead.id, radius, sphereSegments: quality.sphereSegments };
		// 参考图：阴影是单向拖开的柔焦投影，不是圆片堆叠
		const shadowGroup = new THREE.Group();
		const shadowLayers = [
			{
				width: 3.35,
				height: 2.35,
				offsetX: -0.6,
				offsetY: -1.05,
				offsetZ: 0.24,
				opacity: 0.036,
			},
			{
				width: 2.45,
				height: 1.66,
				offsetX: -0.4,
				offsetY: -1.02,
				offsetZ: 0.13,
				opacity: 0.056,
			},
		];
		for (const layer of shadowLayers) {
			const shadowMesh = new THREE.Mesh(
				new THREE.PlaneGeometry(radius * layer.width, radius * layer.height),
				new THREE.MeshBasicMaterial({
					color: SHADOW_TINT,
					transparent: true,
					opacity: layer.opacity,
					depthWrite: false,
				}),
			);
			shadowMesh.material.userData.baseOpacity = layer.opacity;
			shadowMesh.rotation.x = -Math.PI / 2;
			shadowMesh.rotation.z = SHADOW_SLANT;
			shadowMesh.position.set(
				radius * layer.offsetX,
				radius * layer.offsetY,
				radius * layer.offsetZ,
			);
			shadowGroup.add(shadowMesh);
		}
		const selectionGroup = new THREE.Group();
		const selectionGlowMaterial = new THREE.MeshBasicMaterial({
			color: 0xd0a09d,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: false,
		});
		selectionGlowMaterial.userData.baseOpacity = 0.1;
		const selectionGlow = new THREE.Mesh(
			new THREE.CircleGeometry(radius * 1.5, 36),
			selectionGlowMaterial,
		);
		selectionGlow.rotation.x = -Math.PI / 2;
		selectionGlow.position.set(0, BEAD_FLOAT_Y + radius * 0.11, 0);
		const selectionRingMaterial = new THREE.MeshBasicMaterial({
			color: 0x527985,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: false,
		});
		selectionRingMaterial.userData.baseOpacity = 0.38;
		const selectionRing = new THREE.Mesh(
			new THREE.RingGeometry(radius * 1.12, radius * 1.27, 48),
			selectionRingMaterial,
		);
		selectionRing.rotation.x = -Math.PI / 2;
		selectionRing.position.set(0, BEAD_FLOAT_Y + radius * 0.18, 0);
		selectionGroup.add(selectionGlow);
		selectionGroup.add(selectionRing);
		selectionGroup.visible = false;
		const root = new THREE.Group();
		root.position.set(x, 0, z);
		root.add(shadowGroup);
		root.add(selectionGroup);
		root.add(mesh);
		root.userData = {
			selectionGroup,
			shadowGroup,
			phase: index * 0.73,
			radius,
			dragActive: false,
			dragDelete: false,
			selectionStrength: 0,
		};

		if (hasTexture && textureUrls) {
			loadTextureAsset(textureUrls.map, { isColor: true }, (map) => {
				if (!mesh.parent || !map) return;
				const optionalEntries = [
					['roughnessMap', textureUrls.roughnessMap],
					['normalMap', textureUrls.normalMap],
				] as const;
				const loadedParams: Record<string, any> = {
					map,
				};
				let pending = optionalEntries.filter(([, url]) => !!url).length;
				if (pending === 0) {
					(material as any).dispose();
					mesh.material = createCrystalMaterial(loadedParams, renderConfig?.material);
					return;
				}
				for (const [slot, url] of optionalEntries) {
					if (!url) continue;
					loadTextureAsset(url, { optional: true }, (tex) => {
						if (tex) {
							loadedParams[slot] = tex;
						}
						pending -= 1;
						if (pending === 0 && mesh.parent) {
							(material as any).dispose();
							mesh.material = createCrystalMaterial(loadedParams, renderConfig?.material);
						}
					});
				}
			});
		}
		return { mesh, root };
	}

	function updateBeads(newBeads: BraceletBead[], oldBeads: BraceletBead[] = []) {
		if (!braceletGroup || !THREE) return;
		noteInteraction();
		const oldIds = new Set(oldBeads.map((b) => b.id));
		const newIds = new Set(newBeads.map((b) => b.id));
		const updateTime = nowMs();
		let addOrdinal = 0;

		for (const id of beadMeshMap.keys()) {
			if (!newIds.has(id)) {
				const { root } = beadMeshMap.get(id)!;
				const dist = Math.sqrt(root.position.x ** 2 + root.position.z ** 2) || 1;
				const push = 0.42;
				removeAnimations.push({
					mesh: root,
					fromX: root.position.x,
					fromY: root.position.y,
					fromZ: root.position.z,
					toX: root.position.x + (root.position.x / dist) * push,
					toY: root.position.y + 0.16,
					toZ: root.position.z + (root.position.z / dist) * push,
					startTime: nowMs(),
					duration: REMOVE_BEAD_DURATION_MS,
					disposeOnEnd: true,
				});
				beadMeshMap.delete(id);
			}
		}

		const layoutMode = getLayoutMode();
		const ringR = layoutMode === 'single' ? 0.74 : getRingRadius(newBeads.length);
		newBeads.forEach((bead, index) => {
			const total = newBeads.length;
			const { x, z } = slotForIndex(index, total);

			if (beadMeshMap.has(bead.id)) {
				if (bead.id === draggingBeadId) return;
				const entry = beadMeshMap.get(bead.id)!;
				const { mesh, root } = entry;
				const curX = root.position.x;
				const curZ = root.position.z;
				const nextKey = beadContentKey(bead);
				if (entry.key !== nextKey) {
					const oldRoot = root;
					const replacement = createBeadMesh(bead, index, total);
					if (!replacement) return;
					replacement.root.position.set(curX, 0, curZ);
					replacement.root.scale.setScalar(0.48);
					braceletGroup.add(replacement.root);
					beadMeshMap.set(bead.id, { ...replacement, beadId: bead.id, key: nextKey });
					removeAnimations.push({
						mesh: oldRoot,
						fromX: curX,
						fromY: oldRoot.position.y,
						fromZ: curZ,
						toX: curX,
						toY: -0.05,
						toZ: curZ,
						startTime: nowMs(),
						duration: Math.round(REPLACE_BEAD_DURATION_MS * 0.58),
						disposeOnEnd: true,
					});
					addAnimations.push({
						mesh: replacement.root,
						fromX: curX,
						fromY: 0.08,
						fromZ: curZ,
						toX: x,
						toZ: z,
						fromScale: 0.48,
						startTime: nowMs() + 80,
						duration: REPLACE_BEAD_DURATION_MS,
					});
					return;
				}
				if (Math.abs(curX - x) > 1e-5 || Math.abs(curZ - z) > 1e-5) {
					positionAnimations.push({
						mesh: root,
						fromX: curX,
						fromZ: curZ,
						toX: x,
						toZ: z,
						startTime: nowMs(),
						duration: REFLOW_DURATION_MS,
					});
				} else {
					root.position.set(x, 0, z);
				}
				// 规格或质量档不变时复用几何体，减少小程序端频繁分配与回收。
				const radius = bead.size * BEAD_SCALE * (isSingleLayout() ? SINGLE_BEAD_PREVIEW_SCALE : 1);
				root.userData.radius = radius;
				mesh.scale.setScalar(1);
				const quality = getMpQualityProfile(total);
				if (mesh.userData.radius !== radius || mesh.userData.sphereSegments !== quality.sphereSegments) {
					mesh.geometry.dispose();
					mesh.geometry = new THREE.SphereGeometry(radius, quality.sphereSegments, quality.sphereSegments);
					mesh.userData.radius = radius;
					mesh.userData.sphereSegments = quality.sphereSegments;
				}
				return;
			}

			const beadEntry = createBeadMesh(bead, index, total);
			if (!beadEntry) return;
			const fromX = layoutMode === 'single' ? x * 0.2 : x * 0.12;
			const fromZ = layoutMode === 'single' ? 1.04 : ringR + 1.08;
			const startDelay = oldIds.size === 0 ? index * ADD_STAGGER_MS : addOrdinal * Math.round(ADD_STAGGER_MS * 0.72);
			addOrdinal += 1;
			beadEntry.root.position.set(fromX, 0.24, fromZ);
			beadEntry.root.scale.setScalar(0.18);
			braceletGroup.add(beadEntry.root);
			beadMeshMap.set(bead.id, { ...beadEntry, beadId: bead.id, key: beadContentKey(bead) });
			addAnimations.push({
				mesh: beadEntry.root,
				fromX,
				fromY: 0.24,
				fromZ,
				toX: x,
				toZ: z,
				fromScale: 0.18,
				startTime: updateTime + startDelay,
				duration: ADD_BEAD_DURATION_MS,
			});
		});
		targetRingRadius = ringR;
		targetRingOpacity = layoutMode === 'single' ? 0 : 0.72;
		applyAdaptiveQuality();
	}

	function setSize(width: number, height: number) {
		if (!renderer || !camera) return;
		const quality = getMpQualityProfile(beads.value.length);
		renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	function clampCameraDistance(next: number) {
		return Math.min(CAMERA_DISTANCE_MAX, Math.max(CAMERA_DISTANCE_MIN, next));
	}

	function setCameraDistance(next: number) {
		cameraDistance.value = clampCameraDistance(next);
		cameraAnimation = null;
		applyCameraView();
	}

	function getTouchDistance(touches: ArrayLike<{ clientX?: number; clientY?: number; x?: number; y?: number }>) {
		if (touches.length < 2) return 0;
		const p1 = touches[0];
		const p2 = touches[1];
		const x1 = p1.clientX ?? p1.x ?? 0;
		const y1 = p1.clientY ?? p1.y ?? 0;
		const x2 = p2.clientX ?? p2.x ?? 0;
		const y2 = p2.clientY ?? p2.y ?? 0;
		return Math.hypot(x1 - x2, y1 - y2);
	}

	function getCameraPose(mode: 'top' | 'side') {
		return mode === 'top'
			? {
					x: 0,
					y: cameraDistance.value,
					z: 0,
					upX: 0,
					upY: 0,
					upZ: -1,
				}
			: {
					x: 0.28,
					y: 1.48,
					z: cameraDistance.value * 0.94,
					upX: 0,
					upY: 1,
					upZ: 0,
				};
	}

	/** 根据当前视角设置相机位置与朝向（与 H5 useBracelet3d 一致） */
	function applyCameraView() {
		if (!camera) return;
		const pose = getCameraPose(viewMode.value);
		camera.position.set(pose.x, pose.y, pose.z);
		camera.up.set(pose.upX, pose.upY, pose.upZ);
		camera.lookAt(0, 0, 0);
	}

	function setViewMode(mode: 'top' | 'side') {
		if (viewMode.value === mode) return;
		viewMode.value = mode;
		if (!camera) {
			applyCameraView();
			return;
		}
		const pose = getCameraPose(mode);
		cameraAnimation = {
			fromX: camera.position.x,
			fromY: camera.position.y,
			fromZ: camera.position.z,
			fromUpX: camera.up.x,
			fromUpY: camera.up.y,
			fromUpZ: camera.up.z,
			toX: pose.x,
			toY: pose.y,
			toZ: pose.z,
			toUpX: pose.upX,
			toUpY: pose.upY,
			toUpZ: pose.upZ,
			startTime: nowMs(),
			duration: 560,
		};
	}

	function getBeadMeshes(): any[] {
		return Array.from(beadMeshMap.values()).map((b) => b.mesh);
	}

	function findBeadIdAtPointer(clientX: number, clientY: number): string | null {
		const meshes = getBeadMeshes();
		if (!meshes.length || !THREE || !camera || !raycaster) return null;
		pointerToNDC(clientX, clientY);
		raycaster.setFromCamera(mouseNDC, camera);
		const hits = raycaster.intersectObjects(meshes, false);
		if (hits.length > 0 && hits[0].object) {
			const beadId = hits[0].object.userData?.beadId as string | undefined;
			if (beadId) return beadId;
		}

		const projected = new THREE.Vector3();
		let nearestId: string | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;
		beadMeshMap.forEach(({ root, beadId }) => {
			root.updateWorldMatrix?.(true, false);
			root.getWorldPosition?.(projected);
			projected.project(camera);
			if (projected.z < -1 || projected.z > 1) return;
			const screenX = canvasRect.left + ((projected.x + 1) / 2) * canvasRect.width;
			const screenY = canvasRect.top + ((1 - projected.y) / 2) * canvasRect.height;
			const distance = Math.hypot(clientX - screenX, clientY - screenY);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestId = beadId;
			}
		});
		return nearestDistance <= POINTER_PICK_TOLERANCE ? nearestId : null;
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
		let t = (angle - BEAD_START_ANGLE) / (2 * Math.PI);
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

	function tick() {
		rafId = 0;
		if (!canRender() || !scene || !camera || !renderer || !braceletGroup) return;
		const now = nowMs();
		const frameInterval = getMpQualityProfile(beads.value.length).frameInterval;
		if (lastRenderedAt && now - lastRenderedAt < frameInterval) {
			startRenderLoop();
			return;
		}
		lastRenderedAt = now;
		const deltaMs = Math.min(34, Math.max(0, now - lastFrameTime || 16));
		lastFrameTime = now;

		const toRemove: number[] = [];
		addAnimations.forEach((anim, idx) => {
			const elapsed = now - anim.startTime;
			const t = Math.min(1, Math.max(0, elapsed / anim.duration));
			const move = easeOutCubic(t);
			const scale = anim.fromScale + (1 - anim.fromScale) * easeOutBack(t);
			const lift = Math.sin(Math.PI * Math.min(1, t)) * 0.16;
			anim.mesh.position.x = anim.fromX + (anim.toX - anim.fromX) * move;
			anim.mesh.position.y = anim.fromY * (1 - move) + lift;
			anim.mesh.position.z = anim.fromZ + (anim.toZ - anim.fromZ) * move;
			anim.mesh.scale.setScalar(Math.max(0.01, scale));
			if (t >= 1) toRemove.push(idx);
		});
		toRemove.reverse().forEach((idx) => addAnimations.splice(idx, 1));

		const posToRemove: number[] = [];
		positionAnimations.forEach((anim, idx) => {
			const elapsed = now - anim.startTime;
			const t = Math.min(1, Math.max(0, elapsed / anim.duration));
			const eased = easeBrand(t);
			const lift = Math.sin(Math.PI * t) * 0.055;
			anim.mesh.position.x = anim.fromX + (anim.toX - anim.fromX) * eased;
			anim.mesh.position.y = lift;
			anim.mesh.position.z = anim.fromZ + (anim.toZ - anim.fromZ) * eased;
			if (t >= 1) posToRemove.push(idx);
		});
		posToRemove.reverse().forEach((idx) => positionAnimations.splice(idx, 1));

		const removeToFinalize: number[] = [];
		removeAnimations.forEach((anim, idx) => {
			const elapsed = now - anim.startTime;
			const t = Math.min(1, Math.max(0, elapsed / anim.duration));
			const move = easeInCubic(t);
			anim.mesh.position.x = anim.fromX + (anim.toX - anim.fromX) * move;
			anim.mesh.position.y = anim.fromY + (anim.toY - anim.fromY) * move;
			anim.mesh.position.z = anim.fromZ + (anim.toZ - anim.fromZ) * move;
			anim.mesh.scale.setScalar(Math.max(0.01, 1 - easeOutCubic(t) * 0.88));
			setObjectOpacity(anim.mesh, 1 - easeOutCubic(t));
			if (t >= 1) removeToFinalize.push(idx);
		});
		removeToFinalize.reverse().forEach((idx) => {
			const anim = removeAnimations[idx];
			braceletGroup.remove(anim.mesh);
			if (anim.disposeOnEnd) disposeObject(anim.mesh);
			removeAnimations.splice(idx, 1);
		});

		if (cameraAnimation) {
			const elapsed = now - cameraAnimation.startTime;
			const t = Math.min(1, Math.max(0, elapsed / cameraAnimation.duration));
			const eased = easePower3InOut(t);
			camera.position.set(
				cameraAnimation.fromX + (cameraAnimation.toX - cameraAnimation.fromX) * eased,
				cameraAnimation.fromY + (cameraAnimation.toY - cameraAnimation.fromY) * eased,
				cameraAnimation.fromZ + (cameraAnimation.toZ - cameraAnimation.fromZ) * eased,
			);
			camera.up.set(
				cameraAnimation.fromUpX + (cameraAnimation.toUpX - cameraAnimation.fromUpX) * eased,
				cameraAnimation.fromUpY + (cameraAnimation.toUpY - cameraAnimation.fromUpY) * eased,
				cameraAnimation.fromUpZ + (cameraAnimation.toUpZ - cameraAnimation.fromUpZ) * eased,
			);
			camera.lookAt(0, 0, 0);
			if (t >= 1) cameraAnimation = null;
		}

		if (!pointerDown && !draggingBeadId) {
			if (Math.abs(rotationVelocityY) > INERTIA_STOP) {
				rotationY.value += rotationVelocityY;
				rotationVelocityY *= INERTIA_DECAY;
			} else {
				rotationVelocityY = 0;
			}
		}
		if (
			!pointerDown &&
			!draggingBeadId &&
			!isPinching &&
			!isSingleLayout() &&
			Math.abs(rotationVelocityY) <= INERTIA_STOP &&
			beads.value.length > 0 &&
			now - lastInteractionTime > IDLE_ROTATION_DELAY_MS
		) {
			rotationY.value += IDLE_ROTATION_SPEED * deltaMs;
		}

		const scaleAnimated = new Set([
			...addAnimations.map((anim) => anim.mesh),
			...removeAnimations.map((anim) => anim.mesh),
		]);
		const positionAnimated = new Set([
			...addAnimations.map((anim) => anim.mesh),
			...positionAnimations.map((anim) => anim.mesh),
			...removeAnimations.map((anim) => anim.mesh),
		]);
		let visualIndex = 0;
		const currentSelectedBeadId = selectedBeadId?.() ?? null;
		beadMeshMap.forEach(({ mesh, root, beadId }) => {
			const isSelected = beadId === currentSelectedBeadId;
			const phase = Number(root.userData.phase ?? visualIndex) + now * 0.0011;
			const radius = Number(root.userData.radius ?? 0.14);
			const idleWave = Math.sin(phase * BEAD_IDLE_FLOAT_SPEED);
			const idleLift = (idleWave + 1) * 0.5 * BEAD_IDLE_FLOAT_Y;
			const idleScale = 1 + Math.sin(phase * 0.64) * BEAD_IDLE_SCALE;
			visualIndex += 1;
			mesh.rotation.y += BEAD_TEXTURE_SPIN * deltaMs;
			mesh.rotation.x = Math.sin(phase) * 0.025;
			mesh.rotation.z = Math.sin(phase * 0.47) * 0.018;
			const shadowGroup = root.userData.shadowGroup;
			if (shadowGroup) {
				const shadowLift = root.userData.dragActive ? 1 : isSelected ? 0.68 : idleLift / BEAD_IDLE_FLOAT_Y;
				shadowGroup.scale?.setScalar?.(1 + shadowLift * 0.05);
				shadowGroup.children?.forEach?.((child: any) => {
					if (!child.material) return;
					const baseOpacity = Number(child.material.userData?.baseOpacity ?? child.material.opacity ?? 0.06);
					if (!child.material.userData) child.material.userData = {};
					child.material.userData.baseOpacity = baseOpacity;
					child.material.opacity = baseOpacity * (1 - shadowLift * 0.24);
				});
			}
			const selectionGroup = root.userData.selectionGroup;
			if (selectionGroup) {
				const targetStrength = root.userData.dragActive || isSelected ? 1 : 0;
				const currentStrength = Number(root.userData.selectionStrength ?? 0);
				const nextStrength = currentStrength + (targetStrength - currentStrength) * 0.28;
				root.userData.selectionStrength = nextStrength;
				selectionGroup.visible = nextStrength > 0.02;
				selectionGroup.scale?.setScalar?.(0.94 + nextStrength * 0.14 + Math.sin(phase * 1.8) * 0.025 * nextStrength);
				selectionGroup.children?.forEach?.((child: any, childIndex: number) => {
					if (!child.material) return;
					const baseOpacity = Number(child.material.userData?.baseOpacity ?? 0.1);
					const pulse = 0.86 + Math.sin(phase * 1.35 + childIndex * 1.3) * 0.14;
					child.material.opacity = baseOpacity * nextStrength * pulse;
				});
			}
			if (!scaleAnimated.has(root)) {
				const targetScale = root.userData.dragActive ? DRAG_SCALE : isSelected ? 1.06 * idleScale : idleScale;
				const nextScale = root.scale.x + (targetScale - root.scale.x) * VISUAL_LERP;
				root.scale.setScalar(nextScale);
			}
			if (!positionAnimated.has(root)) {
				const targetY = root.userData.dragActive ? DRAG_LIFT_Y : isSelected ? 0.045 + idleLift * 0.45 : idleLift;
				root.position.y += (targetY - root.position.y) * VISUAL_LERP;
			}
		});
		if (ringMesh) {
			const nextRingRadius = ringMesh.scale.x + (targetRingRadius - ringMesh.scale.x) * RING_SCALE_LERP;
			ringMesh.scale.setScalar(nextRingRadius);
			if (ringMesh.material) {
				ringMesh.material.opacity += (targetRingOpacity - ringMesh.material.opacity) * 0.18;
				ringMesh.visible = ringMesh.material.opacity > 0.012;
			}
		}

		const idleReady =
			!pointerDown &&
			!draggingBeadId &&
			!isPinching &&
			Math.abs(rotationVelocityY) <= INERTIA_STOP &&
			beads.value.length > 0 &&
			now - lastInteractionTime > IDLE_ROTATION_DELAY_MS;
		const breathePhase = now * 0.001 * BRACELET_IDLE_BREATHE_SPEED;
		const breatheWave = idleReady ? Math.sin(breathePhase) : 0;
		const targetGroupY = idleReady ? BRACELET_IDLE_BREATHE_Y * (0.62 + breatheWave * 0.38) : 0;
		const targetGroupScale = idleReady ? 1 + breatheWave * BRACELET_IDLE_BREATHE_SCALE : 1;
		braceletGroup.position.y += (targetGroupY - braceletGroup.position.y) * 0.08;
		const nextGroupScale = braceletGroup.scale.x + (targetGroupScale - braceletGroup.scale.x) * 0.08;
		braceletGroup.scale.setScalar(nextGroupScale);
		const stagePresence = beads.value.length > 0 ? 1 : 0.34;
		showcaseSurfaceGroup?.scale?.setScalar?.(1 + (nextGroupScale - 1) * 0.68);
		if (stageGlowMesh?.material) {
			stageGlowMesh.material.opacity = STAGE_GLOW_BASE_OPACITY * stagePresence * (0.92 + (breatheWave + 1) * 0.04);
		}
		if (stageReflectionMesh?.material) {
			stageReflectionMesh.material.opacity = STAGE_REFLECTION_BASE_OPACITY * stagePresence * (0.86 + (breatheWave + 1) * 0.09);
			stageReflectionMesh.position.x = 0.12 + Math.sin(breathePhase * 0.72) * 0.018;
		}

		braceletGroup.rotation.y = rotationY.value;
		braceletGroup.rotation.x = 0;
		renderer.render(scene, camera);
		startRenderLoop();
	}

	let rotationVelocityY = 0;

	function clearLongPressTimer() {
		if (longPressTimer) clearTimeout(longPressTimer);
		longPressTimer = null;
		longPressBeadId = null;
	}

	function startLongPressTimer(beadId: string, clientX: number, clientY: number) {
		if (!onLongPress) return;
		clearLongPressTimer();
		longPressBeadId = beadId;
		longPressStartX = clientX;
		longPressStartY = clientY;
		longPressTimer = setTimeout(() => {
			const targetBeadId = longPressBeadId;
			if (!targetBeadId || targetBeadId !== draggingBeadId) return;
			setDraggedAppearance(targetBeadId, false);
			draggingBeadId = null;
			pointerDown = false;
			isDragging.value = false;
			setBeadDragState(false);
			if (braceletGroup) updateBeads(beads.value, beads.value);
			onLongPress(targetBeadId);
			clearLongPressTimer();
		}, LONG_PRESS_MS);
	}

	function cancelLongPressIfMoved(clientX: number, clientY: number) {
		if (!longPressTimer) return;
		const dx = clientX - longPressStartX;
		const dy = clientY - longPressStartY;
		if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
			clearLongPressTimer();
		}
	}

	function onPointerDown(e: { clientX: number; clientY: number }) {
		noteInteraction();
		const clientX = e.clientX;
		const clientY = e.clientY;
		if (onReorder || onRemove || onLongPress) {
			const beadId = findBeadIdAtPointer(clientX, clientY);
			if (beadId) {
				draggingBeadId = beadId;
				onSelect?.(beadId);
				dragBeadFromIndex = beads.value.findIndex((b) => b.id === beadId);
					if (dragBeadFromIndex >= 0) {
						setDraggedAppearance(beadId, true);
						isDragging.value = true;
						setBeadDragState(true);
						dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
						startLongPressTimer(beadId, clientX, clientY);
						return;
					}
				draggingBeadId = null;
			}
		}
		clearLongPressTimer();
		setBeadDragState(false);
		pointerDown = true;
		isDragging.value = true;
		dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
	}

	function onPointerMove(e: { clientX: number; clientY: number }) {
		noteInteraction();
		const clientX = e.clientX;
		const clientY = e.clientY;
		cancelLongPressIfMoved(clientX, clientY);
		if (draggingBeadId && braceletGroup) {
			const proj = projectPointerToRingPlane(clientX, clientY);
			const meshEntry = beadMeshMap.get(draggingBeadId);
			if (meshEntry) {
				meshEntry.root.position.set(proj.x, 0, proj.z);
				const deleteRadius = getDeleteDistance();
				const deleteTarget = proj.distance > deleteRadius;
				meshEntry.root.userData.dragDelete = deleteTarget;
				setBeadDragState(true, deleteTarget);
				if (proj.distance <= deleteRadius && onReorder) {
					const total = beads.value.length;
					const toIndex = indexForProjectedPoint(proj.x, proj.z, proj.angle, total);
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
		noteInteraction();
		clearLongPressTimer();
		if (draggingBeadId) {
			const releasedBeadId = draggingBeadId;
			setDraggedAppearance(releasedBeadId, false);
			const meshEntry = beadMeshMap.get(draggingBeadId);
			if (meshEntry) {
				const dist = Math.sqrt(meshEntry.root.position.x ** 2 + meshEntry.root.position.z ** 2);
				// 珠子拖到环外即视为删除
				const deleteRadius = getDeleteDistance();
				if (dist > deleteRadius && onRemove) {
					onRemove(draggingBeadId);
						draggingBeadId = null;
						pointerDown = false;
						isDragging.value = false;
						setBeadDragState(false);
						return;
					}
				}
				// 未删除：清空拖拽标记并强制同步，珠子动画回槽位
				draggingBeadId = null;
				setBeadDragState(false);
				onSelect?.(null);
				if (braceletGroup) updateBeads(beads.value, beads.value);
			}
			pointerDown = false;
			isDragging.value = false;
			if (!draggingBeadId) setBeadDragState(false);
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
				requestRAF = (cb: (t: number) => void) => setTimeout(() => cb(nowMs()), 16) as unknown as number;
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
		scene.background = null;

		camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
		applyCameraView();

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		devicePixelRatio = Math.max(1, (sys as any).pixelRatio || 2);
		const quality = getMpQualityProfile(beads.value.length);
		renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
		renderer.setSize(width, height, false);
		renderer.setClearColor?.(0x000000, 0);
		if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
		else if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
		if (renderer.toneMapping !== undefined && THREE.ACESFilmicToneMapping !== undefined) {
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderer.toneMappingExposure = 0.94;
		}

		const ambient = new THREE.AmbientLight(0xffffff, 0.26);
		scene.add(ambient);
		const key = new THREE.DirectionalLight(0xfffdf8, 0.5);
		key.position.set(-3.2, 4.2, 2.6);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xe5f0ef, 0.18);
		fill.position.set(2.8, 1.6, 2.2);
		scene.add(fill);
		const rim = new THREE.DirectionalLight(0xdbe8ee, 0.1);
		rim.position.set(0.4, 2.1, -3.4);
		scene.add(rim);
		braceletGroup = new THREE.Group();
		scene.add(braceletGroup);
		createShowcaseSurface();

		const ringGeom = new THREE.TorusGeometry(1, RING_TUBE, 16, 64);
		const ringMat = new THREE.MeshPhysicalMaterial({
			color: RING_COLOR,
			transparent: true,
			opacity: 0.72,
			roughness: 0.34,
			metalness: 0.02,
			transmission: 0.24,
			clearcoat: 0.58,
			clearcoatRoughness: 0.22,
		});
		ringMesh = new THREE.Mesh(ringGeom, ringMat);
		ringMesh.rotation.x = -Math.PI / 2;
		targetRingRadius = isSingleLayout() ? 0.74 : getRingRadius(beads.value.length);
		targetRingOpacity = isSingleLayout() ? 0 : 0.72;
		ringMesh.scale.setScalar(targetRingRadius);
		ringMesh.material.opacity = targetRingOpacity;
		ringMesh.visible = targetRingOpacity > 0;
		braceletGroup.add(ringMesh);

		updateBeads(beads.value, []);
		lastBeadsSnapshot = snapshotBeads(beads.value);
		inited = true;
		startRenderLoop();
		// 异步获取 canvas 在页面中的位置，用于 touch 转 NDC
		if (proxy && typeof proxy.createSelectorQuery === 'function') {
			proxy
				.createSelectorQuery()
				.select(canvasSelector)
				.boundingClientRect()
				.exec((res: any) => {
					if (res?.[0]) {
						canvasRect = res[0];
						if (canvasRect.width > 0 && canvasRect.height > 0) {
							setSize(canvasRect.width, canvasRect.height);
						}
					}
				});
		}
	}

	function dispose() {
		inited = false;
		clearLongPressTimer();
		stopRenderLoop();
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
		showcaseSurfaceGroup?.traverse?.((child: any) => {
			child.geometry?.dispose?.();
			if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
			else child.material?.dispose?.();
		});
		showcaseSurfaceGroup = null;
		stageGlowMesh = null;
		stageReflectionMesh = null;
		addAnimations.length = 0;
		positionAnimations.length = 0;
		removeAnimations.length = 0;
		cameraAnimation = null;
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
		() => beadsSignature(beads.value),
		() => {
			if (!inited || !braceletGroup) return;
			updateBeads(beads.value, lastBeadsSnapshot);
			lastBeadsSnapshot = snapshotBeads(beads.value);
		},
	);

	watch(
		() => options?.layoutMode?.() ?? 'bracelet',
		() => {
			if (!inited || !braceletGroup) return;
			rotationY.value = 0;
			rotationVelocityY = 0;
			updateBeads(beads.value, beads.value);
		},
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
		cameraDistance,
		setViewMode,
			setCameraDistance,
			isDragging,
			isBeadDragging,
			isBeadDeleteTarget,
			pauseRendering,
			resumeRendering,
			onTouchStart(e: any) {
			const touches = e.touches ?? [];
			if (touches.length >= 2) {
				if (draggingBeadId) onPointerUp();
				pointerDown = false;
				isPinching = true;
				pinchStartDistance = getTouchDistance(touches);
				pinchStartZoom = cameraDistance.value;
				return;
			}
			const touch = touches[0] ?? e;
			isPinching = false;
			onPointerDown({ clientX: touch.clientX ?? touch.x, clientY: touch.clientY ?? touch.y });
		},
		onTouchMove(e: any) {
			const touches = e.touches ?? [];
			if (isPinching && touches.length >= 2) {
				const distance = getTouchDistance(touches);
				if (pinchStartDistance > 0 && distance > 0) {
					const delta = pinchStartDistance - distance;
					setCameraDistance(pinchStartZoom + delta * PINCH_ZOOM_SPEED);
				}
				return;
			}
			const touch = touches[0] ?? e;
			onPointerMove({ clientX: touch.clientX ?? touch.x, clientY: touch.clientY ?? touch.y });
		},
		onTouchEnd(e: any) {
			const touches = e.touches ?? [];
			if (isPinching) {
				if (touches.length >= 2) {
					pinchStartDistance = getTouchDistance(touches);
					pinchStartZoom = cameraDistance.value;
					return;
				}
				isPinching = false;
				if (touches.length === 1) {
					pointerDown = true;
					isDragging.value = true;
					dragStart.value = {
						x: touches[0].clientX ?? touches[0].x ?? 0,
						y: touches[0].clientY ?? touches[0].y ?? 0,
						rotY: rotationY.value,
					};
					return;
				}
			}
			onPointerUp();
		},
		onTouchCancel: onPointerUp,
	};
}
