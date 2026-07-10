<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Material, MaterialSpec } from '@/types';
import { useDesignStore } from '@/stores/design';
import { resolveStaticUrl } from '@/utils/staticUrl';

const props = defineProps<{
	material: Material;
	spec?: MaterialSpec;
	usedCount?: number;
}>();

const designStore = useDesignStore();
const suppressNextTap = ref(false);
const emit = defineEmits<{
	(e: 'preview', payload: { material: Material; spec: MaterialSpec; image: string }): void;
	(e: 'add', payload: { material: Material; spec: MaterialSpec; image: string; point: { x: number; y: number } | null }): void;
}>();

const displaySpec = computed(() => props.spec ?? props.material.specs[0] ?? { size: 6, price: 0 });
const imageSrc = computed(() => resolveStaticUrl(props.material.image));
const hasUsedCount = computed(() => typeof props.usedCount === 'number' && props.usedCount > 0);
const usedSpecCount = computed(() => {
	const spec = displaySpec.value;
	return designStore.braceletDesign.filter(
		(bead) => bead.materialId === props.material.id && bead.size === spec.size && bead.price === spec.price,
	).length;
});
const isUsedSpec = computed(() => usedSpecCount.value > 0);
const isRecentAction = computed(() => {
	const action = designStore.lastBeadAction;
	if (!action || action.materialId !== props.material.id || action.size !== displaySpec.value.size) return false;
	return Date.now() - action.at < 1500;
});

function getTapPoint(event?: any) {
	const touch = event?.changedTouches?.[0] ?? event?.touches?.[0];
	const x = Number(touch?.clientX ?? event?.clientX ?? event?.detail?.x);
	const y = Number(touch?.clientY ?? event?.clientY ?? event?.detail?.y);
	return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function addOrReplace(event?: any) {
	if (suppressNextTap.value) {
		suppressNextTap.value = false;
		return;
	}
	const spec = displaySpec.value;
	designStore.addBead(props.material, spec, 1);
	emit('add', {
		material: props.material,
		spec,
		image: imageSrc.value,
		point: getTapPoint(event),
	});
	try {
		uni.vibrateShort?.({ type: 'light' });
	} catch {}
}

function openPhotoPreview() {
	suppressNextTap.value = true;
	emit('preview', {
		material: props.material,
		spec: displaySpec.value,
		image: imageSrc.value,
	});
}
</script>

<template>
	<view
		class="material-card"
		:class="{ 'material-card--used': isUsedSpec, 'material-card--recent': isRecentAction }"
		@tap="addOrReplace"
		@longpress.stop="openPhotoPreview"
		@contextmenu.prevent.stop="openPhotoPreview"
	>
		<view v-if="hasUsedCount" class="material-card__used-badge">已用 {{ usedCount }} 颗</view>
		<view v-if="imageSrc" class="material-card__img-wrap">
			<image class="material-card__img" :src="imageSrc" mode="aspectFill" />
		</view>
		<view class="material-card__name">{{ material.name }}</view>
		<view class="material-card__specs">
			<text class="spec-size">{{ displaySpec.size }}mm</text>
			<text class="spec-divider"> - </text>
			<text class="spec-price">¥{{ displaySpec.price }}</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.material-card {
	position: relative;
	overflow: hidden;
	background: rgba(255, 255, 255, 0.96);
	border-radius: 12rpx;
	padding: 17rpx 12rpx 14rpx;
	border: 1rpx solid rgba(218, 222, 231, 0.96);
	box-shadow: 0 6rpx 16rpx rgba(73, 79, 96, 0.08);
	transition:
		box-shadow u.$duration-state u.$ease-brand,
		background u.$duration-state u.$ease-brand,
		transform u.$duration-press u.$ease-out;
}

.material-card::after {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	width: 132rpx;
	height: 132rpx;
	border-radius: 50%;
	background: rgba(37, 40, 48, 0.12);
	opacity: 0;
	transform: translate(-50%, -50%) scale(0.48);
	pointer-events: none;
	z-index: 0;
}

/* 图中产品卡 hover：阴影略增强、背景略灰 */
.material-card:hover {
	box-shadow: 0 8rpx 20rpx rgba(73, 79, 96, 0.11);
	background: rgba(255, 255, 255, 0.99);
}

.material-card:active {
	transform: scale(0.98);
	transition-duration: u.$duration-release;
}

.material-card--used {
	border-color: rgba(204, 210, 222, 0.95);
	background: linear-gradient(180deg, rgba(236, 238, 244, 0.94), rgba(222, 226, 235, 0.86));
	box-shadow:
		inset 0 1rpx 0 rgba(255, 255, 255, 0.68),
		0 6rpx 14rpx rgba(64, 72, 96, 0.09);
}

.material-card--used .material-card__img-wrap {
	box-shadow:
		0 6rpx 16rpx rgba(72, 80, 104, 0.16),
		inset 0 0 0 2rpx rgba(255, 255, 255, 0.84);
}

.material-card--recent {
	animation: recent-card-pulse 1.05s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.material-card--recent::after {
	animation: material-card-ripple 0.72s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.material-card__used-badge {
	position: absolute;
	top: 8rpx;
	right: 8rpx;
	height: 30rpx;
	padding: 0 10rpx;
	border-radius: 999rpx;
	background: rgba(255, 97, 117, 0.92);
	box-shadow: 0 4rpx 10rpx rgba(255, 97, 117, 0.22);
	color: #fff;
	font-size: 18rpx;
	font-weight: 800;
	line-height: 30rpx;
	white-space: nowrap;
	z-index: 2;
}

.material-card__img-wrap {
	width: 86rpx;
	height: 86rpx;
	border-radius: 50%;
	overflow: hidden;
	background:
		radial-gradient(circle at 35% 28%, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0) 36rpx),
		linear-gradient(135deg, #f1eef7 0%, #e8f0ec 100%);
	box-shadow: 0 5rpx 14rpx rgba(113, 119, 148, 0.12);
	margin: 0 auto 12rpx;
	position: relative;
	z-index: 1;
}

.material-card__img {
	width: 100%;
	height: 100%;
}

/* 珠子名称：图中约 15–17px 加粗 */
.material-card__name {
	font-size: 28rpx;
	font-weight: 800;
	color: #26314f;
	margin-bottom: 6rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	text-align: center;
	white-space: nowrap;
	position: relative;
	z-index: 1;
}

/* 尺寸与价格：图中约 13–15px，价格略粗 */
.material-card__specs {
	font-size: 24rpx;
	color: #6f778d;
	text-align: center;
	position: relative;
	z-index: 1;
}

.spec-size {
	font-weight: 400;
}

.spec-divider {
	font-weight: 400;
}

.spec-price {
	font-weight: 900;
	color: #273149;
}

@keyframes recent-card-pulse {
	0% {
		transform: scale(0.98);
	}
	18% {
		transform: scale(1.018);
	}
	100% {
		transform: scale(1);
	}
}

@keyframes material-card-ripple {
	0% {
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.36);
	}
	18% {
		opacity: 1;
	}
	100% {
		opacity: 0;
		transform: translate(-50%, -50%) scale(1.22);
	}
}
</style>
