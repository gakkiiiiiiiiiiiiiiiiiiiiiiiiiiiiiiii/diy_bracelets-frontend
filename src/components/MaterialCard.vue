<script setup lang="ts">
import { computed } from 'vue';
import type { Material } from '@/types';
import { useDesignStore } from '@/stores/design';
import { resolveStaticUrl } from '@/utils/staticUrl';

const props = defineProps<{
	material: Material;
}>();

const designStore = useDesignStore();

const defaultSpec = computed(() => props.material.specs[0] || { size: 6, price: 0 });
const imageSrc = computed(() => resolveStaticUrl(props.material.image));

function addOne() {
	designStore.addBead(props.material, defaultSpec.value, 1);
	uni.showToast({ title: '已添加', icon: 'success', duration: 800 });
}

function showSpecPicker() {
	const items = props.material.specs.map((s) => `${s.size}mm - ¥${s.price}`);
	uni.showActionSheet({
		itemList: items,
		success: (res) => {
			const spec = props.material.specs[res.tapIndex];
			designStore.addBead(props.material, spec, 1);
			uni.showToast({ title: '已添加', icon: 'success', duration: 800 });
		},
	});
}
</script>

<template>
	<view class="material-card" @click="showSpecPicker">
		<view v-if="imageSrc" class="material-card__img-wrap">
			<image class="material-card__img" :src="imageSrc" mode="aspectFill" />
		</view>
		<view class="material-card__name">{{ material.name }}</view>
		<view class="material-card__specs">
			<text class="spec-size">{{ defaultSpec.size }}mm</text>
			<text class="spec-divider"> - </text>
			<text class="spec-price">¥{{ defaultSpec.price }}</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.material-card {
	background: #fff;
	border-radius: u.$radius-card;
	padding: 20rpx;
	border: 1px solid rgba(0, 0, 0, 0.06);
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
	transition:
		box-shadow u.$duration-state u.$ease-brand,
		background u.$duration-state u.$ease-brand,
		transform u.$duration-press u.$ease-out;
}

/* 图中产品卡 hover：阴影略增强、背景略灰 */
.material-card:hover {
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
	background: #fafafa;
}

.material-card:active {
	transform: scale(0.98);
	transition-duration: u.$duration-release;
}

.material-card__img-wrap {
	width: 100%;
	aspect-ratio: 1;
	border-radius: 50%;
	overflow: hidden;
	background: u.$input-bg;
	margin-bottom: 16rpx;
}

.material-card__img {
	width: 100%;
	height: 100%;
}

/* 珠子名称：图中约 15–17px 加粗 */
.material-card__name {
	font-size: 22rpx;
	font-weight: 600;
	color: u.$text-primary;
	margin-bottom: 10rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	text-align: center;
	white-space: nowrap;
}

/* 尺寸与价格：图中约 13–15px，价格略粗 */
.material-card__specs {
	font-size: 28rpx;
	color: u.$text-caption;
}

.spec-size {
	font-weight: 400;
}

.spec-divider {
	font-weight: 400;
}

.spec-price {
	font-weight: 600;
	color: u.$text-primary;
}
</style>
