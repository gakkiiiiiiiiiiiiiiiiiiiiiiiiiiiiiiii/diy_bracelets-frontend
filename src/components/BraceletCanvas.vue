<script setup lang="ts">
import { ref, computed, watch, onMounted, type Ref } from 'vue';
import { useDesignStore } from '@/stores/design';
import { useContentStore } from '@/stores/content';
import { useUIStore } from '@/stores/ui';
import type { BraceletBead } from '@/types';
// #ifdef H5
import { useBracelet3d } from '@/composables/useBracelet3d';
// #endif
// #ifdef MP-WEIXIN
import { useBracelet3dMp } from '@/composables/useBracelet3dMp';
// #endif

const props = withDefaults(
	defineProps<{
		viewMode?: 'top' | 'side';
		mode?: 'bracelet' | 'single';
	}>(),
	{ viewMode: 'side', mode: 'bracelet' },
);
const emit = defineEmits<{
	beadPreview: [beadId: string];
}>();

// 使用手链设计相关的 Pinia store
const designStore = useDesignStore();
const contentStore = useContentStore();
// 使用 UI 状态相关的 Pinia store
const uiStore = useUIStore();

function createPreviewBeads(rows: Array<[string, string, string, number]>, prefix: string): BraceletBead[] {
	return rows.map(([materialId, name, slug, size], index) => ({
		id: `${prefix}-${index}`,
		materialId: String(materialId),
		name: String(name),
		image: `/static/materials/reference-crystals/${slug}/${slug}-preview.png`,
		size: Number(size),
		price: 0,
		quantity: 1,
		orderIndex: index,
	}));
}

const emptyBraceletStageBeads = createPreviewBeads([
	['ref-blue-moonstone', '蓝月光', 'blue-moonstone', 10],
	['ref-aquamarine-ice', '海蓝宝冰种', 'aquamarine-ice', 9],
	['ref-yellow-crystal', '黄水晶', 'yellow-crystal', 10],
	['ref-golden-rutile', '金发晶', 'golden-rutile', 9],
	['ref-strawberry-crystal', '草莓晶', 'strawberry-crystal', 10],
	['ref-rose-stone', '蔷薇石', 'rose-stone', 9],
	['ref-green-phantom', '绿幽灵', 'green-phantom', 10],
	['ref-prehnite', '葡萄石', 'prehnite', 9],
	['ref-larimar', '海纹石', 'larimar', 10],
	['ref-amazonite', '天河石', 'amazonite', 9],
	['ref-bolivian-amethyst', '玻利维亚紫', 'bolivian-amethyst', 10],
	['ref-uruguay-amethyst', '乌拉圭紫', 'uruguay-amethyst', 9],
], 'empty-bracelet-stage');

const emptySingleStageBeads = createPreviewBeads([
	['ref-strawberry-crystal', '草莓晶', 'strawberry-crystal', 12],
	['ref-blue-moonstone', '蓝月光', 'blue-moonstone', 10],
	['ref-uruguay-amethyst', '乌拉圭紫', 'uruguay-amethyst', 12],
], 'empty-single-stage');

// 计算属性：当前设计的珠子数组（reactive 响应式）；空设计时显示 3D 预览珠阵。
const hasActualBeads = computed(() => designStore.braceletDesign.length > 0);
const emptyStageBeads = computed(() => (props.mode === 'single' ? emptySingleStageBeads : emptyBraceletStageBeads));
const emptyTitle = computed(() => (props.mode === 'single' ? '3D 单珠' : contentStore.diy.canvasTitle));
const emptySub = computed(() => (props.mode === 'single' ? '挑选第一颗散珠' : contentStore.diy.canvasHint));
const beads = computed(() => (hasActualBeads.value ? designStore.braceletDesign : emptyStageBeads.value));
let rendererBeadDragging: Ref<boolean> | null = null;
let rendererBeadDeleteTarget: Ref<boolean> | null = null;

onMounted(() => {
	void contentStore.fetchContent();
});

function withActualBeads(callback: () => void) {
	if (!hasActualBeads.value) return;
	callback();
}

// #ifdef H5
// 3D 画布容器 DOM 元素绑定（仅 H5 下生效），传入拖拽排序与拖出删除回调
const canvas3dContainer = ref<HTMLElement | null>(null);
const h5Renderer = useBracelet3d(canvas3dContainer, beads, {
	layoutMode: () => props.mode,
	onReorder: (from, to) => withActualBeads(() => designStore.reorderBeads(from, to)),
	onSelect: (id) => uiStore.setSelectedBeadId(hasActualBeads.value ? id : null),
	selectedBeadId: () => (hasActualBeads.value ? uiStore.selectedBeadId : null),
	onLongPress: (id) => withActualBeads(() => emit('beadPreview', id)),
	onRemove: (id) => {
		if (!hasActualBeads.value) return;
		designStore.removeBead(id);
		uiStore.setSelectedBeadId(null);
	},
});
rendererBeadDragging = h5Renderer.isBeadDragging;
rendererBeadDeleteTarget = h5Renderer.isBeadDeleteTarget;
const { setViewMode } = h5Renderer;

