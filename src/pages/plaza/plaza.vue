<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api, isMockApiFallbackError, type DesignCompositionRow, type DesignDetail, type PlazaItem } from '@/api';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { mockGoodsByTab, mockDesignDetails } from '@/data/mock';
import { isFavoriteDesign, loadFavoriteDesignIds, removeFavoriteDesign, saveFavoriteDesign } from '@/utils/favorites';

type ApiTab = 'designer' | 'user';
type PlazaTab = ApiTab | 'contest';
interface PreviewBead {
	id: string;
	image: string;
	style: Record<string, string | number>;
}

const tabs: { id: PlazaTab; label: string }[] = [
	{ id: 'designer', label: '设计师款' },
	{ id: 'user', label: '优秀客订' },
	{ id: 'contest', label: '设计大赛专区' },
];

const contestItems: PlazaItem[] = [
	{ id: 'plaza-contest-lake-light', title: '湖光入梦', author: '@设计大赛', image: mockDesignDetails['plaza-contest-lake-light'].image, cta: '查看实物', usageCount: 1260 },
	{ id: 'plaza-contest-sun-orbit', title: '日晕轨道', author: '@设计大赛', image: mockDesignDetails['plaza-contest-sun-orbit'].image, cta: '查看实物', usageCount: 1198 },
	{ id: 'plaza-contest-violet-cloud', title: '紫云纪念', author: '@设计大赛', image: mockDesignDetails['plaza-contest-violet-cloud'].image, cta: '查看实物', usageCount: 1092 },
	{ id: 'plaza-contest-spring-mist', title: '春雾碎光', author: '@设计大赛', image: mockDesignDetails['plaza-contest-spring-mist'].image, cta: '查看实物', usageCount: 964 },
];

const fallbackItems: Record<PlazaTab, PlazaItem[]> = {
	designer: mockGoodsByTab.designer.items,
	user: mockGoodsByTab.user.items,
	contest: contestItems,
};

const activeTab = ref<PlazaTab>('designer');
const loading = ref(false);
const items = ref<PlazaItem[]>(fallbackItems.designer);
const favoriteIds = ref<string[]>([]);
const previewCache = new Map<string, PreviewBead[]>();

onMounted(() => {
	loadFavorites();
	fetchItems();
});
onShow(loadFavorites);
watch(activeTab, fetchItems);

async function fetchItems() {
	const tab = activeTab.value;
	loading.value = true;
	if (tab === 'contest') {
		items.value = fallbackItems.contest;
		loading.value = false;
		return;
	}

	try {
		const res = await api.getGoods(tab);
		items.value = res?.items?.length ? res.items : fallbackItems[tab];
	} catch (e) {
		if (!isMockApiFallbackError(e)) console.warn('[plaza] API getGoods failed:', e);
		items.value = fallbackItems[tab];
	} finally {
		loading.value = false;
	}
}

function setTab(tab: PlazaTab) {
	if (activeTab.value === tab) return;
	activeTab.value = tab;
}

function goDetail(id: string) {
	uni.navigateTo({ url: `/pages/goods/detail/detail?id=${id}` });
}

function goBack() {
	uni.navigateBack({
		fail: () => {
			uni.switchTab({ url: '/pages/home/home' });
		},
	});
}

function loadFavorites() {
	favoriteIds.value = loadFavoriteDesignIds();
}

function designDetailFor(item: PlazaItem): DesignDetail {
	const localDetail = mockDesignDetails[item.id];
	if (localDetail) return localDetail;
	return {
		id: item.id,
		source: activeTab.value === 'user' ? 'user' : 'designer',
		title: item.title,
		author: item.author,
		image: item.image,
		images: [item.image],
		usageCount: item.usageCount,
		composition: [],
	};
}

function isFavorite(item: PlazaItem) {
	return favoriteIds.value.includes(item.id) || isFavoriteDesign(item.id);
}

function toggleFavorite(item: PlazaItem) {
	const detail = designDetailFor(item);
	const wasFavorite = isFavorite(item);
	if (wasFavorite) {
		removeFavoriteDesign(item.id);
	} else {
		saveFavoriteDesign(detail);
	}
	loadFavorites();
	uni.showToast({ title: wasFavorite ? '已取消收藏' : '已收藏', icon: 'none' });
}

function compositionFor(item: PlazaItem): DesignCompositionRow[] {
	return mockDesignDetails[item.id]?.composition ?? [];
}

