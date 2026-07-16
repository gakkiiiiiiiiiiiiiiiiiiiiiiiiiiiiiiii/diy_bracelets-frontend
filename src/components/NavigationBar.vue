<script setup lang="ts">
import { onMounted } from 'vue'
import { useContentStore } from '@/stores/content'
import BrandIcon from '@/components/BrandIcon.vue'

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
      <view class="nav-btn" aria-label="返回" @tap="onBack">
        <BrandIcon class="nav-icon nav-icon--back" name="arrow-left" tone="inverse" />
      </view>
    </view>
    <view class="nav-title">{{ contentStore.diy.pageTitle }}</view>
    <view class="nav-right nav-capsule">
      <view class="nav-capsule__btn" @tap="onMore">
        <BrandIcon class="nav-icon" name="ellipsis" tone="inverse" label="更多" />
      </view>
      <view class="nav-capsule__divider" />
      <view class="nav-capsule__btn" @tap="emit('secondary')">
        <BrandIcon class="nav-icon" name="minus" tone="inverse" label="缩小" />
      </view>
      <view class="nav-capsule__divider" />
      <view class="nav-capsule__btn" @tap="emit('center')">
        <BrandIcon class="nav-icon" name="locate-fixed" tone="inverse" label="居中" />
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
  background: rgba(7, 15, 27, 0.94);
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
  color: #f4f7fb;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.42);
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
  border: 1rpx solid rgba(225, 234, 244, 0.42);
  background: rgba(13, 24, 39, 0.72);
  box-shadow: 0 8rpx 22rpx rgba(0, 0, 0, 0.28);
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
  background: rgba(225, 234, 244, 0.3);
}

.nav-btn:active {
  transform: scale(0.97);
  transition-duration: u.$duration-release;
}

.nav-icon {
	width: 32rpx;
	height: 32rpx;
}

.nav-icon--back {
	width: 40rpx;
	height: 40rpx;
}
</style>
