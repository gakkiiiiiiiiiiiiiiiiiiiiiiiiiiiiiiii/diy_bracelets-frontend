<script setup lang="ts">
withDefaults(
	defineProps<{
		type?: 'delete' | 'save' | 'primary';
		tone?: 'default' | 'danger';
		icon: string;
		label: string;
		disabled?: boolean;
	}>(),
	{ type: 'primary', tone: 'default', disabled: false },
);

const emit = defineEmits<{ click: [] }>();
</script>

<template>
	<view
		class="action-btn"
		:class="[`action-btn--${type}`, `action-btn--tone-${tone}`, { 'action-btn--disabled': disabled }]"
		@tap="emit('click')"
	>
		<view class="action-btn__icon" :class="`action-btn__icon--${type}`">
			<view v-if="type === 'delete' || icon === 'stack' || icon === '▰'" class="stack-icon">
				<view class="stack-icon__layer" />
				<view class="stack-icon__layer" />
				<view class="stack-icon__layer" />
			</view>
			<view v-else-if="type === 'save' || icon === 'save' || icon === '▣'" class="save-icon">
				<view class="save-icon__slot" />
				<view class="save-icon__dot" />
			</view>
			<view v-else-if="icon === 'single'" class="single-icon">
				<view class="single-icon__head" />
				<view class="single-icon__stem" />
				<view class="single-icon__tip" />
			</view>
			<view v-else class="cart-icon">
				<view class="cart-icon__basket" />
				<view class="cart-icon__wheel cart-icon__wheel--left" />
				<view class="cart-icon__wheel cart-icon__wheel--right" />
			</view>
		</view>
		<text v-if="label" class="action-btn__label">{{ label }}</text>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.action-btn {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	height: 54rpx;
	padding: 0 20rpx;
	min-width: 112rpx;
	border-radius: 16rpx;
	box-shadow: 0 6rpx 16rpx rgba(66, 76, 103, 0.16);
	transition:
		transform u.$duration-press u.$ease-out,
		box-shadow u.$duration-press u.$ease-out;
}

.action-btn:active {
	transform: scale(0.97);
	transition-duration: u.$duration-release;
}

.action-btn--disabled {
	opacity: 0.5;
	pointer-events: none;
}

.action-btn--primary.action-btn--disabled {
	opacity: 1;
}

.action-btn--delete {
	background: linear-gradient(180deg, #fff 0%, #fff9f5 100%);
	color: #273149;
	border: 3rpx solid #273149;
}

.action-btn--save {
	background: linear-gradient(135deg, #ff6175 0%, #e24962 100%);
	color: #fff;
	border: 3rpx solid #d9485f;
	box-shadow: 0 7rpx 18rpx rgba(218, 72, 95, 0.28);
}

.action-btn--primary {
	background: linear-gradient(180deg, #fff 0%, #f7fbff 100%);
	color: #2d354c;
	border: 3rpx solid #2d354c;
}

.action-btn--primary.action-btn--tone-danger {
	background: linear-gradient(180deg, #fff 0%, #fff8f9 100%);
	color: #d9485f;
	border-color: #d9485f;
	box-shadow: 0 7rpx 18rpx rgba(217, 72, 95, 0.2);
}

.action-btn__icon {
	width: 34rpx;
	height: 34rpx;
	position: relative;
	flex-shrink: 0;
}

.action-btn__label {
	font-size: 28rpx;
	font-weight: 800;
	white-space: nowrap;
}

.stack-icon {
	width: 34rpx;
	height: 34rpx;
	position: relative;
}

.stack-icon__layer {
	position: absolute;
	left: 3rpx;
	width: 28rpx;
	height: 7rpx;
	background: currentColor;
	border-radius: 2rpx;
	transform: skewY(-22deg) rotate(-20deg);
	transform-origin: left center;
}

.stack-icon__layer:nth-child(1) {
	top: 6rpx;
}

.stack-icon__layer:nth-child(2) {
	top: 14rpx;
}

.stack-icon__layer:nth-child(3) {
	top: 22rpx;
}

.save-icon {
	position: absolute;
	inset: 2rpx;
	border-radius: 4rpx;
	background: currentColor;
}

.save-icon__slot {
	position: absolute;
	left: 7rpx;
	top: 6rpx;
	width: 15rpx;
	height: 7rpx;
	border-radius: 2rpx;
	background: #fff;
}

.save-icon__dot {
	position: absolute;
	right: 5rpx;
	bottom: 5rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background: #fff;
}

.single-icon {
	position: absolute;
	inset: 2rpx;
	transform: rotate(7deg);
}

.single-icon__head {
	position: absolute;
	left: 2rpx;
	top: 3rpx;
	width: 17rpx;
	height: 17rpx;
	border: 5rpx solid currentColor;
	border-radius: 5rpx;
	box-sizing: border-box;
}

.single-icon__stem {
	position: absolute;
	left: 16rpx;
	top: 9rpx;
	width: 13rpx;
	height: 6rpx;
	border-radius: 999rpx;
	background: currentColor;
}

.single-icon__tip {
	position: absolute;
	left: 22rpx;
	top: 3rpx;
	width: 8rpx;
	height: 22rpx;
	border-radius: 999rpx 999rpx 3rpx 3rpx;
	background: currentColor;
	transform: rotate(38deg);
	transform-origin: 50% 80%;
}

.cart-icon {
	position: absolute;
	inset: 1rpx 0 0;
}

.cart-icon::before {
	content: '';
	position: absolute;
	left: 2rpx;
	top: 4rpx;
	width: 8rpx;
	height: 4rpx;
	border-radius: 2rpx;
	background: currentColor;
	transform: rotate(8deg);
}

.cart-icon__basket {
	position: absolute;
	left: 8rpx;
	top: 9rpx;
	width: 23rpx;
	height: 16rpx;
	border: 5rpx solid currentColor;
	border-top-width: 4rpx;
	transform: skewX(-8deg);
}

.cart-icon__wheel {
	position: absolute;
	bottom: 1rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background: currentColor;
}

.cart-icon__wheel--left {
	left: 11rpx;
}

.cart-icon__wheel--right {
	right: 3rpx;
}
</style>