function getPreviewBeads(item: PlazaItem): PreviewBead[] {
	if (previewCache.has(item.id)) return previewCache.get(item.id) ?? [];
	const composition = compositionFor(item);
	if (!composition.length) {
		previewCache.set(item.id, []);
		return [];
	}

	const weighted = composition.flatMap((row) => Array.from({ length: Math.max(1, row.quantity) }, () => row));
	const count = Math.max(20, Math.min(26, weighted.length + 10));
	const beads = Array.from({ length: count }, (_, index) => {
		const source = weighted[Math.floor((index / count) * weighted.length)] ?? composition[index % composition.length];
		const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
		const size = 28 + (index % 5 === 0 ? 6 : index % 2 === 0 ? 3 : 0);
		const radiusX = 92 + ((index % 3) - 1) * 2;
		const radiusY = 82 + (index % 4 === 0 ? 3 : 0);
		const left = 172 + Math.cos(angle) * radiusX - size / 2;
		const top = 160 + Math.sin(angle) * radiusY - size / 2;
		return {
			id: `${item.id}-${index}`,
			image: source.image,
			style: {
				left: `${left.toFixed(1)}rpx`,
				top: `${top.toFixed(1)}rpx`,
				width: `${size}rpx`,
				height: `${size}rpx`,
				zIndex: 20 + Math.round((Math.sin(angle) + 1) * 20),
				animationDelay: `${(index % 8) * 80}ms`,
			},
		};
	});
	previewCache.set(item.id, beads);
	return beads;
}

function hasBraceletPreview(item: PlazaItem) {
	return getPreviewBeads(item).length > 0;
}

function showCharm(item: PlazaItem, index: number) {
	return activeTab.value === 'designer' && (index === 0 || item.title.includes('粉'));
}
</script>

<template>
	<view class="page app-subpage plaza-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="plaza-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">设计广场</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="intro">
			<view class="title">设计广场</view>
			<view class="subtitle">点击查看实物图和设计细节</view>
		</view>

		<view class="tabs">
			<view
				v-for="tab in tabs"
				:key="tab.id"
				class="tab"
				:class="{ active: activeTab === tab.id }"
				@tap="setTab(tab.id)"
			>
				<text class="tab-label">{{ tab.label }}</text>
				<view class="tab-line" />
			</view>
		</view>

		<view class="gallery">
			<view v-if="loading" class="grid">
				<view v-for="i in 6" :key="i" class="plaza-card skeleton">
					<view class="usage usage-skeleton" />
					<view class="empty-art">
						<view class="placeholder-mark">
							<view class="placeholder-dot" />
							<view class="placeholder-line placeholder-line-a" />
							<view class="placeholder-line placeholder-line-b" />
						</view>
					</view>
					<view class="card-foot">
						<view class="text-skeleton title-skeleton" />
						<view class="text-skeleton author-skeleton" />
					</view>
				</view>
			</view>

			<view v-else-if="items.length" class="grid">
				<view
					v-for="(item, index) in items"
					:key="`${activeTab}-${item.id}`"
					class="plaza-card"
					:style="{ animationDelay: `${index * 42}ms` }"
					@tap="goDetail(item.id)"
				>
					<view
						class="favorite-toggle"
						:class="{ active: isFavorite(item) }"
						@tap.stop="toggleFavorite(item)"
					>
						♥
					</view>
					<view class="usage">{{ item.usageCount }}人使用</view>
					<view class="empty-art">
						<template v-if="hasBraceletPreview(item)">
							<view class="bracelet-shadow" />
							<view class="brand-mark">
								<view class="brand-name">珠岛</view>
								<view class="brand-line">DIY PLATFORM</view>
							</view>
							<image
								v-for="bead in getPreviewBeads(item)"
								:key="bead.id"
								class="bracelet-bead"
								:src="bead.image"
								mode="aspectFit"
								:style="bead.style"
							/>
							<view v-if="showCharm(item, index)" class="bracelet-charm">
								<view class="charm-ring" />
								<view class="charm-star">✦</view>
							</view>
						</template>
						<view v-else class="single-preview">
							<view class="image-halo" />
							<image class="crystal-img" :src="item.image" mode="aspectFit" />
							<view class="brand-mark">
								<view class="brand-name">珠岛</view>
								<view class="brand-line">DIY PLATFORM</view>
							</view>
						</view>
					</view>
					<view class="card-foot">
						<view class="card-title">{{ item.title }}</view>
						<view class="card-author">{{ item.author }}</view>
					</view>
				</view>
			</view>

			<view v-else class="empty">
				<view class="empty-title">暂无设计</view>
				<view class="empty-sub">稍后再来看看新的灵感作品</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7f8;
	padding-top: calc(102rpx + env(safe-area-inset-top));
	box-sizing: border-box;
}

/* #ifdef H5 */
:global(uni-app:has(.plaza-page) uni-tabbar),
:global(uni-app:has(.plaza-page) .uni-tabbar-bottom) {
	display: none;
}

:global(uni-page-body:has(> .plaza-page)) {
	min-height: 100%;
	padding-bottom: 0 !important;
}
/* #endif */