watch(
	() => props.viewMode,
	(mode) => setViewMode(mode),
	{ immediate: true },
);
// #endif

// #ifdef MP-WEIXIN
// 微信小程序端 3D（threejs-miniprogram），支持拖拽排序与拖出删除
const mp3d = useBracelet3dMp('#bracelet-gl', beads, {
	layoutMode: () => props.mode,
	onReorder: (from, to) => withActualBeads(() => designStore.reorderBeads(from, to)),
	onSelect: (id) => uiStore.setSelectedBeadId(hasActualBeads.value ? id : null),
	selectedBeadId: () => (hasActualBeads.value ? uiStore.selectedBeadId : null),
	onLongPress: (id) => withActualBeads(() => emit('beadPreview', id)),
	onRemove: (id) => {
		if (!hasActualBeads.value) return;
		designStore.removeBead(id);
		uiStore.setSelectedBeadId(null);
	},
});
rendererBeadDragging = mp3d.isBeadDragging;
rendererBeadDeleteTarget = mp3d.isBeadDeleteTarget;

watch(
	() => props.viewMode,
	(mode) => mp3d.setViewMode(mode),
	{ immediate: true },
);
// #endif

const dragHintVisible = computed(() => hasActualBeads.value && props.mode === 'bracelet' && Boolean(rendererBeadDragging?.value));
const dragDeleteActive = computed(() => Boolean(rendererBeadDeleteTarget?.value));
const dragHintTitle = computed(() => (dragDeleteActive.value ? '松手删除' : '拖出圈外删除'));
const dragHintSub = computed(() => (dragDeleteActive.value ? '移回圆圈可取消' : '拖回圆圈可调整顺序'));

function pauseRendering() {
	// #ifdef H5
	h5Renderer.pauseRendering();
	// #endif
	// #ifdef MP-WEIXIN
	mp3d.pauseRendering();
	// #endif
}

function resumeRendering() {
	// #ifdef H5
	h5Renderer.resumeRendering();
	// #endif
	// #ifdef MP-WEIXIN
	mp3d.resumeRendering();
	// #endif
}

function captureImage(type = 'image/png', quality = 0.92): string | null {
	let image: string | null = null;
	// #ifdef H5
	image = h5Renderer.captureImage(type, quality);
	// #endif
	return image;
}

defineExpose({ pauseRendering, resumeRendering, captureImage });
</script>

<template>
	<view class="canvas-wrap">
		<view class="canvas-stage">
		<!-- #ifdef H5 -->
			<view class="canvas-3d" :class="{ 'canvas-3d--empty': !hasActualBeads, 'canvas-3d--single': mode === 'single' }">
				<view ref="canvas3dContainer" class="canvas-3d__gl" />
				<view class="canvas-center canvas-center--overlay">
					<text class="canvas-brand">{{ contentStore.brand.name }}</text>
					<text class="canvas-sub">{{ contentStore.brand.nameEn }}</text>
			</view>
				<view v-if="!hasActualBeads" class="canvas-empty-mark">
					<text class="canvas-empty-mark__title">{{ emptyTitle }}</text>
					<text class="canvas-empty-mark__sub">{{ emptySub }}</text>
				</view>
				<view
					v-if="dragHintVisible"
					class="drag-delete-hint"
					:class="{ 'drag-delete-hint--delete': dragDeleteActive }"
				>
					<text class="drag-delete-hint__title">{{ dragHintTitle }}</text>
					<text class="drag-delete-hint__sub">{{ dragHintSub }}</text>
				</view>
			</view>
			<!-- #endif -->

		<!-- #ifdef MP-WEIXIN -->
		<view
			class="canvas-3d canvas-3d--mp"
			:class="{ 'canvas-3d--empty': !hasActualBeads, 'canvas-3d--single': mode === 'single' }"
			@touchstart="mp3d.onTouchStart"
			@touchmove="mp3d.onTouchMove"
			@touchend="mp3d.onTouchEnd"
			@touchcancel="mp3d.onTouchCancel"
		>
			<canvas id="bracelet-gl" type="webgl" class="canvas-3d__gl canvas-3d__gl-mp" />
			<cover-view class="canvas-center canvas-center--overlay canvas-center--mp">
					<cover-view class="canvas-brand">{{ contentStore.brand.name }}</cover-view>
					<cover-view class="canvas-sub">{{ contentStore.brand.nameEn }}</cover-view>
			</cover-view>
				<cover-view v-if="!hasActualBeads" class="canvas-empty-mark canvas-empty-mark--mp">
					<cover-view class="canvas-empty-mark__title">{{ emptyTitle }}</cover-view>
					<cover-view class="canvas-empty-mark__sub">{{ emptySub }}</cover-view>
				</cover-view>
				<cover-view
					v-if="dragHintVisible"
					class="drag-delete-hint drag-delete-hint--mp"
					:class="{ 'drag-delete-hint--delete': dragDeleteActive }"
				>
					<cover-view class="drag-delete-hint__title">{{ dragHintTitle }}</cover-view>
					<cover-view class="drag-delete-hint__sub">{{ dragHintSub }}</cover-view>
				</cover-view>
			</view>
			<!-- #endif -->
		</view>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

