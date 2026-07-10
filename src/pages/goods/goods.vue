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
		<view class="goods-nav-title">好物</view>
		<!-- #endif -->
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
				<view class="category-img" :class="`category-img--${category.visual || 'bracelet'}`">
					<template v-if="category.visual === 'bracelet'">
						<image class="bracelet-photo" :src="category.image" mode="aspectFill" />
					</template>
					<view v-else class="mascot">
						<view class="mascot-head">
							<view class="mascot-eye mascot-eye--left" />
							<view class="mascot-eye mascot-eye--right" />
							<view class="mascot-mouth" />
						</view>
						<view v-if="category.visual === 'mascot-cup'" class="mascot-cup">
							<view class="cup-body" />
							<view class="cup-handle" />
						</view>
						<view v-else class="mascot-pick">
							<view class="pick-handle" />
							<view class="pick-head" />
							<view class="soil soil-a" />
							<view class="soil soil-b" />
						</view>
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
	padding: 22rpx 22rpx 132rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
.page {
	padding-top: calc(148rpx + env(safe-area-inset-top));
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
/* #endif */

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
	height: 258rpx;
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
	border-radius: 7rpx;
	background: #fff8df;
	flex-shrink: 0;
	overflow: hidden;
}

.category-img--bracelet {
	background:
		radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.9), rgba(245, 242, 236, 0.28)),
		#ecf4f2;
}

.bracelet-photo {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

.mascot {
	position: absolute;
	inset: 0;
}

.mascot-head {
	position: absolute;
	left: 36rpx;
	top: 35rpx;
	width: 108rpx;
	height: 100rpx;
	border: 5rpx solid #191919;
	border-radius: 48% 48% 45% 45%;
	background: #fffef7;
	box-sizing: border-box;
}

.mascot-eye {
	position: absolute;
	top: 38rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background: #191919;
}

.mascot-eye--left {
	left: 34rpx;
}

.mascot-eye--right {
	right: 34rpx;
}

.mascot-mouth {
	position: absolute;
	left: 49rpx;
	top: 51rpx;
	width: 10rpx;
	height: 5rpx;
	border-bottom: 4rpx solid #191919;
	border-radius: 0 0 12rpx 12rpx;
}

.mascot-cup {
	position: absolute;
	left: 72rpx;
	top: 98rpx;
	width: 54rpx;
	height: 44rpx;
}

.cup-body {
	position: absolute;
	left: 4rpx;
	top: 8rpx;
	width: 38rpx;
	height: 27rpx;
	border: 4rpx solid #a16b37;
	border-radius: 0 0 14rpx 14rpx;
	box-sizing: border-box;
	background: #f4d79a;
}

.cup-handle {
	position: absolute;
	right: 0;
	top: 13rpx;
	width: 15rpx;
	height: 16rpx;
	border: 4rpx solid #a16b37;
	border-left: 0;
	border-radius: 0 12rpx 12rpx 0;
}

.mascot-pick {
	position: absolute;
	inset: 0;
}

.pick-handle {
	position: absolute;
	left: 47rpx;
	top: 45rpx;
	width: 7rpx;
	height: 100rpx;
	border-radius: 999rpx;
	background: #735137;
	transform: rotate(38deg);
}

.pick-head {
	position: absolute;
	left: 31rpx;
	top: 33rpx;
	width: 55rpx;
	height: 24rpx;
	border: 5rpx solid #191919;
	border-bottom: 0;
	border-radius: 34rpx 34rpx 0 0;
	transform: rotate(38deg);
	box-sizing: border-box;
}

.soil {
	position: absolute;
	border-radius: 50%;
	background: #604732;
}

.soil-a {
	left: 24rpx;
	bottom: 28rpx;
	width: 74rpx;
	height: 24rpx;
}

.soil-b {
	left: 85rpx;
	bottom: 21rpx;
	width: 58rpx;
	height: 20rpx;
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
