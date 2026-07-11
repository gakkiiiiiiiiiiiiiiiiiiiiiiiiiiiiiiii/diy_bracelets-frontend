<script setup lang="ts">
import BrandIcon from '@/components/BrandIcon.vue';
</script>

<template>
	<view class="mini-capsule" aria-hidden="true">
		<view class="mini-capsule__menu">
			<BrandIcon class="mini-capsule__icon" name="ellipsis" />
		</view>
		<view class="mini-capsule__divider" />
		<view class="mini-capsule__minimize">
			<BrandIcon class="mini-capsule__icon mini-capsule__icon--small" name="minus" />
		</view>
		<view class="mini-capsule__divider" />
		<view class="mini-capsule__close">
			<BrandIcon class="mini-capsule__icon" name="locate-fixed" />
		</view>
	</view>
</template>

<style lang="scss" scoped>
.mini-capsule {
	position: fixed;
	top: calc(22rpx + env(safe-area-inset-top));
	right: 28rpx;
	z-index: 120;
	width: 216rpx;
	height: 62rpx;
	border: 1rpx solid rgba(23, 25, 31, 0.1);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 8rpx 22rpx rgba(21, 23, 31, 0.08);
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	backdrop-filter: blur(12rpx);
}

.mini-capsule__menu,
.mini-capsule__minimize,
.mini-capsule__close {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.mini-capsule__menu,
.mini-capsule__close {
	width: 72rpx;
}

.mini-capsule__minimize {
	width: 50rpx;
}

.mini-capsule__divider {
	width: 1rpx;
	height: 32rpx;
	background: rgba(23, 25, 31, 0.12);
}

.mini-capsule__icon {
	width: 30rpx;
	height: 30rpx;
}

.mini-capsule__icon--small {
	width: 26rpx;
	height: 26rpx;
}
</style>
