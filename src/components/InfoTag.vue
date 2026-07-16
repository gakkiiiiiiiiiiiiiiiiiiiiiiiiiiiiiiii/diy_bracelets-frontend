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
  border: 1rpx solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 8rpx 22rpx rgba(83, 90, 116, 0.13);
  transition: transform u.$duration-state u.$ease-brand, opacity u.$duration-state u.$ease-out;
}

.info-tag--default {
  background: rgba(242, 244, 250, 0.88);
  color: #7f879a;
}

.info-tag--warn {
  background: rgba(255, 246, 234, 0.9);
  color: #98704b;
}

.info-tag--warn.info-tag--shake {
  animation: info-tag-shake 0.2s u.$ease-in-out 2;
}

.info-tag--primary {
  background: rgba(210, 232, 239, 0.82);
  color: #3c6d7e;
}

.info-tag--notice {
  background: linear-gradient(135deg, #ff5e73 0%, #d9485f 100%);
  color: #fff;
  border-radius: 16rpx;
  border-color: rgba(255, 255, 255, 0.38);
  box-shadow: 0 10rpx 22rpx rgba(210, 80, 100, 0.28);
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