.plaza-nav {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 90;
	height: calc(102rpx + env(safe-area-inset-top));
	padding: calc(22rpx + env(safe-area-inset-top)) 24rpx 0;
	background: rgba(255, 255, 255, 0.96);
	backdrop-filter: blur(18rpx);
	box-sizing: border-box;
}

.nav-side {
	width: 112rpx;
	height: 68rpx;
	display: flex;
	align-items: center;
}

.nav-side--right {
	justify-content: flex-end;
}

.nav-back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #15171c;
	font-size: 58rpx;
	font-weight: 400;
	line-height: 1;
}

.nav-back:active {
	opacity: 0.58;
}

.nav-title {
	position: absolute;
	left: 50%;
	top: calc(66rpx + env(safe-area-inset-top));
	max-width: 320rpx;
	transform: translate(-50%, -50%);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #111216;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1;
}

.intro {
	background: #fff;
	padding: 22rpx 40rpx 24rpx;
	box-sizing: border-box;
}

.title {
	color: #17191d;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1.2;
	letter-spacing: 0;
}

.subtitle {
	margin-top: 8rpx;
	color: #1d2025;
	font-size: 25rpx;
	font-weight: 800;
	line-height: 1.25;
}

.tabs {
	height: 74rpx;
	background: #fff;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	align-items: end;
	padding: 0 36rpx;
	box-sizing: border-box;
}

.tab {
	position: relative;
	height: 74rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	color: #1e2228;
	font-size: 28rpx;
	font-weight: 800;
	line-height: 1;
	transition: color 0.22s ease, transform 0.22s ease;
}

.tab.active {
	color: #101318;
	transform: translateY(-1rpx);
}

.tab-label {
	white-space: nowrap;
}

.tab-line {
	position: absolute;
	left: 50%;
	bottom: 3rpx;
	width: 34rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: #d73c52;
	opacity: 0;
	transform: translateX(-50%) scaleX(0.45);
	transform-origin: center;
	transition: opacity 0.22s ease, transform 0.22s ease;
}

.tab.active .tab-line {
	opacity: 1;
	transform: translateX(-50%) scaleX(1);
}

.gallery {
	padding: 22rpx 22rpx 140rpx;
	box-sizing: border-box;
}

.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18rpx;
}

.plaza-card {
	position: relative;
	min-height: 424rpx;
	border-radius: 8rpx;
	background: #fff;
	overflow: hidden;
	box-shadow: 0 8rpx 24rpx rgba(20, 24, 32, 0.035);
	animation: card-in 0.42s cubic-bezier(0.19, 1, 0.22, 1) both;
	transition: transform 0.18s ease;
}

.plaza-card:active {
	transform: scale(0.986);
}

.favorite-toggle {
	position: absolute;
	left: 14rpx;
	top: 12rpx;
	z-index: 4;
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.94);
	color: #c6cad2;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 48rpx;
	text-align: center;
	box-shadow: 0 6rpx 18rpx rgba(33, 37, 48, 0.11);
	transition: color 0.18s ease, transform 0.18s ease;
}

.favorite-toggle.active {
	color: #d92733;
	transform: scale(1.04);
}

.favorite-toggle:active {
	opacity: 0.76;
	transform: scale(0.94);
}

.usage {
	position: absolute;
	top: 18rpx;
	right: 16rpx;
	z-index: 2;
	color: #aeb2b8;
	font-size: 23rpx;
	font-weight: 700;
	line-height: 1;
}

