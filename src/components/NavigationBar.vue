<script setup lang="ts">
import { onMounted } from 'vue'
import { useContentStore } from '@/stores/content'

const contentStore = useContentStore()

const emit = defineEmits<{
  back: []
  reset: []
  saveToList: []
  share: []
  help: []
  secondary: []
  center: []
}>()

onMounted(() => {
  void contentStore.fetchContent()
})

function goHome() {
  uni.switchTab({
    url: '/pages/home/home',
    fail: () => {
      uni.reLaunch({ url: '/pages/home/home' })
    },
  })
}

function canNavigateBack() {
  try {
    return getCurrentPages().length > 1
  } catch {
    return true
  }
}

function onBack() {
  if (canNavigateBack()) {
    uni.navigateBack({ fail: goHome })
  } else {
    goHome()
  }
  emit('back')
}

function onMore() {
  uni.showActionSheet({
    itemList: ['分享', '保存到我的设计', '重置设计', '使用帮助'],
    success: (res) => {
      if (res.tapIndex === 0) {
        emit('share')
      } else if (res.tapIndex === 1) {
        emit('saveToList')
      } else if (res.tapIndex === 2) {
        emit('reset')
      } else if (res.tapIndex === 3) {
        emit('help')
      }
    },
  })
}
</script>

<template>
  <view class="nav-bar">
    <view class="nav-left">
      <view class="nav-btn" @tap="onBack">
        <text class="nav-icon nav-icon--back">‹</text>
      </view>
    </view>
    <view class="nav-title">{{ contentStore.diy.pageTitle }}</view>
    <view class="nav-right nav-capsule">
      <view class="nav-capsule__btn" @tap="onMore">
        <text class="nav-icon">⋯</text>
      </view>
      <view class="nav-capsule__divider" />
      <view class="nav-capsule__btn" @tap="emit('secondary')">
        <text class="nav-icon">−</text>
      </view>
      <view class="nav-capsule__divider" />
      <view class="nav-capsule__btn" @tap="emit('center')">
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
  height: 86rpx;
  padding: 0 16rpx;
  padding-top: calc(40rpx + env(safe-area-inset-top));
  position: relative;
  z-index: 10;
  background: rgba(250, 248, 245, 0.92);
  backdrop-filter: blur(14rpx);
  flex-shrink: 0;
}

.nav-left,
.nav-right {
  display: flex;
  align-items: center;
  min-width: 170rpx;
}

.nav-right {
  justify-content: flex-end;
}

.nav-title {
  font-weight: 700;
  font-size: 34rpx;
  letter-spacing: 0;
  color: #1d292b;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.78);
}

.nav-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: transparent;
  transition: transform u.$duration-press u.$ease-out;
}

.nav-capsule {
  width: 234rpx;
  height: 64rpx;
  min-width: 234rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(82, 121, 133, 0.16);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 6rpx 18rpx rgba(82, 121, 133, 0.1);
  overflow: hidden;
}

.nav-capsule__btn {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-capsule__divider {
  width: 1rpx;
  height: 32rpx;
  background: rgba(82, 121, 133, 0.28);
}

.nav-btn:active {
  transform: scale(0.97);
  transition-duration: u.$duration-release;
}

.nav-icon {
  font-size: 42rpx;
  color: #527985;
  line-height: 1;
  font-weight: 700;
}

.nav-icon--back {
  font-size: 68rpx;
  font-weight: 300;
}
</style>
