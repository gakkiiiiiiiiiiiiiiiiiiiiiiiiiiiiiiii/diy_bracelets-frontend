<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import {
	getShopCategory,
	getShopProductsByCategory,
	shopGoodsCategories,
	shopGoodsProducts,
	type ShopGoodsCategory,
	type ShopGoodsProduct,
} from '@/data/shopGoods';
import { saveCheckoutDraft } from '@/utils/checkout';
import type { CartItem } from '@/api';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { resolveStaticUrl } from '@/utils/staticUrl';

type ResultFilter = 'all' | 'goods' | 'services';
type SortKey = 'recommend' | 'price-asc' | 'price-desc';

const RECENT_SEARCH_KEY = 'diy-bracelets-goods-search-history';
const MAX_RECENT_SEARCHES = 8;
const queryText = ref('');
const category = ref<ShopGoodsCategory | null>(null);
const resultFilter = ref<ResultFilter>('all');
const sortKey = ref<SortKey>('recommend');
const syncedQueryKey = ref('');
const recentSearches = ref<string[]>([]);
const hotTerms = ['兔毛水晶', '消磁碗', '改尺寸', '摩根石'];

const filterOptions: Array<{ id: ResultFilter; label: string }> = [
	{ id: 'all', label: '全部' },
	{ id: 'goods', label: '商品' },
	{ id: 'services', label: '服务' },
];

const sortOptions: Array<{ id: SortKey; label: string }> = [
	{ id: 'recommend', label: '推荐' },
	{ id: 'price-asc', label: '价格低' },
	{ id: 'price-desc', label: '价格高' },
];

function findCategoryByName(name: string) {
	const normalized = name.trim().toLowerCase();
	if (!normalized) return null;
	return shopGoodsCategories.find((item) => item.name.toLowerCase() === normalized) ?? null;
}

function isServiceProduct(product: ShopGoodsProduct) {
	return product.categoryId === 'services';
}

const baseRows = computed(() => {
	const keyword = queryText.value.trim().toLowerCase();
	const base = category.value ? getShopProductsByCategory(category.value.id) : shopGoodsProducts;
	if (!keyword && !category.value) return [];
	if (!keyword || keyword === category.value?.name.toLowerCase()) return base;
	return base.filter((product) =>
		`${product.name} ${product.type} ${product.description} ${product.sizes.join(' ')} ${
			getShopCategory(product.categoryId)?.name ?? ''
		}`.toLowerCase().includes(keyword),
	);
});

const productRows = computed(() => {
	let rows = [...baseRows.value];
	if (resultFilter.value === 'goods') {
		rows = rows.filter((product) => !isServiceProduct(product));
	}
	if (resultFilter.value === 'services') {
		rows = rows.filter((product) => isServiceProduct(product));
	}
	if (sortKey.value === 'price-asc') {
		rows.sort((a, b) => a.price - b.price);
	}
	if (sortKey.value === 'price-desc') {
		rows.sort((a, b) => b.price - a.price);
	}
	return rows;
});

const showDiscovery = computed(() => !queryText.value.trim() && !category.value);
const discoverableCategories = computed(() => shopGoodsCategories.filter((item) => item.showOnGoodsHome !== false));
const searchKeyword = computed(() => queryText.value.trim());
const resultSummary = computed(() => {
	const keyword = searchKeyword.value;
	if (category.value) return `${category.value.name} · ${productRows.value.length}个结果`;
	return keyword ? `“${keyword}” · ${productRows.value.length}个结果` : `${productRows.value.length}个结果`;
});
const hasActiveRefine = computed(() => resultFilter.value !== 'all' || sortKey.value !== 'recommend');
const hasRefineOnlyEmpty = computed(() => hasActiveRefine.value && baseRows.value.length > 0 && productRows.value.length === 0);
const resultSubText = computed(() => {
	if (category.value) return category.value.description;
	const keyword = searchKeyword.value;
	return keyword ? '搜索结果' : '全部结果';
});
const showRefineBar = computed(() => !category.value && !showDiscovery.value);
const emptyTitle = computed(() => {
	if (hasRefineOnlyEmpty.value) return '当前筛选没有匹配项';
	if (category.value) return `${category.value.name}暂时没有上新`;
	if (searchKeyword.value) return `没有找到“${searchKeyword.value}”`;
	return '暂时没有可展示商品';
});
const emptySub = computed(() => {
	if (hasRefineOnlyEmpty.value) return '清空筛选后，可继续查看当前搜索下的全部好物';
	if (category.value) return '可以先看看热门好物，或回到搜索页换个分类';
	if (searchKeyword.value) return '换个关键词试试，或者从热门搜索里继续找';
	return '先从热门搜索或商品分类开始逛逛';
});
const emptySuggestions = computed(() => {
	const normalized = new Set([searchKeyword.value, category.value?.name].filter(Boolean));
	return hotTerms.filter((term) => !normalized.has(term)).slice(0, 4);
});
const emptyRecommendedProducts = computed(() =>
	shopGoodsProducts.filter((product) => productRows.value.every((row) => row.id !== product.id)).slice(0, 3),
);

