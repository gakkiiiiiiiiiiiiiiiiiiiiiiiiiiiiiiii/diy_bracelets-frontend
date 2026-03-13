<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDesignStore } from '@/stores/design';
import { useUIStore } from '@/stores/ui';
// #ifdef H5
import { useBracelet3d } from '@/composables/useBracelet3d';
// #endif
// #ifdef MP-WEIXIN
import { useBracelet3dMp } from '@/composables/useBracelet3dMp';
// #endif

// 使用手链设计相关的 Pinia store
const designStore = useDesignStore();
// 使用 UI 状态相关的 Pinia store
const uiStore = useUIStore();

// 计算属性：当前设计的珠子数组（reactive 响应式）
const beads = computed(() => designStore.braceletDesign);

// #ifdef H5
// 3D 画布容器 DOM 元素绑定（仅 H5 下生效），传入拖拽排序与拖出删除回调
const canvas3dContainer = ref<HTMLElement | null>(null);
const { viewMode, setViewMode } = useBracelet3d(canvas3dContainer, beads, {
	onReorder: (from, to) => designStore.reorderBeads(from, to),
	onRemove: (id) => {
		designStore.removeBead(id);
		uiStore.setSelectedBeadId(null);
	},
});
// #endif

// #ifdef MP-WEIXIN
// 微信小程序端 3D（threejs-miniprogram），支持拖拽排序与拖出删除
const mp3d = useBracelet3dMp('#bracelet-gl', beads, {
	onReorder: (from, to) => designStore.reorderBeads(from, to),
	onRemove: (id) => {
		designStore.removeBead(id);
		uiStore.setSelectedBeadId(null);
	},
});
// #endif
</script>

<template>
	<view class="canvas-wrap">
		<!-- #ifdef H5 -->
		<view class="canvas-3d">
			<view ref="canvas3dContainer" class="canvas-3d__gl" />
			<view class="canvas-3d-hint">拖拽旋转手串</view>
			<view class="canvas-3d-view-toggle">
				<!-- <view
					class="view-toggle-btn"
					:class="{ 'view-toggle-btn--active': viewMode === 'top' }"
					@click="setViewMode('top')"
				>
					俯视
				</view> -->
				<!-- <view
					class="view-toggle-btn"
					:class="{ 'view-toggle-btn--active': viewMode === 'side' }"
					@click="setViewMode('side')"
				>
					侧面
				</view> -->
			</view>
			<view class="canvas-center canvas-center--overlay">
				<text class="canvas-brand">养个石头</text>
				<text class="canvas-sub">MineStone</text>
			</view>
		</view>
		<!-- #endif -->

		<!-- #ifdef MP-WEIXIN -->
		<view
			class="canvas-3d canvas-3d--mp"
			@touchstart="mp3d.onTouchStart"
			@touchmove="mp3d.onTouchMove"
			@touchend="mp3d.onTouchEnd"
			@touchcancel="mp3d.onTouchCancel"
		>
			<canvas id="bracelet-gl" type="webgl" class="canvas-3d__gl canvas-3d__gl-mp" />
			<view class="canvas-3d-hint">拖拽旋转手串</view>
			<view class="canvas-3d-view-toggle" @touchstart.stop>
				<!-- <view
					class="view-toggle-btn"
					:class="{ 'view-toggle-btn--active': mp3d.viewMode?.value === 'top' }"
					@tap.stop="mp3d.setViewMode('top')"
				>
					俯视
				</view>
				<view
					class="view-toggle-btn"
					:class="{ 'view-toggle-btn--active': mp3d.viewMode?.value === 'side' }"
					@tap.stop="mp3d.setViewMode('side')"
				>
					侧面
				</view> -->
			</view>
			<view class="canvas-center canvas-center--overlay">
				<text class="canvas-brand">养个石头</text>
				<text class="canvas-sub">MineStone</text>
			</view>
		</view>
		<!-- #endif -->
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

/* 主要外部容器：正方形保证手串为正圆不变形，宽度撑满无两侧边距 */
.canvas-wrap {
	position: relative;
	width: 100%;
	aspect-ratio: 1;
	margin: 0 auto;
}

/* 3D 展示区样式（H5 专用） */
.canvas-3d {
	position: absolute;
	inset: 0;
	border-radius: 28rpx;
	overflow: hidden;
	background: radial-gradient(
		circle at 50% 32%,
		rgba(255, 255, 255, 0.96) 0%,
		rgba(248, 246, 250, 0.92) 42%,
		rgba(239, 237, 241, 0.98) 100%
	);
	box-shadow:
		inset 0 1rpx 0 rgba(255, 255, 255, 0.95),
		0 22rpx 48rpx rgba(170, 165, 175, 0.14);
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

/* 3D 操作提示（底部居中） */
.canvas-3d-hint {
	position: absolute;
	bottom: 16rpx;
	left: 50%;
	transform: translateX(-50%);
	font-size: 22rpx;
	color: u.$text-caption;
	pointer-events: none;
}

/* 3D 视角切换：俯视 / 侧面 */
.canvas-3d-view-toggle {
	position: absolute;
	top: 16rpx;
	right: 16rpx;
	display: flex;
	gap: 8rpx;
	z-index: 2;
}

.view-toggle-btn {
	padding: 10rpx 20rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	color: u.$text-caption;
	background: u.$glass-bg;
	border: 1px solid u.$hairline;
	transition:
		background 0.2s,
		color 0.2s;
}

.view-toggle-btn--active {
	color: u.$primary;
	background: rgba(255, 255, 255, 0.95);
	border-color: u.$primary;
}

.canvas-center--overlay {
	pointer-events: none;
	filter: drop-shadow(0 4rpx 10rpx rgba(191, 186, 196, 0.22));
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

/* 品牌主标题样式 */
.canvas-brand {
	font-weight: 700;
	font-size: 28rpx;
	letter-spacing: -0.02em;
	color: #b7b1bc;
	text-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.9);
}

/* 品牌副标题样式 */
.canvas-sub {
	font-size: 20rpx;
	color: #c3bec8;
	opacity: 0.95;
	margin-top: 4rpx;
}
</style>
