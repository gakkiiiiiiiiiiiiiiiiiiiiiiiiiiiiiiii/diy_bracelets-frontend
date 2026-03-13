<script setup lang="ts">
import { useMaterialsStore } from '@/stores/materials'

const materialsStore = useMaterialsStore()

function onInput(e: { detail: { value: string } }) {
  materialsStore.setSearchKeyword(e.detail.value || '')
}
</script>

<template>
  <view class="search-bar">
    <view class="search-tool-btn">
      <text class="search-tool-icon">⬡</text>
    </view>
    <view class="search-input-wrap">
      <text class="search-icon">⌕</text>
      <input
        class="search-input"
        type="text"
        placeholder="白水晶/玛瑙/..."
        :value="materialsStore.searchKeyword"
        @input="onInput"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
}

.search-tool-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: u.$secondary-bg;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform u.$duration-press u.$ease-out;
}

.search-tool-btn:active {
  transform: scale(0.97);
  transition-duration: u.$duration-release;
}

.search-tool-icon {
  font-size: 36rpx;
  color: u.$text-primary;
}

.search-input-wrap {
  flex: 1;
  height: 72rpx;
  background: u.$input-bg;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  gap: 16rpx;
}

.search-input-wrap:focus-within {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 4rpx rgba(0, 113, 227, 0.3);
}

.search-icon {
  font-size: 32rpx;
  color: u.$text-caption;
}

.search-input {
  flex: 1;
  font-size: 30rpx;
  color: u.$text-primary;
  height: 100%;
}
</style>
