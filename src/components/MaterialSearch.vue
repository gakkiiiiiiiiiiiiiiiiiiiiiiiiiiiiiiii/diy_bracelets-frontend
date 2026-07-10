<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMaterialsStore } from '@/stores/materials'

const materialsStore = useMaterialsStore()
const emit = defineEmits<{
  (event: 'tool'): void
}>()
const searchFocused = ref(false)
const hasKeyword = computed(() => materialsStore.searchKeyword.trim().length > 0)
const isSearchActive = computed(() => searchFocused.value || hasKeyword.value)
const placeholderText = computed(() => (isSearchActive.value ? '白水晶/玛瑙/...' : '搜索'))

function onInput(e: { detail: { value: string } }) {
  materialsStore.setSearchKeyword(e.detail.value || '')
}

function onFocus() {
  searchFocused.value = true
}

function onBlur() {
  searchFocused.value = false
}

function clearSearch() {
  materialsStore.setSearchKeyword('')
}

function onToolTap() {
  emit('tool')
}
</script>

<template>
  <view class="search-bar">
    <view class="search-tool-btn" @tap="onToolTap">
      <view class="search-tool-icon" />
    </view>
    <view class="search-input-wrap" :class="{ 'search-input-wrap--active': isSearchActive }">
      <view class="search-icon" />
      <input
        class="search-input"
        :class="{ 'search-input--active': isSearchActive }"
        type="text"
        :placeholder="placeholderText"
        :value="materialsStore.searchKeyword"
        confirm-type="search"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <view v-if="hasKeyword" class="search-clear" @tap.stop="clearSearch">×</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  height: 68rpx;
  padding: 8rpx 22rpx;
  box-sizing: border-box;
  background: rgba(255, 253, 251, 0.94);
}

.search-tool-btn {
  width: 96rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #eceff7 0%, #e8efe9 100%);
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
  position: relative;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 7rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 76% 12rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 88% 22rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 76% 32rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 50% 37rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 24% 32rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 12% 22rpx, #1f2635 0 3rpx, transparent 4rpx),
    radial-gradient(circle at 24% 12rpx, #1f2635 0 3rpx, transparent 4rpx),
    rgba(255, 255, 255, 0.92);
  box-shadow: 0 4rpx 10rpx rgba(90, 98, 126, 0.12);
}

.search-input-wrap {
  position: relative;
  flex: 0 0 124rpx;
  height: 52rpx;
  background: rgba(239, 242, 248, 0.92);
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 22rpx;
  gap: 12rpx;
  box-sizing: border-box;
  overflow: hidden;
  transition:
    flex-basis 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    max-width 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    background u.$duration-state u.$ease-brand,
    box-shadow u.$duration-state u.$ease-brand;
}

.search-input-wrap--active {
  flex: 0 1 456rpx;
  max-width: 456rpx;
  justify-content: flex-start;
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 8rpx 18rpx rgba(86, 94, 116, 0.11),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.82);
}

.search-icon {
  position: relative;
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.search-icon::before {
  content: '';
  position: absolute;
  left: 2rpx;
  top: 2rpx;
  width: 15rpx;
  height: 15rpx;
  border: 4rpx solid #8790a2;
  border-radius: 50%;
}

.search-icon::after {
  content: '';
  position: absolute;
  right: 2rpx;
  bottom: 4rpx;
  width: 13rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: #8790a2;
  transform: rotate(45deg);
}

.search-input {
  flex: 1;
  width: 54rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #7d8496;
  height: 100%;
  min-width: 0;
  text-align: left;
}

.search-input--active {
  width: auto;
  font-size: 28rpx;
}

.search-clear {
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: rgba(139, 146, 164, 0.24);
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 31rpx;
  text-align: center;
  flex-shrink: 0;
  transition:
    transform u.$duration-press u.$ease-out,
    background u.$duration-state u.$ease-brand;
}

.search-clear:active {
  transform: scale(0.9);
  background: rgba(139, 146, 164, 0.36);
}
</style>
