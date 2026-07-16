<script setup lang="ts">
import { computed } from 'vue';
import BrandIcon, { type BrandIconName } from '@/components/BrandIcon.vue';

const emit = defineEmits<{ click: [] }>();

const props = withDefaults(
	defineProps<{
		type?: 'delete' | 'save' | 'primary';
		tone?: 'default' | 'danger';
		icon: string;
		iconTone?: 'brand' | 'inverse' | 'rose' | 'muted';
		label: string;
		disabled?: boolean;
	}>(),
	{ type: 'primary', tone: 'default', disabled: false },
);

const iconName = computed<BrandIconName>(() => {
	if (props.type === 'delete' || props.icon === 'layers-3') return 'layers-3';
	if (props.type === 'save' || props.icon === 'save') return 'save';
	if (props.icon === 'wand-sparkles') return 'wand-sparkles';
	if (props.icon === 'single') return 'circle-dot';
	return 'shopping-bag';
});

const iconTone = computed(() => {
	if (props.iconTone) return props.iconTone;
	if (props.disabled) return 'muted' as const;
	if (props.type === 'save') return 'rose' as const;
	if (props.type === 'primary') return 'inverse' as const;
	return 'brand' as const;
});
</script>

<template>
	<view
		class="action-btn"
		:class="[`action-btn--${type}`, `action-btn--tone-${tone}`, { 'action-btn--disabled': disabled }]"
		@tap="emit('click')"
	>
		<BrandIcon class="action-btn__icon" :name="iconName" :tone="iconTone" />
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
	flex-shrink: 0;
}

.action-btn__label {
	font-size: 28rpx;
	font-weight: 800;
	white-space: nowrap;
}

</style>
