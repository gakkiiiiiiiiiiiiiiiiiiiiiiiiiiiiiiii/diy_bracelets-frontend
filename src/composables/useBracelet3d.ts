import { ref, watch, onMounted, onUnmounted, nextTick, type Ref, type ComputedRef } from 'vue';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BraceletBead } from '@/types';
import { RESOLVED_API_BASE } from '@/config';
import { getCrystalMaterialRenderConfig, type CrystalPhysicalMaterialConfig } from '@/data/crystalMaterials';

/** 手串圆环：初始半径约等于视口宽度的 1/4，随珠子数量增加而增大 */
const INITIAL_RING_RADIUS = 0.7;
const MAX_RING_RADIUS = 1.08;
const RING_GROWTH_PER_BEAD = 0.036;
const RING_TUBE = 0.014;
const BEAD_SCALE = 0.018;
/** 拖出环半径+该余量外视为删除 */
const DELETE_MARGIN = 0.5;

function getRingRadius(beadCount: number): number {
	return Math.min(INITIAL_RING_RADIUS + beadCount * RING_GROWTH_PER_BEAD, MAX_RING_RADIUS);
}
/** 动画体系：参考视频的“飞入-补位-收起”节奏 */
const ADD_BEAD_DURATION_MS = 520;
const REFLOW_DURATION_MS = 420;
const REMOVE_BEAD_DURATION_MS = 340;
const REPLACE_BEAD_DURATION_MS = 460;
/** brand-ease 近似：平滑、无 overshoot（缓动函数，平滑动画过渡） */
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
/** 旋转惯性衰减系数，停止阈值 */
const INERTIA_DECAY = 0.96;
const INERTIA_STOP = 0.0008;
/** 水晶珠子：降亮度、冷色 tint，避免过曝 */
const CRYSTAL_OPACITY = 0.9;
const RING_COLOR = 0xd8ceca;
const BEAD_FLOAT_Y = 0.026;
const SHADOW_TINT = 0x4e4958;
const SHADOW_SLANT = -0.72;
const CAMERA_DISTANCE_DEFAULT = 4.8;
const CAMERA_DISTANCE_MIN = 3.1;
const CAMERA_DISTANCE_MAX = 6.8;
const PINCH_ZOOM_SPEED = 0.0045;
const WHEEL_ZOOM_SPEED = 0.0022;
const ADD_STAGGER_MS = 44;
const IDLE_ROTATION_DELAY_MS = 760;
const IDLE_ROTATION_SPEED = 0.0001;
const BEAD_IDLE_FLOAT_Y = 0.018;
const BEAD_IDLE_FLOAT_SPEED = 0.76;
const BEAD_IDLE_SCALE = 0.008;
const BRACELET_IDLE_BREATHE_Y = 0.016;
const BRACELET_IDLE_BREATHE_SCALE = 0.006;
const BRACELET_IDLE_BREATHE_SPEED = 0.58;
const STAGE_GLOW_BASE_OPACITY = 0.16;
const STAGE_REFLECTION_BASE_OPACITY = 0.07;
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

