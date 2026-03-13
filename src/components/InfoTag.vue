<script setup lang="ts">
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
    <text class="info-tag__label">{{ label }}</text>
  </view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.info-tag {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  transition: transform u.$duration-state u.$ease-brand, opacity u.$duration-state u.$ease-out;
}

.info-tag--default {
  background: u.$secondary-bg;
  color: u.$text-primary;
}

.info-tag--warn {
  background: rgba(200, 80, 80, 0.12);
  color: #a63d3d;
}

.info-tag--warn.info-tag--shake {
  animation: info-tag-shake 0.2s u.$ease-in-out 2;
}

.info-tag--primary {
  background: rgba(0, 113, 227, 0.12);
  color: u.$primary;
}

.info-tag--notice {
  background: #ff3b30;
  color: #fff;
}

.info-tag__label {
  font-weight: 400;
}

@keyframes info-tag-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(3rpx); }
  50% { transform: translateX(0); }
  75% { transform: translateX(-3rpx); }
}
</style>