/* 主要外部容器：正方形保证手串为正圆不变形，宽度撑满无两侧边距 */
.canvas-wrap {
	position: relative;
	width: 100%;
	height: 100%;
	margin: 0 auto;
}

.canvas-stage {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 0;
}

/* 3D 展示区样式（H5 专用） */
.canvas-3d {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	border-radius: 0;
	overflow: hidden;
	background:
		radial-gradient(ellipse 72% 56% at 38% 28%, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.72) 42%, rgba(255, 255, 255, 0) 76%),
		radial-gradient(ellipse 58% 34% at 68% 78%, rgba(202, 214, 212, 0.14) 0%, rgba(202, 214, 212, 0) 72%),
		linear-gradient(148deg, #f7f3ed 0%, #fffdf9 48%, #f1eee9 100%);
	box-shadow: none;
}

.canvas-3d--empty {
	background:
		radial-gradient(ellipse 74% 58% at 38% 28%, #fff 0%, rgba(255, 255, 255, 0.72) 44%, rgba(255, 255, 255, 0) 78%),
		linear-gradient(148deg, #f7f3ed 0%, #fffdf9 50%, #f0ede8 100%);
}

/* 3D gl 画布容器 */
.canvas-3d__gl {
	display: block;
	width: 100%;
	height: 100%;
	touch-action: none;
	border-radius: inherit;
}

/* 小程序 WebGL canvas 需占满容器 */
.canvas-3d__gl-mp {
	width: 100%;
	height: 100%;
	border-radius: inherit;
}

.canvas-center--overlay {
	pointer-events: none;
	filter: drop-shadow(0 4rpx 10rpx rgba(82, 121, 133, 0.14));
}

.canvas-center--mp {
	width: 220rpx;
}


/* 内层中心品牌文本定位（3D  overlay 内使用） */
.canvas-center {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	pointer-events: none;
}

.canvas-3d--single .canvas-center {
	top: 57%;
	opacity: 0.72;
}

/* 品牌主标题样式 */
.canvas-brand {
	font-weight: 700;
	font-size: 30rpx;
	letter-spacing: 0;
	color: rgba(82, 121, 133, 0.68);
	text-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.9);
}

/* 品牌副标题样式 */
.canvas-sub {
	font-size: 22rpx;
	font-weight: 700;
	color: rgba(208, 160, 157, 0.78);
	opacity: 0.95;
	margin-top: 0;
}

.canvas-empty-mark {
	position: absolute;
	left: 50%;
	top: calc(50% + 96rpx);
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	pointer-events: none;
}

.canvas-3d--single .canvas-empty-mark {
	top: calc(57% + 62rpx);
}

.canvas-empty-mark--mp {
	width: 260rpx;
}

.canvas-empty-mark__title {
	color: rgba(59, 85, 92, 0.92);
	font-size: 24rpx;
	font-weight: 900;
	line-height: 1.2;
}

.canvas-empty-mark__sub {
	margin-top: 6rpx;
	color: rgba(108, 113, 110, 0.76);
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1.2;
}

.drag-delete-hint {
	position: absolute;
	left: 50%;
	bottom: 34rpx;
	transform: translateX(-50%);
	min-width: 238rpx;
	padding: 14rpx 22rpx;
	border-radius: 999rpx;
	background: rgba(62, 88, 95, 0.9);
	box-shadow:
		0 18rpx 42rpx rgba(18, 22, 34, 0.18),
		inset 0 1rpx 0 rgba(255, 255, 255, 0.18);
	display: flex;
	flex-direction: column;
	align-items: center;
	pointer-events: none;
	z-index: 12;
	animation: drag-hint-in 0.16s ease-out both;
}

.drag-delete-hint--mp {
	width: 286rpx;
	box-sizing: border-box;
}

.drag-delete-hint--delete {
	background: rgba(164, 91, 94, 0.94);
	box-shadow:
		0 18rpx 42rpx rgba(164, 91, 94, 0.22),
		inset 0 1rpx 0 rgba(255, 255, 255, 0.2);
}

.drag-delete-hint__title {
	color: #fff;
	font-size: 24rpx;
	font-weight: 900;
	line-height: 1.15;
	text-align: center;
	white-space: nowrap;
}

.drag-delete-hint__sub {
	margin-top: 4rpx;
	color: rgba(255, 255, 255, 0.78);
	font-size: 18rpx;
	font-weight: 800;
	line-height: 1.15;
	text-align: center;
	white-space: nowrap;
}

@keyframes drag-hint-in {
	from {
		opacity: 0;
		transform: translate(-50%, 8rpx) scale(0.96);
	}
	to {
		opacity: 1;
		transform: translate(-50%, 0) scale(1);
	}
}
</style>