/** 同款天然水晶也不会拥有完全相同的纹理朝向；限制在正面安全角度内，避免贴图接缝转入镜头。 */
function getBeadTextureRotation(beadId: string): number {
	let hash = 2166136261;
	for (let index = 0; index < beadId.length; index += 1) {
		hash ^= beadId.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return ((hash >>> 0) / 0xffffffff - 0.5) * 1.1;
}

function getSphereSegments(beadCount: number): number {
	if (beadCount >= 24) return 20;
	if (beadCount >= 16) return 24;
	return 32;
}

export type BraceletLayoutMode = 'bracelet' | 'single';

export interface UseBracelet3dOptions {
	onReorder?: (fromIndex: number, toIndex: number) => void;
	onRemove?: (beadId: string) => void;
	onSelect?: (beadId: string | null) => void;
	selectedBeadId?: () => string | null;
	onLongPress?: (beadId: string) => void;
	layoutMode?: () => BraceletLayoutMode;
}

// 珠子网格结构（包含三维对象和珠子id）
interface BeadMesh {
	mesh: THREE.Mesh;
	root: THREE.Group;
	beadId: string;
	key: string;
}

// 新珠子加入时的动画结构
interface AddAnimation {
	mesh: THREE.Object3D;
	fromX: number;
	fromY: number;
	fromZ: number;
	toX: number;
	toZ: number;
	fromScale: number;
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

interface RemoveAnimation {
	mesh: THREE.Object3D;
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
	const { onReorder, onRemove, onSelect, selectedBeadId, onLongPress } = options ?? {};
	// 仅 Y 轴旋转（手串绕竖直轴转）
	const rotationY = ref(0);
	// 视角：俯视 / 侧面
	const viewMode = ref<'top' | 'side'>('side');
	const cameraDistance = ref(CAMERA_DISTANCE_DEFAULT);
	// 是否正在拖拽
	const isDragging = ref(false);
	const isBeadDragging = ref(false);
	const isBeadDeleteTarget = ref(false);
	// 拖拽起始信息
	const dragStart = ref({ x: 0, y: 0, rotY: 0 });
	// 惯性旋转速度（仅 Y 轴）
	let rotationVelocityY = 0;

	// ThreeJS相关对象
	let scene: THREE.Scene; // 场景
	let camera: THREE.PerspectiveCamera; // 摄像机
	let cameraAspect = 1;
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
	const removeAnimations: RemoveAnimation[] = [];
	let cameraAnimation: CameraAnimation | null = null;
	// 动画帧id
	let rafId = 0;
	// 指针是否按下（用于旋转）
	let pointerDown = false;
	let isPinching = false;
	let pinchStartDistance = 0;
	let pinchStartZoom = CAMERA_DISTANCE_DEFAULT;
	// 正在拖拽的珠子 id（用于排序/删除）
	let draggingBeadId: string | null = null;
	let dragBeadFromIndex = 0;
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressBeadId: string | null = null;
	let longPressStartX = 0;
	let longPressStartY = 0;
	// 是否已初始化
	let inited = false;
	let lastBeadsSnapshot: BraceletBead[] = [];
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
	let stageGlowTexture: THREE.CanvasTexture | null = null;
	let stageReflectionTexture: THREE.CanvasTexture | null = null;
	let environmentTexture: THREE.Texture | null = null;
	let pmremGenerator: THREE.PMREMGenerator | null = null;
	let showcaseSurfaceGroup: THREE.Group | null = null;
	let stageGlowMesh: THREE.Mesh | null = null;
	let stageReflectionMesh: THREE.Mesh | null = null;
	let targetRingRadius = getRingRadius(beads.value.length);
	let targetRingOpacity = 0.72;
	let lastInteractionTime = nowMs();
	let lastFrameTime = nowMs();
	let renderLoopPaused = false;

	function getAdaptivePixelRatio(beadCount = beads.value.length) {
		const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
		const qualityCap = beadCount >= 24 ? 1 : beadCount >= 16 ? 1.25 : 1.75;
		return Math.min(deviceRatio, qualityCap);
	}

	function applyAdaptiveQuality() {
		const count = beads.value.length;
		const minimalEffects = count >= 24;
		if (renderer) renderer.setPixelRatio(getAdaptivePixelRatio(count));
		if (stageReflectionMesh) stageReflectionMesh.visible = !minimalEffects;
	}

	function canRender() {
		return inited && !renderLoopPaused && (typeof document === 'undefined' || !document.hidden);
	}

	function stopRenderLoop() {
		if (!rafId) return;
		cancelAnimationFrame(rafId);
		rafId = 0;
	}

	function startRenderLoop() {
		if (!canRender() || rafId) return;
		lastFrameTime = nowMs();
		rafId = requestAnimationFrame(tick);
	}

	function pauseRendering() {
		renderLoopPaused = true;
		stopRenderLoop();
	}

	function resumeRendering() {
		renderLoopPaused = false;
		startRenderLoop();
	}

	function onVisibilityChange() {
		if (document.hidden) stopRenderLoop();
		else startRenderLoop();
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

	function setObjectOpacity(object: THREE.Object3D, opacity: number) {
		object.traverse((child) => {
			const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
			const materials = Array.isArray(material) ? material : material ? [material] : [];
			materials.forEach((mat) => {
				const transparentMaterial = mat as THREE.Material & { opacity?: number; transparent?: boolean; userData: Record<string, unknown> };
				if (transparentMaterial.opacity == null) return;
				if (transparentMaterial.userData.baseOpacity == null) {
					transparentMaterial.userData.baseOpacity = transparentMaterial.opacity;
				}
				transparentMaterial.transparent = true;
				transparentMaterial.opacity = Number(transparentMaterial.userData.baseOpacity) * opacity;
			});
		});
	}

	function disposeObject(object: THREE.Object3D) {
		object.traverse((child) => {
			const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
			const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
			geometry?.dispose?.();
			if (Array.isArray(material)) material.forEach((m) => m.dispose());
			else material?.dispose?.();
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
		params: Partial<THREE.MeshPhysicalMaterialParameters> = {},
		config?: Partial<CrystalPhysicalMaterialConfig> | null,
	) {
		const usesBaseColorMap = !!params.map;
		const opticalTransmission = Math.min(1, Math.max(0, config?.transmission ?? 0.5));
		const mappedRoughness = Math.min(0.38, Math.max(0.24, (config?.roughness ?? 0.22) * 0.55 + 0.18));
		const mappedClearcoat = Math.min(0.38, Math.max(0.24, 0.22 + opticalTransmission * 0.18));
		const mappedClearcoatRoughness = Math.min(0.4, Math.max(0.27, 0.39 - opticalTransmission * 0.15));
		const mappedReflectivity = Math.min(0.36, Math.max(0.28, 0.28 + opticalTransmission * 0.08));
		const mappedSpecularIntensity = Math.min(0.32, Math.max(0.2, 0.2 + opticalTransmission * 0.12));
		const mappedEnvironmentIntensity = Math.min(0.52, Math.max(0.4, 0.38 + opticalTransmission * 0.15));
		const material = new THREE.MeshPhysicalMaterial({
			color: usesBaseColorMap ? 0xffffff : config?.color ?? 0xe3dfeb,
			transparent: false,
			opacity: 1,
			roughness: usesBaseColorMap ? mappedRoughness : Math.max(config?.roughness ?? 0.25, 0.2),
			metalness: config?.metalness ?? 0.0,
			// 当前颜色图来自实拍/生成后的完整珠子外观，已经包含透光与明暗，不能再二次折射白色背景。
			transmission: usesBaseColorMap ? 0 : config?.transmission ?? 0.7,
			thickness: config?.thickness ?? 0.72,
			clearcoat: usesBaseColorMap ? mappedClearcoat : Math.min(config?.clearcoat ?? 0.42, 0.52),
			clearcoatRoughness: usesBaseColorMap ? mappedClearcoatRoughness : Math.max(config?.clearcoatRoughness ?? 0.28, 0.24),
			reflectivity: usesBaseColorMap ? mappedReflectivity : Math.min(config?.reflectivity ?? 0.42, 0.5),
			specularIntensity: usesBaseColorMap ? mappedSpecularIntensity : 0.42,
			specularColor: new THREE.Color(0xf4f7f5),
			ior: Math.max(config?.ior ?? 1.46, 1.42),
			envMapIntensity: usesBaseColorMap ? mappedEnvironmentIntensity : Math.min(config?.envMapIntensity ?? 0.82, 0.9),
			attenuationColor: new THREE.Color(config?.attenuationColor ?? 0xded8ea),
			attenuationDistance: config?.attenuationDistance ?? 2.2,
			...params,
		});
		const normalScale = usesBaseColorMap
			? Math.min(0.22, Math.max(0.1, (config?.normalScale ?? 0.5) * 0.25))
			: Math.min(config?.normalScale ?? 0.34, 0.44);
		material.normalScale.set(normalScale, normalScale);
		return material;
	}

	/** 参考图：阴影是左下方向的柔和拖尾，而不是规则圆斑 */
	function getShadowGradientTexture(): THREE.CanvasTexture | null {
		if (shadowGradientTexture) return shadowGradientTexture;
		if (typeof document === 'undefined') return null;
		const size = 192;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.clearRect(0, 0, size, size);
		ctx.translate(size / 2, size / 2);
		ctx.rotate(SHADOW_SLANT);
		ctx.scale(1, 0.72);

		const farGlow = ctx.createRadialGradient(-18, 16, 14, -10, 22, 92);
		farGlow.addColorStop(0, 'rgba(84, 80, 94, 0.105)');
		farGlow.addColorStop(0.22, 'rgba(76, 72, 86, 0.068)');
		farGlow.addColorStop(0.52, 'rgba(64, 60, 72, 0.022)');
		farGlow.addColorStop(0.82, 'rgba(56, 52, 62, 0.004)');
		farGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = farGlow;
		ctx.fillRect(-110, -92, 220, 184);

		const coreGlow = ctx.createRadialGradient(14, -8, 0, 18, -6, 58);
		coreGlow.addColorStop(0, 'rgba(88, 84, 98, 0.13)');
		coreGlow.addColorStop(0.24, 'rgba(78, 74, 88, 0.075)');
		coreGlow.addColorStop(0.58, 'rgba(64, 60, 72, 0.018)');
		coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = coreGlow;
		ctx.fillRect(-90, -74, 180, 148);
		shadowGradientTexture = new THREE.CanvasTexture(canvas);
		shadowGradientTexture.needsUpdate = true;
		return shadowGradientTexture;
	}

	function getStageGlowTexture(): THREE.CanvasTexture | null {
		if (stageGlowTexture) return stageGlowTexture;
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = 384;
		canvas.height = 224;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const glow = ctx.createRadialGradient(188, 110, 12, 188, 112, 174);
		glow.addColorStop(0, 'rgba(82, 121, 133, 0.18)');
		glow.addColorStop(0.28, 'rgba(208, 160, 157, 0.08)');
		glow.addColorStop(0.62, 'rgba(163, 178, 178, 0.025)');
		glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		stageGlowTexture = new THREE.CanvasTexture(canvas);
		stageGlowTexture.needsUpdate = true;
		return stageGlowTexture;
	}

	function getStageReflectionTexture(): THREE.CanvasTexture | null {
		if (stageReflectionTexture) return stageReflectionTexture;
		if (typeof document === 'undefined') return null;
		const canvas = document.createElement('canvas');
		canvas.width = 320;
		canvas.height = 96;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
		gradient.addColorStop(0, 'rgba(255,255,255,0)');
		gradient.addColorStop(0.34, 'rgba(255,255,255,0.34)');
		gradient.addColorStop(0.5, 'rgba(255,255,255,0.72)');
		gradient.addColorStop(0.66, 'rgba(255,255,255,0.34)');
		gradient.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const fade = ctx.createLinearGradient(0, 0, 0, canvas.height);
		fade.addColorStop(0, 'rgba(255,255,255,0)');
		fade.addColorStop(0.5, 'rgba(255,255,255,1)');
		fade.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.globalCompositeOperation = 'destination-in';
		ctx.fillStyle = fade;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.globalCompositeOperation = 'source-over';
		stageReflectionTexture = new THREE.CanvasTexture(canvas);
		stageReflectionTexture.needsUpdate = true;
		return stageReflectionTexture;
	}

	function createShowcaseSurface() {
		showcaseSurfaceGroup = new THREE.Group();
		const glowTexture = getStageGlowTexture();
		stageGlowMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(2.85, 1.65),
			new THREE.MeshBasicMaterial({
				map: glowTexture ?? undefined,
				color: glowTexture ? 0xffffff : 0xd9d5e2,
				transparent: true,
				opacity: STAGE_GLOW_BASE_OPACITY,
				depthWrite: false,
			}),
		);
		stageGlowMesh.rotation.x = -Math.PI / 2;
		stageGlowMesh.position.set(-0.1, -0.092, 0.08);
		stageGlowMesh.renderOrder = -3;
		stageGlowMesh.userData.baseOpacity = STAGE_GLOW_BASE_OPACITY;
		showcaseSurfaceGroup.add(stageGlowMesh);

		const reflectionTexture = getStageReflectionTexture();
		stageReflectionMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(1.92, 0.34),
			new THREE.MeshBasicMaterial({
				map: reflectionTexture ?? undefined,
				color: 0xffffff,
				transparent: true,
				opacity: STAGE_REFLECTION_BASE_OPACITY,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			}),
		);
		stageReflectionMesh.rotation.x = -Math.PI / 2;
		stageReflectionMesh.rotation.z = -0.06;
		stageReflectionMesh.position.set(0.12, -0.082, -0.08);
		stageReflectionMesh.renderOrder = -2;
		stageReflectionMesh.userData.baseOpacity = STAGE_REFLECTION_BASE_OPACITY;
		showcaseSurfaceGroup.add(stageReflectionMesh);
		scene.add(showcaseSurfaceGroup);
	}

	/**
	 * 计算第i个珠子的角度
	 * @param i - 当前索引
	 * @param total - 珠子总数
	 */
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

	/** 解析纹理 URL：优先用后端 API 基地址拼接；否则 H5 下 / 开头转同源绝对 URL */
	function resolveTextureUrl(url: string): string {
		if (url.startsWith('http')) return url;
		if (url.startsWith('/static/')) return url;
		if (RESOLVED_API_BASE && url.startsWith('/')) {
			const base = RESOLVED_API_BASE.replace(/\/$/, '');
			return base + url;
		}
		if (typeof window !== 'undefined' && url.startsWith('/')) return window.location.origin + url;
		return url;
	}

	function getAltTextureUrl(url: string): string | null {
		if (url.startsWith('/static/')) return url.slice(7);
		if (url.startsWith('/')) return '/static' + url;
		return null;
	}

	function configureTexture(tex: THREE.Texture, isColor = false) {
		// 素材是“圆珠置于方形画布”的正视图。只采样圆内中央区域，避免方图四角白底被包到球面形成白色缺口。
		tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
		tex.repeat.set(0.66, 0.66);
		tex.offset.set(0.17, 0.17);
		tex.magFilter = THREE.LinearFilter;
		tex.minFilter = THREE.LinearMipmapLinearFilter;
		tex.generateMipmaps = true;
		if (renderer?.capabilities) {
			tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		}
		if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
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
		onDone?: (tex: THREE.Texture | null) => void,
		isRetry = false,
	) {
		const cached = textureCache.get(url);
		if (cached) {
			onDone?.(cached);
			return;
		}
		if (url.startsWith('http')) textureLoader.setCrossOrigin('anonymous');
		textureLoader.load(
			resolveTextureUrl(url),
			(tex) => {
				configureTexture(tex, options.isColor);
				textureCache.set(url, tex);
				onDone?.(tex);
			},
			undefined,
			() => {
				if (!isRetry) {
					const alt = getAltTextureUrl(url);
					if (alt) {
						loadTextureAsset(alt, options, (tex) => {
							if (tex) textureCache.set(url, tex);
							onDone?.(tex);
						}, true);
						return;
					}
				}
				onDone?.(null);
			},
		);
	}

	/**
	 * 创建单个珠子mesh
	 * @param bead - 珠子数据
	 * @param index - 序号
	 * @param total - 总数
	 */
	function createBeadMesh(bead: BraceletBead, index: number, total: number) {
		const { x, z } = slotForIndex(index, total);
		const radius = bead.size * BEAD_SCALE * (isSingleLayout() ? SINGLE_BEAD_PREVIEW_SCALE : 1);
		const sphereSegments = getSphereSegments(total);
		const geometry = new THREE.SphereGeometry(radius, sphereSegments, sphereSegments);
		const imageUrl = bead.image?.trim();
		const renderConfig = getCrystalMaterialRenderConfig(bead.materialId);
		const textureUrls = imageUrl ? getTextureUrlsForBead(bead, imageUrl) : renderConfig?.maps;
		const hasTexture = !!(textureUrls?.map && (textureUrls.map.startsWith('http') || textureUrls.map.startsWith('/')));
		// 物理透射负责水晶的明暗与反光，避免 Alpha 混合把珠子压扁成塑料贴图。
		const material = createCrystalMaterial({}, renderConfig?.material);
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(0, BEAD_FLOAT_Y, 0);
		mesh.rotation.y = getBeadTextureRotation(bead.id);
		mesh.userData = { beadId: bead.id, radius, sphereSegments, textureBaseRotation: mesh.rotation.y };
		// 参考图：阴影是顺着左下方向被拉开的柔焦投影
		const shadowGroup = new THREE.Group();
		const gradientTex = getShadowGradientTexture();
		const shadowMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(radius * 3.55, radius * 2.65),
			new THREE.MeshBasicMaterial({
				map: gradientTex ?? undefined,
				transparent: true,
				opacity: gradientTex ? 0.56 : 0.052,
				depthWrite: false,
				color: gradientTex ? 0xffffff : SHADOW_TINT,
			}),
		);
		(shadowMesh.material as THREE.MeshBasicMaterial).userData.baseOpacity = gradientTex ? 0.56 : 0.052;
		shadowMesh.rotation.x = -Math.PI / 2;
		shadowMesh.rotation.z = SHADOW_SLANT;
		shadowMesh.position.set(-radius * 0.56, -radius * 1.05, radius * 0.22);
		shadowGroup.add(shadowMesh);
		const selectionGroup = new THREE.Group();
		const selectionGlowMaterial = new THREE.MeshBasicMaterial({
			color: 0xd0a09d,
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: false,
			blending: THREE.AdditiveBlending,
		});
		selectionGlowMaterial.userData.baseOpacity = 0.11;
		const selectionGlow = new THREE.Mesh(
			new THREE.CircleGeometry(radius * 1.55, 48),
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
		selectionRingMaterial.userData.baseOpacity = 0.42;
		const selectionRing = new THREE.Mesh(
			new THREE.RingGeometry(radius * 1.12, radius * 1.27, 64),
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
				const loadedParams: Partial<THREE.MeshPhysicalMaterialParameters> = {
					map,
				};
				let pending = optionalEntries.filter(([, url]) => !!url).length;
				if (pending === 0) {
					(material as THREE.Material).dispose();
					mesh.material = createCrystalMaterial(loadedParams, renderConfig?.material);
					return;
				}
				for (const [slot, url] of optionalEntries) {
					if (!url) continue;
					loadTextureAsset(url, { optional: true }, (tex) => {
						if (tex) {
							if (slot === 'roughnessMap') loadedParams.roughnessMap = tex;
							if (slot === 'normalMap') loadedParams.normalMap = tex;
						}
						pending -= 1;
						if (pending === 0 && mesh.parent) {
							(material as THREE.Material).dispose();
							mesh.material = createCrystalMaterial(loadedParams, renderConfig?.material);
						}
					});
				}
			});
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
		noteInteraction();
		const oldIds = new Set(oldBeads.map((b) => b.id));
		const newIds = new Set(newBeads.map((b) => b.id));
		const updateTime = nowMs();
		let addOrdinal = 0;

		// 移除被删掉的mesh
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

		// 添加或调整移动中的珠子
		const layoutMode = getLayoutMode();
		const ringR = layoutMode === 'single' ? 0.74 : getRingRadius(newBeads.length);
		newBeads.forEach((bead, index) => {
			const total = newBeads.length;
			const { x, z } = slotForIndex(index, total);

			if (beadMeshMap.has(bead.id)) {
				// 正在被拖拽的珠子不更新位置，由拖拽逻辑控制
				if (bead.id === draggingBeadId) return;
				// 更新已存在珠子的动画和缩放几何体
				const entry = beadMeshMap.get(bead.id)!;
				const { mesh, root } = entry;
				const curX = root.position.x;
				const curZ = root.position.z;
				const nextKey = beadContentKey(bead);
				if (entry.key !== nextKey) {
					const oldRoot = root;
					const replacement = createBeadMesh(bead, index, total);
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
				// 位置有变化时，触发动画平滑过渡
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
				// 仅在规格或自适应质量档变化时重建几何体，避免每次重排都分配 GPU 资源。
				const radius = bead.size * BEAD_SCALE * (isSingleLayout() ? SINGLE_BEAD_PREVIEW_SCALE : 1);
				root.userData.radius = radius;
				mesh.scale.setScalar(1);
				const sphereSegments = getSphereSegments(total);
				if (mesh.userData.radius !== radius || mesh.userData.sphereSegments !== sphereSegments) {
					mesh.geometry.dispose();
					mesh.geometry = new THREE.SphereGeometry(radius, sphereSegments, sphereSegments);
					mesh.userData.radius = radius;
					mesh.userData.sphereSegments = sphereSegments;
				}
				return;
			}

			// 新珠子，先 scale=0
			const { mesh, root } = createBeadMesh(bead, index, total);
			const fromX = layoutMode === 'single' ? x * 0.2 : x * 0.12;
			const fromZ = layoutMode === 'single' ? 1.04 : ringR + 1.08;
			const startDelay = oldIds.size === 0 ? index * ADD_STAGGER_MS : addOrdinal * Math.round(ADD_STAGGER_MS * 0.72);
			addOrdinal += 1;
			root.position.set(fromX, 0.24, fromZ);
			root.scale.setScalar(0.18);
			braceletGroup.add(root); /* 只加入手串 group，不加入 scene */
			beadMeshMap.set(bead.id, { mesh, root, beadId: bead.id, key: beadContentKey(bead) });
			addAnimations.push({
				mesh: root,
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

	/**
	 * 设置渲染尺寸与相机宽高比
	 */
	function setSize(width: number, height: number) {
		if (!renderer || !camera || !canvasEl) return;
		renderer.setPixelRatio(getAdaptivePixelRatio());
		renderer.setSize(width, height, false);
		cameraAspect = width / Math.max(height, 1);
		camera.aspect = cameraAspect;
		camera.updateProjectionMatrix();
		if (!cameraAnimation) applyCameraView();
	}

	function clampCameraDistance(next: number) {
		return Math.min(CAMERA_DISTANCE_MAX, Math.max(CAMERA_DISTANCE_MIN, next));
	}

	function getTouchDistance(touches: TouchList | Touch[]) {
		if (touches.length < 2) return 0;
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	}

	function setCameraDistance(next: number) {
		cameraDistance.value = clampCameraDistance(next);
		cameraAnimation = null;
		applyCameraView();
	}

	function getCameraPose(mode: 'top' | 'side') {
		// PerspectiveCamera 的横向视野会随 aspect 变窄。桌面双栏中的画布偏长，
		// 需要让相机适度后退，保证完整手串始终按画布短边取景。
		const aspectFit = Math.max(1, Math.min(1.7, 0.9 / Math.max(cameraAspect, 0.01)));
		const fittedDistance = cameraDistance.value * aspectFit;
		return mode === 'top'
			? {
					x: 0,
					y: fittedDistance,
					z: 0,
					upX: 0,
					upY: 0,
					upZ: -1,
				}
			: {
					x: 0.28,
					y: 1.48,
					z: fittedDistance * 0.94,
					upX: 0,
					upY: 1,
					upZ: 0,
				};
	}

	/** 根据当前视角设置相机位置与朝向 */
	function applyCameraView() {
		if (!camera) return;
		const pose = getCameraPose(viewMode.value);
		camera.position.set(pose.x, pose.y, pose.z);
		camera.up.set(pose.upX, pose.upY, pose.upZ);
		camera.lookAt(0, 0, 0);
	}

	/** 切换俯视 / 侧面视角 */
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

	/** 获取所有珠子 mesh（用于射线检测） */
	function getBeadMeshes(): THREE.Mesh[] {
		return Array.from(beadMeshMap.values()).map((b) => b.mesh);
	}

	function findBeadIdAtPointer(clientX: number, clientY: number): string | null {
		const meshes = getBeadMeshes();
		if (!meshes.length || !camera || !canvasEl) return null;
		pointerToNDC(clientX, clientY);
		raycaster.setFromCamera(mouseNDC, camera);
		const hits = raycaster.intersectObjects(meshes, false);
		if (hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
			const beadId = hits[0].object.userData?.beadId as string | undefined;
			if (beadId) return beadId;
		}

		const rect = canvasEl.getBoundingClientRect();
		const projected = new THREE.Vector3();
		let nearestId: string | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;
		beadMeshMap.forEach(({ root, beadId }) => {
			root.updateWorldMatrix(true, false);
			root.getWorldPosition(projected);
			projected.project(camera);
			if (projected.z < -1 || projected.z > 1) return;
			const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
			const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
			const distance = Math.hypot(clientX - screenX, clientY - screenY);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestId = beadId;
			}
		});
		return nearestDistance <= POINTER_PICK_TOLERANCE ? nearestId : null;
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
		let t = (angle - BEAD_START_ANGLE) / (2 * Math.PI);
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
	function tick() {
		rafId = 0;
		if (!canRender() || !scene || !camera || !renderer || !braceletGroup) return;
		const now = nowMs();
		const deltaMs = Math.min(34, Math.max(0, now - lastFrameTime || 16));
		lastFrameTime = now;

		// 处理珠子添加动画
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
		// 删除已结束动画
		toRemove.reverse().forEach((idx) => addAnimations.splice(idx, 1));

		// 处理珠子位置重排动画
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

		// 松手后仅 Y 轴惯性
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

		const scaleAnimated = new Set<THREE.Object3D>([
			...addAnimations.map((anim) => anim.mesh),
			...removeAnimations.map((anim) => anim.mesh),
		]);
		const positionAnimated = new Set<THREE.Object3D>([
			...addAnimations.map((anim) => anim.mesh),
			...positionAnimations.map((anim) => anim.mesh),
			...removeAnimations.map((anim) => anim.mesh),
		]);
		const currentSelectedBeadId = selectedBeadId?.() ?? null;
		beadMeshMap.forEach(({ mesh, root, beadId }, _, map) => {
			const isSelected = beadId === currentSelectedBeadId;
			const phase = Number(root.userData.phase ?? map.size) + now * 0.0011;
			const radius = Number(root.userData.radius ?? 0.14);
			const idleWave = Math.sin(phase * BEAD_IDLE_FLOAT_SPEED);
			const idleLift = (idleWave + 1) * 0.5 * BEAD_IDLE_FLOAT_Y;
			const idleScale = 1 + Math.sin(phase * 0.64) * BEAD_IDLE_SCALE;
			mesh.rotation.y = Number(mesh.userData.textureBaseRotation ?? 0) + Math.sin(phase * 0.31) * 0.16;
			mesh.rotation.x = Math.sin(phase) * 0.025;
			mesh.rotation.z = Math.sin(phase * 0.47) * 0.018;
			const shadowGroup = root.userData.shadowGroup as THREE.Group | undefined;
			if (shadowGroup) {
				const shadowLift = root.userData.dragActive ? 1 : isSelected ? 0.68 : idleLift / BEAD_IDLE_FLOAT_Y;
				shadowGroup.scale.setScalar(1 + shadowLift * 0.05);
				shadowGroup.children.forEach((child: any) => {
					const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
					if (!material) return;
					const baseOpacity = Number(material.userData.baseOpacity ?? material.opacity ?? 0.06);
					material.userData.baseOpacity = baseOpacity;
					material.opacity = baseOpacity * (1 - shadowLift * 0.24);
				});
			}
			const selectionGroup = root.userData.selectionGroup as THREE.Group | undefined;
			if (selectionGroup) {
				const targetStrength = root.userData.dragActive || isSelected ? 1 : 0;
				const currentStrength = Number(root.userData.selectionStrength ?? 0);
				const nextStrength = currentStrength + (targetStrength - currentStrength) * 0.28;
				root.userData.selectionStrength = nextStrength;
				selectionGroup.visible = nextStrength > 0.02;
				selectionGroup.scale.setScalar(0.94 + nextStrength * 0.14 + Math.sin(phase * 1.8) * 0.025 * nextStrength);
				selectionGroup.children.forEach((child: any, childIndex: number) => {
					const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
					if (!material) return;
					const baseOpacity = Number(material.userData.baseOpacity ?? 0.1);
					const pulse = 0.86 + Math.sin(phase * 1.35 + childIndex * 1.3) * 0.14;
					material.opacity = baseOpacity * nextStrength * pulse;
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
			const material = ringMesh.material as THREE.MeshPhysicalMaterial;
			material.opacity += (targetRingOpacity - material.opacity) * 0.18;
			ringMesh.visible = material.opacity > 0.012;
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
		if (showcaseSurfaceGroup) {
			showcaseSurfaceGroup.scale.setScalar(1 + (nextGroupScale - 1) * 0.68);
		}
		if (stageGlowMesh) {
			const material = stageGlowMesh.material as THREE.MeshBasicMaterial;
			material.opacity = STAGE_GLOW_BASE_OPACITY * stagePresence * (0.92 + (breatheWave + 1) * 0.04);
		}
		if (stageReflectionMesh) {
			const material = stageReflectionMesh.material as THREE.MeshBasicMaterial;
			material.opacity = STAGE_REFLECTION_BASE_OPACITY * stagePresence * (0.86 + (breatheWave + 1) * 0.09);
			stageReflectionMesh.position.x = 0.12 + Math.sin(breathePhase * 0.72) * 0.018;
		}

		// 仅 Y 轴旋转
		braceletGroup.rotation.y = rotationY.value;
		braceletGroup.rotation.x = 0;
		// 渲染
		renderer.render(scene, camera);
		// 递归下一帧
		startRenderLoop();
	}

	/** 截图时同步渲染并立即读取，无需常驻 preserveDrawingBuffer。 */
	function captureImage(type = 'image/png', quality = 0.92): string | null {
		if (!inited || !renderer || !scene || !camera || !canvasEl) return null;
		renderer.render(scene, camera);
		return canvasEl.toDataURL(type, quality);
	}

	/**
	 * 鼠标/触摸 按下事件：优先检测是否点中珠子（拖拽排序/删除），否则旋转手串
	 */
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

	function onPointerDown(e: PointerEvent | Touch) {
		if ('pointerType' in e && e.pointerType === 'touch') return;
		noteInteraction();
		const clientX = (e as { clientX: number }).clientX;
		const clientY = (e as { clientY: number }).clientY;
		if (onReorder || onRemove || onLongPress) {
			const beadId = findBeadIdAtPointer(clientX, clientY);
			if (beadId) {
				draggingBeadId = beadId;
				onSelect?.(beadId);
				dragBeadFromIndex = beads.value.findIndex((b) => b.id === beadId);
				if (dragBeadFromIndex < 0) draggingBeadId = null;
				else {
					setDraggedAppearance(beadId, true);
					isDragging.value = true;
					setBeadDragState(true);
					dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
					startLongPressTimer(beadId, clientX, clientY);
					return;
				}
			}
		}
		clearLongPressTimer();
		setBeadDragState(false);
		pointerDown = true;
		isDragging.value = true;
		dragStart.value = { x: clientX, y: clientY, rotY: rotationY.value };
	}

	/**
	 * 鼠标/触摸 移动事件
	 */
	function onPointerMove(e: PointerEvent | Touch) {
		if ('pointerType' in e && e.pointerType === 'touch') return;
		noteInteraction();
		const clientX = (e as { clientX: number }).clientX;
		const clientY = (e as { clientY: number }).clientY;
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

	/**
	 * 鼠标/触摸 松开事件：环外视为删除；未删除且未改序时珠子回原位
	 */
	function onPointerUp() {
		noteInteraction();
		clearLongPressTimer();
		if (draggingBeadId) {
			const releasedBeadId = draggingBeadId;
			setDraggedAppearance(releasedBeadId, false);
			const meshEntry = beadMeshMap.get(draggingBeadId);
			if (meshEntry) {
				const dist = Math.sqrt(meshEntry.root.position.x ** 2 + meshEntry.root.position.z ** 2);
				const deleteRadius = getDeleteDistance();
				// 珠子拖到环外即视为删除
				if (dist > deleteRadius && onRemove) {
					onRemove(draggingBeadId);
					draggingBeadId = null;
					pointerDown = false;
					isDragging.value = false;
					setBeadDragState(false);
					return;
				}
			}
					// 未删除：先清空拖拽标记再强制同步，使该珠子参与位置更新并动画回槽位
			draggingBeadId = null;
			setBeadDragState(false);
			onSelect?.(null);
			if (braceletGroup) updateBeads(beads.value, beads.value);
		}
		pointerDown = false;
		isDragging.value = false;
		if (!draggingBeadId) setBeadDragState(false);
	}

	function onTouchStart(e: TouchEvent) {
		e.preventDefault();
		if (e.touches.length >= 2) {
			if (draggingBeadId) onPointerUp();
			pointerDown = false;
			isPinching = true;
			pinchStartDistance = getTouchDistance(e.touches);
			pinchStartZoom = cameraDistance.value;
			return;
		}
		if (e.touches.length === 1) {
			isPinching = false;
			onPointerDown(e.touches[0]);
		}
	}

	function onTouchMove(e: TouchEvent) {
		e.preventDefault();
		if (isPinching && e.touches.length >= 2) {
			const distance = getTouchDistance(e.touches);
			if (pinchStartDistance > 0 && distance > 0) {
				const delta = pinchStartDistance - distance;
				setCameraDistance(pinchStartZoom + delta * PINCH_ZOOM_SPEED);
			}
			return;
		}
		if (e.touches.length === 1) onPointerMove(e.touches[0]);
	}

	function onTouchEnd(e: TouchEvent) {
		if (isPinching) {
			if (e.touches.length >= 2) {
				pinchStartDistance = getTouchDistance(e.touches);
				pinchStartZoom = cameraDistance.value;
				return;
			}
			isPinching = false;
			if (e.touches.length === 1) {
				pointerDown = true;
				isDragging.value = true;
				dragStart.value = {
					x: e.touches[0].clientX,
					y: e.touches[0].clientY,
					rotY: rotationY.value,
				};
				return;
			}
		}
		onPointerUp();
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		noteInteraction();
		setCameraDistance(cameraDistance.value + e.deltaY * WHEEL_ZOOM_SPEED);
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
		cameraAspect = width / Math.max(height, 1);

		// 创建threejs基本对象
		scene = new THREE.Scene();
		// 保持 WebGL 背景透明，让同一套 CSS 摄影棚渐变同时服务 H5 与小程序，并让导出图保留 Alpha。
		scene.background = null;

		camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
		applyCameraView();

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
		renderer.setPixelRatio(getAdaptivePixelRatio());
		renderer.setSize(width, height, false);
		renderer.setClearColor(0x000000, 0);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 0.94;
		pmremGenerator = new THREE.PMREMGenerator(renderer);
		environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.065).texture;
		scene.environment = environmentTexture;

		// 以环境反射和柔和方向光塑形，避免点光源在每颗珠子上形成相同的白色圆斑。
		const ambient = new THREE.AmbientLight(0xffffff, 0.26);
		scene.add(ambient);
		const key = new THREE.DirectionalLight(0xfffdf8, 0.42);
		key.position.set(-3.2, 4.2, 2.6);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0xe5f0ef, 0.18);
		fill.position.set(2.8, 1.6, 2.2);
		scene.add(fill);
		const rim = new THREE.DirectionalLight(0xdbe8ee, 0.12);
		rim.position.set(0.4, 2.1, -3.4);
		scene.add(rim);
		// 创建手串Group（珠子/环都放到group中场景里只加group）
		braceletGroup = new THREE.Group();
		scene.add(braceletGroup);
		createShowcaseSurface();
		/* 珠子和圆环都只加到手串 group，不往 scene 直接加珠子，保证添加的珠子只在手串上 */

		// 创建圆环 mesh（几何半径 1，用 scale 控制实际半径）
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
		(ringMesh.material as THREE.MeshPhysicalMaterial).opacity = targetRingOpacity;
		ringMesh.visible = targetRingOpacity > 0;
		braceletGroup.add(ringMesh);

		// 启动初始珠子渲染
		updateBeads(beads.value, []);
		lastBeadsSnapshot = snapshotBeads(beads.value);

		// 禁用用户选择和默认手势，绑定交互事件
		canvas.style.touchAction = 'none';
		canvas.style.userSelect = 'none';
		// 绑定PC端指针事件
		canvas.addEventListener('pointerdown', onPointerDown as EventListener);
		canvas.addEventListener('pointermove', onPointerMove as EventListener);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointerleave', onPointerUp);
		canvas.addEventListener('wheel', onWheel, { passive: false });
		canvas.addEventListener('touchstart', onTouchStart, { passive: false });
		canvas.addEventListener('touchmove', onTouchMove, { passive: false });
		canvas.addEventListener('touchend', onTouchEnd);
		canvas.addEventListener('touchcancel', onTouchEnd);

		// 标记已初始化，启动动画循环
		inited = true;
		document.addEventListener('visibilitychange', onVisibilityChange);
		startRenderLoop();

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
		clearLongPressTimer();
		stopRenderLoop();
		document.removeEventListener('visibilitychange', onVisibilityChange);
		resizeObserver?.disconnect();
		resizeObserver = null;
		// 移除事件绑定
		if (canvasEl) {
			canvasEl.removeEventListener('pointerdown', onPointerDown as EventListener);
			canvasEl.removeEventListener('pointermove', onPointerMove as EventListener);
			canvasEl.removeEventListener('pointerup', onPointerUp);
			canvasEl.removeEventListener('pointerleave', onPointerUp);
			canvasEl.removeEventListener('wheel', onWheel);
			canvasEl.removeEventListener('touchstart', onTouchStart);
			canvasEl.removeEventListener('touchmove', onTouchMove);
			canvasEl.removeEventListener('touchend', onTouchEnd);
			canvasEl.removeEventListener('touchcancel', onTouchEnd);
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
		stageGlowTexture?.dispose();
		stageGlowTexture = null;
		stageReflectionTexture?.dispose();
		stageReflectionTexture = null;
		environmentTexture?.dispose();
		environmentTexture = null;
		showcaseSurfaceGroup?.traverse((child) => {
			const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
			const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
			geometry?.dispose?.();
			if (Array.isArray(material)) material.forEach((m) => m.dispose());
			else material?.dispose?.();
		});
		showcaseSurfaceGroup = null;
		stageGlowMesh = null;
		stageReflectionMesh = null;
		pmremGenerator?.dispose();
		pmremGenerator = null;
		addAnimations.length = 0;
		positionAnimations.length = 0;
		removeAnimations.length = 0;
		cameraAnimation = null;
		// 释放环mesh内存
		ringMesh?.geometry?.dispose();
		(ringMesh?.material as THREE.Material)?.dispose();
		renderer?.dispose();
		canvasEl = null;
	}

	// 监听beads数据变化，重建/重排珠子
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
		cameraDistance,
		setViewMode,
		setCameraDistance,
		isDragging,
		isBeadDragging,
		isBeadDeleteTarget,
		pauseRendering,
		resumeRendering,
		captureImage,
	};
}