.empty-art {
	position: relative;
	height: 326rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background:
		radial-gradient(circle at 52% 43%, rgba(255, 255, 255, 0.98) 0 28%, rgba(251, 252, 253, 0.96) 58%, rgba(247, 248, 250, 0.92) 100%),
		linear-gradient(180deg, #fff 0%, #fcfcfd 100%);
	overflow: hidden;
}

.single-preview {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.image-halo {
	position: absolute;
	width: 156rpx;
	height: 156rpx;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(214, 220, 226, 0.26) 0%, rgba(214, 220, 226, 0) 68%);
	animation: halo-breathe 5.2s ease-in-out infinite;
}

.crystal-img {
	position: relative;
	z-index: 1;
	width: 132rpx;
	height: 132rpx;
	opacity: 0.58;
	animation: crystal-float 4.8s ease-in-out infinite;
}

.bracelet-shadow {
	position: absolute;
	left: 50%;
	top: 190rpx;
	width: 190rpx;
	height: 34rpx;
	border-radius: 50%;
	background: radial-gradient(ellipse, rgba(93, 98, 108, 0.13) 0%, rgba(93, 98, 108, 0) 70%);
	filter: blur(2rpx);
	transform: translateX(-50%);
}

.brand-mark {
	position: absolute;
	left: 50%;
	top: 50%;
	z-index: 7;
	width: 96rpx;
	height: 46rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	color: rgba(198, 143, 150, 0.34);
	transform: translate(-50%, -50%);
	pointer-events: none;
}

.brand-name {
	font-size: 17rpx;
	font-weight: 900;
	line-height: 1;
	letter-spacing: 0;
}

.brand-line {
	margin-top: 5rpx;
	font-size: 9rpx;
	font-weight: 800;
	line-height: 1;
}

.bracelet-bead {
	position: absolute;
	border-radius: 50%;
	box-shadow:
		0 7rpx 12rpx rgba(52, 58, 68, 0.16),
		inset 5rpx 6rpx 8rpx rgba(255, 255, 255, 0.4);
	animation: bead-float 4.8s ease-in-out infinite;
}

.bracelet-charm {
	position: absolute;
	left: 222rpx;
	top: 208rpx;
	z-index: 62;
	width: 38rpx;
	height: 48rpx;
	color: #c7bfb7;
	animation: charm-swing 4.6s ease-in-out infinite;
	transform-origin: 50% 0;
}

.charm-ring {
	position: absolute;
	left: 14rpx;
	top: 0;
	width: 10rpx;
	height: 10rpx;
	border: 2rpx solid rgba(176, 168, 160, 0.72);
	border-radius: 50%;
	box-sizing: border-box;
}

.charm-star {
	position: absolute;
	left: 0;
	top: 11rpx;
	width: 38rpx;
	height: 38rpx;
	color: rgba(188, 178, 167, 0.78);
	font-size: 33rpx;
	line-height: 38rpx;
	text-align: center;
	text-shadow: 0 5rpx 9rpx rgba(98, 91, 84, 0.18);
}

.placeholder-mark {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 62rpx;
	height: 40rpx;
	transform: translate(-50%, -50%);
	opacity: 0.42;
}

.placeholder-dot {
	position: absolute;
	left: 31rpx;
	top: 5rpx;
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #8f969b;
}

.placeholder-line {
	position: absolute;
	bottom: 5rpx;
	height: 6rpx;
	border-radius: 999rpx;
	background: #8f969b;
	transform-origin: left center;
}

.placeholder-line-a {
	left: 8rpx;
	width: 27rpx;
	transform: rotate(-34deg);
}

.placeholder-line-b {
	left: 27rpx;
	width: 30rpx;
	transform: rotate(33deg);
}

.card-foot {
	height: 98rpx;
	padding: 0 16rpx 22rpx;
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 12rpx;
	box-sizing: border-box;
}

.card-title {
	min-width: 0;
	flex: 1;
	color: #25282d;
	font-size: 28rpx;
	font-weight: 900;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.card-author {
	max-width: 50%;
	color: #a0a5ac;
	font-size: 22rpx;
	font-weight: 800;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.empty {
	padding: 150rpx 0;
	text-align: center;
	color: #a5aab1;
	font-size: 25rpx;
	font-weight: 700;
}

.empty-title {
	color: #25282d;
	font-size: 30rpx;
	font-weight: 900;
}

.empty-sub {
	margin-top: 10rpx;
}

.skeleton .empty-art {
	background: linear-gradient(105deg, #fff 0%, #f4f5f7 42%, #fff 72%);
	background-size: 240% 100%;
	animation: skeleton-sheen 1.4s ease-in-out infinite;
}

.usage-skeleton,
.text-skeleton {
	border-radius: 999rpx;
	background: #eef0f3;
}

.usage-skeleton {
	width: 112rpx;
	height: 20rpx;
}

.title-skeleton {
	width: 104rpx;
	height: 25rpx;
}

.author-skeleton {
	width: 76rpx;
	height: 21rpx;
}

@keyframes card-in {
	from {
		opacity: 0;
		transform: translateY(22rpx) scale(0.985);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes crystal-float {
	0%,
	100% {
		transform: translateY(0) scale(1);
	}
	50% {
		transform: translateY(-8rpx) scale(1.025);
	}
}

@keyframes bead-float {
	0%,
	100% {
		transform: translateY(0) scale(1);
	}
	50% {
		transform: translateY(-3rpx) scale(1.018);
	}
}

@keyframes charm-swing {
	0%,
	100% {
		transform: rotate(-5deg);
	}
	50% {
		transform: rotate(5deg) translateY(2rpx);
	}
}

@keyframes halo-breathe {
	0%,
	100% {
		opacity: 0.42;
		transform: scale(0.92);
	}
	50% {
		opacity: 0.74;
		transform: scale(1.05);
	}
}

@keyframes skeleton-sheen {
	0% {
		background-position: 120% 0;
	}
	100% {
		background-position: -120% 0;
	}
}
</style>
