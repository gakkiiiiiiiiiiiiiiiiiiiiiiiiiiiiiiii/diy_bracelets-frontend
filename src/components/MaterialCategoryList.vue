<script setup lang="ts">
import { useMaterialsStore } from '@/stores/materials'

const materialsStore = useMaterialsStore()

function selectCategory(id: string) {
  materialsStore.setCategory(id)
}
</script>

<template>
  <scroll-view class="category-list" scroll-y>
    <view
      v-for="cat in materialsStore.categories"
      :key="cat.id"
      class="category-item"
      :class="{ 'category-item--active': materialsStore.currentCategoryId === cat.id }"
      @click="selectCategory(cat.id)"
    >
      <text class="category-item__name">{{ cat.name }}</text>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.category-list {
  width: 160rpx;
  flex-shrink: 0;
  height: 100%;
  padding: 8rpx 0;
  box-sizing: border-box;
}

.category-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 28rpx 16rpx;
  margin: 6rpx 0;
  border-radius: 999rpx;
  background: #fff;
  border-left: 4rpx solid transparent;
  transition: background u.$duration-state u.$ease-brand, border-color u.$duration-state u.$ease-brand;
}

/* 选中：浅灰底 + 左侧深色竖条 */
.category-item--active {
  background: #f0f0f0;
  border-left-color: #8e8e93;
}

.category-item--active .category-item__name {
  color: u.$text-primary;
  font-weight: 500;
}

/* 未选中 hover（H5）：浅灰背景，无左侧条 */
.category-item:not(.category-item--active):hover {
  background: #f5f5f5;
}

.category-item__name {
  font-size: 28rpx;
  color: u.$text-primary;
  text-align: center;
  font-weight: 400;
}

.category-item:active {
  opacity: 0.92;
}
</style>
