<script setup lang="ts">
withDefaults(
	defineProps<{
		type?: 'delete' | 'save' | 'primary';
		icon: string;
		label: string;
		disabled?: boolean;
	}>(),
	{ type: 'primary', disabled: false },
);

const emit = defineEmits<{ click: [] }>();
</script>

<template>
	<view
		class="action-btn"
		:class="[`action-btn--${type}`, { 'action-btn--disabled': disabled }]"
		@click="emit('click')"
	>
		<text class="action-btn__icon">{{ icon }}</text>
		<text v-if="type !== 'delete' && label" class="action-btn__label">{{ label }}</text>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.action-btn {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	padding: 10rpx 28rpx;
	// min-height: 72rpx;
	min-width: 60rpx;
	border-radius: 30rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
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

.action-btn--delete {
	background: #fff;
	color: u.$text-primary;
	border: 4rpx solid #1d1d1f;
}

.action-btn--save {
	background: #ff3b30;
	color: #fff;
	border: none;
}

.action-btn--primary {
	background: #fff;
	color: #333;
	border: 4rpx solid rgba(0, 0, 0, 0.2);
}

.action-btn__icon {
	font-size: 36rpx;
	line-height: 1;
}

.action-btn__label {
	font-size: 20rpx;
	font-weight: 500;
}
</style>
