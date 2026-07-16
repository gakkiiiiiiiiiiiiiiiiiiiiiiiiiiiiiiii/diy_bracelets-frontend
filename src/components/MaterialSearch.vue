<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMaterialsStore } from '@/stores/materials'
import BrandIcon from '@/components/BrandIcon.vue'

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
      <BrandIcon class="search-tool-icon" name="circle-dashed" tone="inverse" label="查看已用珠子" />
    </view>
    <view class="search-input-wrap" :class="{ 'search-input-wrap--active': isSearchActive }">
      <BrandIcon class="search-icon" name="search" tone="muted" />
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
      <view v-if="hasKeyword" class="search-clear" aria-label="清空搜索" @tap.stop="clearSearch">
        <BrandIcon name="x" tone="inverse" />
      </view>
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
  background: rgba(8, 17, 29, 0.96);
}

.search-tool-btn {
  width: 96rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: rgba(38, 49, 64, 0.9);
  border: 1rpx solid rgba(225, 234, 244, 0.18);
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
  width: 44rpx;
  height: 44rpx;
}

.search-input-wrap {
  position: relative;
  flex: 0 0 124rpx;
  height: 52rpx;
  background: rgba(38, 49, 64, 0.9);
  border: 1rpx solid rgba(225, 234, 244, 0.16);
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
  background: rgba(51, 62, 77, 0.96);
  box-shadow:
    0 8rpx 18rpx rgba(86, 94, 116, 0.11),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.82);
}

.search-icon {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  width: 54rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #eef2f7;
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
  padding: 8rpx;
  box-sizing: border-box;
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