function syncFromQuery(query: Record<string, string | undefined>) {
	const categoryId = query.categoryId || '';
	const keyword = decodeURIComponent(query.keyword || '');
	const matchedCategory = categoryId ? getShopCategory(categoryId) : findCategoryByName(keyword);
	const nextKey = `${categoryId}|${keyword}`;
	if (syncedQueryKey.value && syncedQueryKey.value !== nextKey) {
		resetRefine();
	}
	syncedQueryKey.value = nextKey;
	category.value = matchedCategory;
	queryText.value = category.value?.name || keyword;
	rememberSearchTerm(queryText.value);
	uni.setNavigationBarTitle({ title: '产品搜索' });
}

function applySearchText(value: string, options: { remember?: boolean } = {}) {
	queryText.value = value;
	category.value = findCategoryByName(value);
	if (options.remember !== false) rememberSearchTerm(value);
	resetRefine();
	uni.setNavigationBarTitle({ title: '产品搜索' });
}

function h5QueryFromHash() {
	// #ifdef H5
	const hashQuery = window.location.hash.split('?')[1] || '';
	return Object.fromEntries(new URLSearchParams(hashQuery).entries());
	// #endif
	// #ifndef H5
	return {};
	// #endif
}

function syncFromH5Hash() {
	syncFromQuery(h5QueryFromHash());
}

onLoad((query: Record<string, string | undefined>) => {
	loadRecentSearches();
	syncFromQuery(query);
});

onShow(() => {
	loadRecentSearches();
	// #ifdef H5
	syncFromQuery(h5QueryFromHash());
	// #endif
});

onMounted(() => {
	loadRecentSearches();
	// #ifdef H5
	window.addEventListener('hashchange', syncFromH5Hash);
	syncFromH5Hash();
	// #endif
});

onBeforeUnmount(() => {
	// #ifdef H5
	window.removeEventListener('hashchange', syncFromH5Hash);
	// #endif
});

function onSearch(e: { detail: { value: string } }) {
	applySearchText(e.detail.value || '', { remember: false });
}

function confirmSearch(e: { detail: { value: string } }) {
	applySearchText(e.detail.value || queryText.value);
}

function clearSearch() {
	queryText.value = '';
	category.value = null;
	resetRefine();
	uni.setNavigationBarTitle({ title: '产品搜索' });
}

function searchTerm(term: string) {
	applySearchText(term);
}

function openCategory(nextCategory: ShopGoodsCategory) {
	category.value = nextCategory;
	queryText.value = nextCategory.name;
	rememberSearchTerm(nextCategory.name);
	resetRefine();
	uni.setNavigationBarTitle({ title: '产品搜索' });
}

