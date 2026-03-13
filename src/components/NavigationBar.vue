<script setup lang="ts">
const emit = defineEmits<{
  back: []
  reset: []
  saveToList: []
  secondary: []
  center: []
}>()

function onBack() {
  uni.navigateBack({ fail: () => {} })
  emit('back')
}

function onMore() {
  uni.showActionSheet({
    itemList: ['分享', '保存到我的设计', '重置设计', '使用帮助'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // #ifdef MP-WEIXIN
        uni.showToast({ title: '请点击右上角分享', icon: 'none' })
        // #endif
      } else if (res.tapIndex === 1) {
        emit('saveToList')
      } else if (res.tapIndex === 2) {
        emit('reset')
      } else if (res.tapIndex === 3) {
        uni.showToast({ title: '使用帮助开发中', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="nav-bar">
    <view class="nav-left">
      <view class="nav-btn" @click="onBack">
        <text class="nav-icon">‹</text>
      </view>
    </view>
    <view class="nav-title">养个石头</view>
    <view class="nav-right">
      <view class="nav-btn" @click="onMore">
        <text class="nav-icon">⋯</text>
      </view>
      <view class="nav-btn" @click="emit('secondary')">
        <text class="nav-icon">−</text>
      </view>
      <view class="nav-btn" @click="emit('center')">
        <text class="nav-icon">⊙</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  padding-top: calc(88rpx + env(safe-area-inset-top));
  position: relative;
  z-index: 10;
}

.nav-left,
.nav-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 160rpx;
}

.nav-right {
  justify-content: flex-end;
}

.nav-title {
  font-weight: 700;
  font-size: 36rpx;
  letter-spacing: -0.02em;
  color: u.$text-primary;
}

.nav-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  transition: transform u.$duration-press u.$ease-out;
}

.nav-btn:active {
  transform: scale(0.97);
  transition-duration: u.$duration-release;
}

.nav-icon {
  font-size: 44rpx;
  color: u.$text-primary;
  line-height: 1;
}
</style>
