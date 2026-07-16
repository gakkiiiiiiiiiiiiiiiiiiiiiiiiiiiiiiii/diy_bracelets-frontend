<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useMaterialsStore } from '@/stores/materials'
import { useDesignStore } from '@/stores/design'

const materialsStore = useMaterialsStore()
const designStore = useDesignStore()

const visibleCategories = computed(() => {
  const hasUsedMaterials = designStore.braceletDesign.length > 0
  return materialsStore.categories.filter((cat) => cat.id !== 'in-use' || hasUsedMaterials)
})

watchEffect(() => {
  if (!visibleCategories.value.length) return
  const visible = visibleCategories.value.some((cat) => cat.id === materialsStore.currentCategoryId)
  if (!visible) {
    materialsStore.setCategory(visibleCategories.value[0].id)
  }
})

function selectCategory(id: string) {
  materialsStore.setCategory(id)
}
</script>

<template>
  <scroll-view class="category-list" scroll-y>
    <view
      v-for="cat in visibleCategories"
      :key="cat.id"
      class="category-item"
      :class="{ 'category-item--active': materialsStore.currentCategoryId === cat.id }"
      @tap="selectCategory(cat.id)"
    >
      <text class="category-item__name">{{ cat.name }}</text>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.category-list {
  width: 132rpx;
  flex-shrink: 0;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  background: #091321;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-list::-webkit-scrollbar,
.category-list :deep(.uni-scroll-view::-webkit-scrollbar) {
  width: 0;
  height: 0;
  display: none;
}

.category-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  height: 86rpx;
  padding: 0 10rpx 0 10rpx;
  margin: 0;
  border-radius: 0;
  background: transparent;
  border-left: 6rpx solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background u.$duration-state u.$ease-brand, border-color u.$duration-state u.$ease-brand;
}

/* 选中分类以品牌青灰强调，保持材料浏览区安静。 */
.category-item--active {
  background: rgba(28, 39, 53, 0.96);
  border-left-color: #ed4b42;
  box-shadow: inset -1rpx 0 0 rgba(225, 234, 244, 0.12);
}

.category-item--active .category-item__name {
  color: #f2f5f9;
  font-weight: 800;
}

/* 未选中 hover（H5）：浅灰背景，无左侧条 */
.category-item:not(.category-item--active):hover {
  background: rgba(255, 255, 255, 0.05);
}

.category-item__name {
  max-width: 100%;
  font-size: 24rpx;
  color: #9fa9b6;
  text-align: center;
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-item:active {
  opacity: 0.92;
}
</style>