function loadRecentSearches() {
	try {
		const raw = uni.getStorageSync(RECENT_SEARCH_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		recentSearches.value = normalizeRecentSearches(Array.isArray(cached) ? cached : []);
	} catch {
		recentSearches.value = [];
	}
}

function saveRecentSearches(next: string[]) {
	recentSearches.value = normalizeRecentSearches(next);
	uni.setStorageSync(RECENT_SEARCH_KEY, JSON.stringify(recentSearches.value));
}

function normalizeRecentSearches(values: unknown[]) {
	const seen = new Set<string>();
	return values
		.map((value) => String(value || '').trim())
		.filter((value) => {
			if (!value || seen.has(value)) return false;
			seen.add(value);
			return true;
		})
		.slice(0, MAX_RECENT_SEARCHES);
}

function rememberSearchTerm(value: string) {
	const term = value.trim();
	if (!term) return;
	saveRecentSearches([term, ...recentSearches.value.filter((item) => item !== term)]);
}

function clearRecentSearches() {
	recentSearches.value = [];
	uni.removeStorageSync(RECENT_SEARCH_KEY);
}

function goDetail(id: string) {
	uni.navigateTo({ url: `/pages/goods/detail/detail?id=${id}` });
}

function productCartItem(product: ShopGoodsProduct): CartItem {
	const specText = product.sizes[0] || '';
	return {
		id: `cart-product-${product.id}-${specText || 'default'}`,
		kind: 'product',
		productId: product.id,
		name: product.name,
		image: product.listImage || product.image,
		price: product.price,
		qty: 1,
		type: product.type,
		spec: specText,
	};
}

function buyProductNow(product: ShopGoodsProduct) {
	const item = productCartItem(product);
	saveCheckoutDraft('buy-now', [item], [item.id]);
	uni.navigateTo({ url: '/pages/checkout/checkout' });
}

function setResultFilter(filter: ResultFilter) {
	resultFilter.value = filter;
}

function setSortKey(sort: SortKey) {
	sortKey.value = sort;
}

function resetRefine() {
	resultFilter.value = 'all';
	sortKey.value = 'recommend';
}

function moneyText(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function productSpecText(product: ShopGoodsProduct) {
	const visible = product.sizes.slice(0, 2).join(' / ');
	return product.sizes.length > 2 ? `${visible} 等` : visible;
}

function productListImage(product: ShopGoodsProduct) {
	return product.listImage || product.image;
}
</script>

<template>
	<view class="page app-subpage goods-search-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<view class="goods-search-title">产品搜索</view>
		<!-- #endif -->
		<view class="search">
			<view class="search-icon">
				<view class="search-lens" />
			</view>
			<input
				class="search-input"
				:value="queryText"
				placeholder="搜索产品"
				confirm-type="search"
				@input="onSearch"
				@confirm="confirmSearch"
			/>
			<view v-if="queryText" class="search-clear" @tap="clearSearch">×</view>
		</view>

		<template v-if="showDiscovery">
			<view v-if="recentSearches.length" class="section-head">
				<view class="section-title section-title--inline">最近搜索</view>
				<view class="section-action" @tap="clearRecentSearches">清空</view>
			</view>
			<view v-if="recentSearches.length" class="hot-row recent-row">
				<view
					v-for="term in recentSearches"
					:key="term"
					class="hot-chip recent-chip"
					@tap="searchTerm(term)"
				>
					{{ term }}
				</view>
			</view>

			<view class="section-title">热门搜索</view>
			<view class="hot-row">
				<view
					v-for="term in hotTerms"
					:key="term"
					class="hot-chip"
					@tap="searchTerm(term)"
				>
					{{ term }}
				</view>
			</view>

			<view class="section-title">商品分类</view>
			<view class="category-shortcuts">
				<view
					v-for="item in discoverableCategories"
					:key="item.id"
					class="category-shortcut"
					@tap="openCategory(item)"
				>
					<image
						v-if="item.visual === 'bracelet'"
						class="shortcut-img"
						:src="resolveStaticUrl(item.image)"
						mode="aspectFill"
					/>
					<view v-else class="shortcut-mark">{{ item.name.slice(0, 1) }}</view>
					<view class="shortcut-copy">
						<view class="shortcut-name">{{ item.name }}</view>
						<view class="shortcut-desc">{{ item.description }}</view>
					</view>
					<view class="shortcut-arrow">›</view>
				</view>
			</view>
			<view class="loaded">已加载全部数据</view>
		</template>

		<view v-if="!showDiscovery && !category" class="result-panel">
			<view class="result-head">
				<view>
					<view class="result-title">{{ resultSummary }}</view>
					<view class="result-sub">{{ resultSubText }}</view>
				</view>
				<view v-if="hasActiveRefine" class="result-reset" @tap="resetRefine">重置</view>
			</view>
			<scroll-view v-if="showRefineBar" class="chip-scroll" scroll-x :show-scrollbar="false">
				<view class="chip-track">
					<view
						v-for="option in filterOptions"
						:key="option.id"
						class="refine-chip"
						:class="{ active: resultFilter === option.id }"
						@tap="setResultFilter(option.id)"
					>
						{{ option.label }}
					</view>
					<view class="chip-divider" />
					<view
						v-for="option in sortOptions"
						:key="option.id"
						class="refine-chip sort-chip"
						:class="{ active: sortKey === option.id }"
						@tap="setSortKey(option.id)"
					>
						{{ option.label }}
					</view>
				</view>
			</scroll-view>
		</view>

		<view v-if="productRows.length" class="product-list">
			<view
				v-for="product in productRows"
				:key="product.id"
				class="product-card"
				@tap="goDetail(product.id)"
			>
					<view class="product-copy">
						<view class="product-type">{{ product.type }}</view>
						<view class="product-name">{{ product.name }}</view>
						<view class="product-buy" @tap.stop="buyProductNow(product)">现在购买 ▶</view>
					</view>
				<image class="product-img" :src="productListImage(product)" mode="aspectFill" />
			</view>
		</view>
		<view v-if="productRows.length" class="loaded">已加载全部数据</view>

		<view v-else-if="!showDiscovery" class="empty">
			<view class="empty-mark">
				<view class="empty-lens" />
				<view class="empty-dot empty-dot--a" />
				<view class="empty-dot empty-dot--b" />
			</view>
			<view class="empty-title">{{ emptyTitle }}</view>
			<view class="empty-sub">{{ emptySub }}</view>
			<view class="empty-actions">
				<view v-if="hasActiveRefine" class="empty-action empty-action--primary" @tap="resetRefine">清空筛选</view>
				<view v-if="searchKeyword || category" class="empty-action" @tap="clearSearch">重新搜索</view>
			</view>
			<view v-if="emptySuggestions.length" class="empty-block">
				<view class="empty-block-title">热门搜索</view>
				<view class="empty-chip-row">
					<view
						v-for="term in emptySuggestions"
						:key="term"
						class="empty-chip"
						@tap="searchTerm(term)"
					>
						{{ term }}
					</view>
				</view>
			</view>
			<view v-if="emptyRecommendedProducts.length" class="empty-block">
				<view class="empty-block-title">可以先看看</view>
				<view class="empty-recommend-list">
					<view
						v-for="product in emptyRecommendedProducts"
						:key="product.id"
						class="empty-recommend"
						@tap="goDetail(product.id)"
					>
						<image class="empty-recommend-img" :src="productListImage(product)" mode="aspectFill" />
						<view class="empty-recommend-copy">
							<view class="empty-recommend-name">{{ product.name }}</view>
							<view class="empty-recommend-meta">¥{{ moneyText(product.price) }} · {{ productSpecText(product) }}</view>
						</view>
						<view class="empty-recommend-arrow">›</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: 20rpx 22rpx 34rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
.page {
	padding-top: calc(148rpx + env(safe-area-inset-top));
}

.goods-search-title {
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
	height: 90rpx;
	border-radius: 8rpx;
	background: #d92733;
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 0 22rpx;
	margin-bottom: 28rpx;
	box-sizing: border-box;
	box-shadow: 0 8rpx 18rpx rgba(217, 39, 51, 0.14);
}

.section-title {
	margin: 28rpx 0 18rpx;
	color: #111318;
	font-size: 31rpx;
	font-weight: 900;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	margin: 28rpx 0 18rpx;
}

.section-title--inline {
	margin: 0;
}

.section-action {
	flex-shrink: 0;
	color: #9ca0a8;
	font-size: 23rpx;
	font-weight: 900;
}

.hot-row {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
}

.recent-row {
	margin-bottom: 6rpx;
}

.hot-chip {
	height: 62rpx;
	line-height: 62rpx;
	border-radius: 8rpx;
	padding: 0 22rpx;
	background: #f0f0f2;
	color: #4d515b;
	font-size: 25rpx;
	font-weight: 900;
}

.recent-chip {
	background: #fff7f8;
	color: #d92733;
	border: 1rpx solid rgba(217, 39, 51, 0.13);
	box-sizing: border-box;
}

.category-shortcuts {
	background: #fafafa;
}

.category-shortcut {
	min-height: 130rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 18rpx 22rpx;
	border-bottom: 1rpx solid #ececef;
	box-sizing: border-box;
}

.category-shortcut:last-child {
	border-bottom: 0;
}

.category-shortcut:active,
.hot-chip:active,
.section-action:active,
.refine-chip:active,
.result-reset:active,
.product-card:active {
	opacity: 0.72;
}

.shortcut-img,
.shortcut-mark {
	width: 76rpx;
	height: 76rpx;
	border-radius: 6rpx;
	flex-shrink: 0;
}

.shortcut-mark {
	background: #fff7e6;
	color: #3b2d22;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 32rpx;
	font-weight: 900;
}

.shortcut-copy {
	flex: 1;
	min-width: 0;
}

.shortcut-name {
	color: #202329;
	font-size: 29rpx;
	font-weight: 900;
}

.shortcut-desc {
	margin-top: 10rpx;
	color: #9a9ca3;
	font-size: 24rpx;
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.shortcut-arrow {
	color: #babac0;
	font-size: 42rpx;
	line-height: 1;
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

.search-input {
	flex: 1;
	height: 100%;
	color: #fff;
	font-size: 28rpx;
	font-weight: 800;
}

.search-input :deep(.uni-input-placeholder),
.search-input::placeholder {
	color: rgba(255, 255, 255, 0.9);
}

.search-clear {
	width: 34rpx;
	height: 34rpx;
	line-height: 30rpx;
	text-align: center;
	border-radius: 50%;
	border: 3rpx solid rgba(255, 255, 255, 0.82);
	color: #fff;
	font-size: 26rpx;
	font-weight: 900;
	box-sizing: border-box;
}

.result-panel {
	margin: -6rpx 0 22rpx;
	padding-bottom: 18rpx;
	border-bottom: 1rpx solid #f0f0f2;
}

.result-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	margin-bottom: 16rpx;
}

.result-title {
	min-width: 0;
	color: #111318;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.result-sub {
	margin-top: 8rpx;
	color: #9b9da5;
	font-size: 23rpx;
	font-weight: 700;
}

.result-reset {
	flex-shrink: 0;
	color: #d92733;
	font-size: 23rpx;
	font-weight: 900;
}

.chip-scroll {
	width: 100%;
	white-space: nowrap;
}

.chip-track {
	display: inline-flex;
	align-items: center;
	gap: 12rpx;
	min-width: 100%;
}

.refine-chip {
	height: 56rpx;
	line-height: 56rpx;
	padding: 0 22rpx;
	border-radius: 999rpx;
	background: #f3f4f6;
	color: #555964;
	font-size: 23rpx;
	font-weight: 900;
	white-space: nowrap;
	transition: opacity 120ms ease;
}

.refine-chip.active {
	background: #d92733;
	color: #fff;
}

.sort-chip.active {
	background: #202329;
}

.chip-divider {
	width: 1rpx;
	height: 34rpx;
	margin: 0 2rpx;
	background: #e2e3e7;
	flex-shrink: 0;
}

.product-list {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
	border: 0;
}

.product-card {
	min-height: 260rpx;
	background: #fff;
	border-radius: 12rpx;
	border: 1rpx solid #f0f0f2;
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 30rpx 30rpx 30rpx 34rpx;
	box-sizing: border-box;
	box-shadow: 0 10rpx 24rpx rgba(34, 38, 48, 0.045);
	transition: opacity 120ms ease;
}

.product-card:last-child {
	border-bottom: 0;
}

.product-copy {
	flex: 1;
	min-width: 0;
}

.product-type {
	height: auto;
	line-height: 1.2;
	padding: 0;
	border-radius: 0;
	background: transparent;
	font-weight: 800;
	color: #9b9da5;
	font-size: 27rpx;
}

.product-name {
	min-width: 0;
	margin-top: 26rpx;
	font-size: 31rpx;
	font-weight: 900;
	color: #101216;
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.product-buy {
	display: inline-flex;
	align-items: center;
	margin-top: 42rpx;
	min-width: 0;
	padding-bottom: 8rpx;
	border-bottom: 3rpx solid #111318;
	color: #111318;
	font-size: 25rpx;
	font-weight: 900;
	line-height: 1;
	white-space: nowrap;
	align-self: flex-start;
}

.product-img {
	width: 214rpx;
	height: 172rpx;
	border-radius: 0;
	background: #f4f4f5;
	flex-shrink: 0;
}

.loaded {
	padding: 31rpx 0 30rpx;
	text-align: center;
	color: #b3b3b8;
	font-size: 26rpx;
	font-weight: 700;
}

.empty {
	margin-top: 70rpx;
	padding: 0 24rpx 96rpx;
	text-align: center;
	color: #9698a2;
}

.empty-mark {
	position: relative;
	width: 116rpx;
	height: 116rpx;
	margin: 0 auto 28rpx;
	border-radius: 50%;
	background:
		radial-gradient(circle at 40% 35%, rgba(255, 255, 255, 0.95), rgba(255, 246, 248, 0.72) 44%, rgba(217, 39, 51, 0.1) 100%),
		#fff5f6;
	border: 1rpx solid rgba(217, 39, 51, 0.11);
	box-shadow: 0 16rpx 34rpx rgba(217, 39, 51, 0.08);
	box-sizing: border-box;
}

.empty-lens {
	position: absolute;
	left: 32rpx;
	top: 29rpx;
	width: 38rpx;
	height: 38rpx;
	border: 7rpx solid #d92733;
	border-radius: 50%;
	box-sizing: border-box;
}

.empty-lens::after {
	content: '';
	position: absolute;
	right: -23rpx;
	bottom: -15rpx;
	width: 32rpx;
	height: 7rpx;
	border-radius: 999rpx;
	background: #d92733;
	transform: rotate(45deg);
}

.empty-dot {
	position: absolute;
	border-radius: 50%;
	background: #202329;
	opacity: 0.18;
}

.empty-dot--a {
	right: 28rpx;
	top: 26rpx;
	width: 10rpx;
	height: 10rpx;
}

.empty-dot--b {
	left: 26rpx;
	bottom: 25rpx;
	width: 8rpx;
	height: 8rpx;
}

.empty-title {
	font-size: 32rpx;
	font-weight: 900;
	color: #15171c;
	line-height: 1.25;
}

.empty-sub {
	margin-top: 14rpx;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.45;
	color: #9b9da5;
}

.empty-actions {
	display: flex;
	justify-content: center;
	gap: 14rpx;
	margin-top: 30rpx;
}

.empty-action {
	height: 60rpx;
	line-height: 60rpx;
	padding: 0 24rpx;
	border-radius: 999rpx;
	background: #f4f5f7;
	color: #343844;
	font-size: 24rpx;
	font-weight: 900;
}

.empty-action--primary {
	background: #d92733;
	color: #fff;
}

.empty-action:active,
.empty-chip:active,
.empty-recommend:active {
	opacity: 0.72;
}

.empty-block {
	margin-top: 42rpx;
	text-align: left;
}

.empty-block-title {
	color: #23262d;
	font-size: 26rpx;
	font-weight: 900;
}

.empty-chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 14rpx;
	margin-top: 18rpx;
}

.empty-chip {
	height: 58rpx;
	line-height: 58rpx;
	padding: 0 22rpx;
	border-radius: 8rpx;
	background: #fff7f8;
	color: #d92733;
	font-size: 24rpx;
	font-weight: 900;
	border: 1rpx solid rgba(217, 39, 51, 0.12);
	box-sizing: border-box;
}

.empty-recommend-list {
	margin-top: 18rpx;
	border: 1rpx solid #f0f0f2;
	border-radius: 12rpx;
	overflow: hidden;
	background: #fff;
}

.empty-recommend {
	display: flex;
	align-items: center;
	gap: 18rpx;
	min-height: 116rpx;
	padding: 16rpx 18rpx;
	border-bottom: 1rpx solid #f0f0f2;
	box-sizing: border-box;
}

.empty-recommend:last-child {
	border-bottom: 0;
}

.empty-recommend-img {
	width: 78rpx;
	height: 78rpx;
	border-radius: 6rpx;
	background: #f5f5f6;
	flex-shrink: 0;
}

.empty-recommend-copy {
	flex: 1;
	min-width: 0;
}

.empty-recommend-name {
	color: #17191f;
	font-size: 25rpx;
	font-weight: 900;
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.empty-recommend-meta {
	margin-top: 8rpx;
	color: #9b9da5;
	font-size: 22rpx;
	font-weight: 800;
}

.empty-recommend-arrow {
	color: #c4c5ca;
	font-size: 38rpx;
	line-height: 1;
	flex-shrink: 0;
}
</style>
