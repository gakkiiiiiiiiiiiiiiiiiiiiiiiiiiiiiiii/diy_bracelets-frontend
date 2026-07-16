<script setup lang="ts">
import BrandIcon from '@/components/BrandIcon.vue'

withDefaults(
  defineProps<{
    type?: 'default' | 'warn' | 'primary' | 'notice'
    label: string
    shake?: boolean
  }>(),
  { type: 'default', shake: false }
)
</script>

<template>
  <view class="info-tag" :class="[`info-tag--${type}`, { 'info-tag--shake': shake && type === 'warn' }]">
    <BrandIcon v-if="type === 'notice'" class="info-tag__mark" name="circle-help" tone="inverse" />
    <text class="info-tag__label">{{ label }}</text>
  </view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.info-tag {
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  border: 1rpx solid rgba(224, 233, 244, 0.2);
  box-shadow: 0 8rpx 22rpx rgba(0, 0, 0, 0.22);
  transition: transform u.$duration-state u.$ease-brand, opacity u.$duration-state u.$ease-out;
}

.info-tag--default {
  background: rgba(47, 57, 72, 0.88);
  color: #d3d9e2;
}

.info-tag--warn {
  background: rgba(65, 69, 77, 0.94);
  color: #f0d7c8;
}

.info-tag--warn.info-tag--shake {
  animation: info-tag-shake 0.2s u.$ease-in-out 2;
}

.info-tag--primary {
  background: rgba(42, 53, 68, 0.9);
  color: #dce8f4;
}

.info-tag--notice {
  background: linear-gradient(135deg, #f15045 0%, #d83932 100%);
  color: #fff;
  border-radius: 16rpx;
  border-color: rgba(255, 255, 255, 0.38);
  box-shadow: 0 10rpx 22rpx rgba(216, 57, 50, 0.3);
}

.info-tag__label {
  font-weight: 700;
  white-space: nowrap;
}

.info-tag__mark {
  width: 28rpx;
  height: 28rpx;
}

@keyframes info-tag-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(3rpx); }
  50% { transform: translateX(0); }
  75% { transform: translateX(-3rpx); }
}
</style>
