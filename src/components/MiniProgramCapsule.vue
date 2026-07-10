<template>
	<view class="mini-capsule" aria-hidden="true">
		<view class="mini-capsule__menu">
			<view class="mini-capsule__dot" />
			<view class="mini-capsule__dot" />
			<view class="mini-capsule__dot" />
		</view>
		<view class="mini-capsule__divider" />
		<view class="mini-capsule__minimize">
			<view class="mini-capsule__dash" />
		</view>
		<view class="mini-capsule__divider" />
		<view class="mini-capsule__close">
			<view class="mini-capsule__ring" />
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

.mini-capsule__menu {
	gap: 7rpx;
}

.mini-capsule__dot {
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #111318;
}

.mini-capsule__divider {
	width: 1rpx;
	height: 32rpx;
	background: rgba(23, 25, 31, 0.12);
}

.mini-capsule__dash {
	width: 20rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: #111318;
}

.mini-capsule__ring {
	width: 27rpx;
	height: 27rpx;
	border: 5rpx solid #111318;
	border-radius: 50%;
	box-sizing: border-box;
	position: relative;
}

.mini-capsule__ring::after {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	width: 9rpx;
	height: 9rpx;
	border-radius: 50%;
	background: #111318;
	transform: translate(-50%, -50%);
}
</style>
