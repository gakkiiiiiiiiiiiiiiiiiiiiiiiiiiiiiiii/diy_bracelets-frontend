<script setup lang="ts">
import { computed, ref } from 'vue';
import {
	getShopProductsByCategory,
	shopGoodsCategories,
	type ShopGoodsCategory,
} from '@/data/shopGoods';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';

const loading = ref(false);

const categoryRows = computed(() =>
	shopGoodsCategories
		.filter((category) => category.showOnGoodsHome !== false)
		.map((category) => ({
			...category,
			count: getShopProductsByCategory(category.id).length,
		}))
		.filter((category) => category.count > 0),
);

const displayRows = computed(() => {
	if (!loading.value) return categoryRows.value;
	return shopGoodsCategories.map((category) => ({
		...category,
		count: 0,
	}));
});

function categoryCountText(category: ShopGoodsCategory & { count: number }) {
	return `${category.count}个商品`;
}

function openSearch() {
	uni.navigateTo({ url: '/pages/goods/search/search' });
}

function openCategory(category: ShopGoodsCategory) {
	uni.navigateTo({ url: `/pages/goods/search/search?categoryId=${category.id}` });
}
</script>

<template>
	<view class="page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="goods-nav-title">好物</view>
		<view class="search" @tap="openSearch">
			<view class="search-icon">
				<view class="search-lens" />
			</view>
			<view class="search-placeholder">搜索产品</view>
		</view>

		<view class="category-list">
			<view
				v-for="category in displayRows"
				:key="category.id"
				class="category-row"
				:class="{ 'category-row--skeleton': loading }"
				@tap="!loading && openCategory(category)"
			>
				<view class="category-img" aria-hidden="true">
					<view class="category-symbol">
						<view class="category-symbol__dot category-symbol__dot--left" />
						<view class="category-symbol__dot category-symbol__dot--right" />
						<view class="category-symbol__ridge category-symbol__ridge--left" />
						<view class="category-symbol__ridge category-symbol__ridge--right" />
					</view>
				</view>
				<view class="category-body">
					<view class="category-name">{{ category.name }}</view>
					<view class="category-count">{{ categoryCountText(category) }}</view>
				</view>
				<view class="category-arrow">
					<view class="category-arrow-triangle" />
				</view>
			</view>
			<view v-if="categoryRows.length" class="loaded">已加载全部数据</view>
			<view v-else class="empty">
				<view class="empty-title">好物正在补货</view>
				<view class="empty-sub">可以先搜索水晶、消磁碗或定制服务</view>
				<view class="empty-action" @tap="openSearch">去搜索</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(148rpx + env(safe-area-inset-top)) 22rpx 132rpx;
	box-sizing: border-box;
}

.goods-nav-title {
	position: fixed;
	left: 50%;
	top: calc(46rpx + env(safe-area-inset-top));
	z-index: 110;
	transform: translateX(-50%);
	color: #08090c;
	font-size: 31rpx;
	font-weight: 900;
	line-height: 1;
	white-space: nowrap;
}

.search {
	width: 100%;
	height: 98rpx;
	border-radius: 8rpx;
	background: #d92733;
	display: flex;
	align-items: center;
	gap: 18rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
	box-shadow: 0 8rpx 18rpx rgba(217, 39, 51, 0.14);
}

.search:active,
.category-row:active {
	opacity: 0.72;
}

.search-icon {
	position: relative;
	width: 34rpx;
	height: 34rpx;
	flex-shrink: 0;
}

.search-lens {
	position: absolute;
	left: 2rpx;
	top: 2rpx;
	width: 20rpx;
	height: 20rpx;
	border: 4rpx solid #fff;
	border-radius: 50%;
	box-sizing: border-box;
}

.search-lens::after {
	content: '';
	position: absolute;
	right: -10rpx;
	bottom: -8rpx;
	width: 16rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: #fff;
	transform: rotate(45deg);
}

.search-placeholder {
	flex: 1;
	min-width: 0;
	color: #fff;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1;
}

.category-list {
	background: #fff;
}

.category-row {
	height: 226rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-bottom: 1rpx solid #ececef;
	transition: opacity 120ms ease;
}

.category-row--skeleton {
	opacity: 0.55;
}

.category-img {
	position: relative;
	width: 186rpx;
	height: 186rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.category-symbol {
	position: relative;
	width: 72rpx;
	height: 48rpx;
	color: #9ca5a2;
}

.category-symbol__dot {
	position: absolute;
	top: 7rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background: currentColor;
}

.category-symbol__dot--left {
	left: 16rpx;
}

.category-symbol__dot--right {
	right: 14rpx;
}

.category-symbol__ridge {
	position: absolute;
	top: 23rpx;
	width: 31rpx;
	height: 15rpx;
	border-top: 4rpx solid currentColor;
	border-radius: 50%;
}

.category-symbol__ridge--left {
	left: 6rpx;
	transform: rotate(-24deg);
}

.category-symbol__ridge--right {
	right: 5rpx;
	transform: rotate(25deg);
}

.category-body {
	flex: 1;
	min-width: 0;
}

.category-name {
	font-size: 32rpx;
	font-weight: 900;
	color: #24262d;
	line-height: 1.25;
}

.category-count {
	margin-top: 20rpx;
	font-size: 28rpx;
	font-weight: 800;
	color: #9a9ca3;
	line-height: 1.1;
}

.category-arrow {
	width: 34rpx;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex-shrink: 0;
}

.category-arrow-triangle {
	width: 0;
	height: 0;
	border-top: 12rpx solid transparent;
	border-bottom: 12rpx solid transparent;
	border-left: 14rpx solid #0e0f12;
}

.loaded {
	padding: 31rpx 0 30rpx;
	text-align: center;
	color: #b3b3b8;
	font-size: 26rpx;
	font-weight: 700;
}

.empty {
	padding: 88rpx 0 62rpx;
	text-align: center;
}

.empty-title {
	color: #545862;
	font-size: 28rpx;
	font-weight: 900;
}

.empty-sub {
	margin-top: 14rpx;
	color: #a1a3aa;
	font-size: 24rpx;
	font-weight: 700;
}

.empty-action {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 60rpx;
	margin-top: 28rpx;
	padding: 0 28rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 24rpx;
	font-weight: 900;
}

.empty-action:active {
	opacity: 0.72;
}
</style>
