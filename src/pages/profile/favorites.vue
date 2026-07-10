<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { DesignDetail } from '@/api';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useDesignStore } from '@/stores/design';
import { useMaterialsStore } from '@/stores/materials';
import { loadFavoriteDesigns, removeFavoriteDesign } from '@/utils/favorites';
import { summarizeComposition } from '@/utils/designComposition';
import { openDesignStudio } from '@/utils/designNavigation';

const favoriteItems = ref<DesignDetail[]>([]);
const designStore = useDesignStore();
const materialsStore = useMaterialsStore();
const favoriteCountText = computed(() => (favoriteItems.value.length ? `已收藏 ${favoriteItems.value.length} 个设计` : '把喜欢的设计先存起来'));

onShow(loadFavorites);

function loadFavorites() {
	favoriteItems.value = loadFavoriteDesigns();
}

function openDetail(item: DesignDetail) {
	uni.navigateTo({ url: `/pages/goods/detail/detail?id=${encodeURIComponent(item.id)}` });
}

function removeFavorite(item: DesignDetail, event?: Event) {
	event?.stopPropagation?.();
	removeFavoriteDesign(item.id);
	loadFavorites();
	uni.showToast({ title: '已取消收藏', icon: 'none' });
}

function useFavoriteDesign(item: DesignDetail, event?: Event) {
	event?.stopPropagation?.();
	if (!item.composition?.length) {
		openDetail(item);
		return;
	}
	designStore.applyDesignFromPlaza(item.composition, {
		source: 'plaza',
		handCircumferenceCm: item.handCircumferenceCm,
		hasUnavailableParts: item.hasUnavailableParts,
	});
	materialsStore.setSearchKeyword('');
	materialsStore.setCategory('in-use');
	uni.showToast({ title: '已套用收藏设计', icon: 'success' });
	setTimeout(() => {
		openDesignStudio('bracelet');
	}, 420);
}

function goPlaza() {
	uni.navigateTo({ url: '/pages/plaza/plaza' });
}

function goBack() {
	uni.navigateBack({
		fail: () => {
			uni.switchTab({ url: '/pages/profile/profile' });
		},
	});
}

function materialSummary(item: DesignDetail) {
	return summarizeComposition(item.composition, 3) || '暂无材质清单，可打开详情查看实物信息';
}

function hasUsableDesign(item: DesignDetail) {
	return item.composition?.length > 0;
}

function favoriteActionLabel(item: DesignDetail) {
	return hasUsableDesign(item) ? '使用设计' : '查看详情';
}

function priceText(item: DesignDetail) {
	return hasUsableDesign(item) ? `¥${totalPrice(item).toFixed(1)}` : '实物图';
}

function countText(item: DesignDetail) {
	return hasUsableDesign(item) ? `${beadCount(item)}颗` : '灵感';
}

function totalPrice(item: DesignDetail) {
	return item.composition.reduce((sum, row) => sum + row.price * row.quantity, 0);
}

function beadCount(item: DesignDetail) {
	return item.composition.reduce((sum, row) => sum + Math.max(1, row.quantity), 0);
}

function previewBeads(item: DesignDetail) {
	const rows = item.composition.flatMap((row) => Array.from({ length: Math.max(1, row.quantity) }, () => row));
	const visible = rows.slice(0, 12);
	return visible.map((row, index) => {
		const angle = -90 + index * (360 / Math.max(visible.length, 8));
		return {
			id: `${item.id}-${row.materialId}-${index}`,
			image: row.image,
			style: `transform: rotate(${angle}deg) translateX(58rpx) rotate(${-angle}deg);`,
		};
	});
}
</script>

<template>
	<view class="page app-subpage favorites-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="favorites-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">收藏灵感</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="head">
			<view>
				<view class="title">收藏灵感</view>
				<view class="sub">{{ favoriteCountText }}</view>
			</view>
			<view class="head-action" @tap="goPlaza">逛广场</view>
		</view>

		<view v-if="favoriteItems.length" class="grid">
			<view
				v-for="item in favoriteItems"
				:key="item.id"
				class="favorite-card"
				@tap="openDetail(item)"
			>
				<view class="preview">
					<view class="bracelet-shadow" />
					<view class="bracelet-ring">
						<image
							v-for="bead in previewBeads(item)"
							:key="bead.id"
							class="bead"
							:src="bead.image"
							mode="aspectFill"
							:style="bead.style"
						/>
						<view class="brand">养个石头</view>
					</view>
					<view class="usage">{{ item.usageCount }}人使用</view>
				</view>
				<view class="card-body">
					<view class="card-title">{{ item.title }}</view>
					<view class="card-author">{{ item.author }}</view>
					<view class="card-summary">{{ materialSummary(item) }}</view>
					<view class="card-foot">
						<view class="price">{{ priceText(item) }}</view>
						<view class="count">{{ countText(item) }}</view>
					</view>
					<view class="card-actions">
						<button class="use-btn" :class="{ 'use-btn--ghost': !hasUsableDesign(item) }" @tap.stop="useFavoriteDesign(item, $event)">
							{{ favoriteActionLabel(item) }}
						</button>
					</view>
				</view>
				<view class="unfavorite" @tap.stop="removeFavorite(item, $event)">♥</view>
			</view>
		</view>

		<view v-else class="empty">
			<view class="empty-art">
				<view class="empty-heart">♥</view>
				<view class="empty-orbit empty-orbit-a" />
				<view class="empty-orbit empty-orbit-b" />
			</view>
			<view class="empty-title">还没有收藏</view>
			<view class="empty-sub">在设计广场或详情页点“收藏”，灵感会出现在这里</view>
			<button class="empty-btn" @tap="goPlaza">去设计广场</button>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(120rpx + env(safe-area-inset-top)) 28rpx 140rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
:global(uni-app:has(.favorites-page) uni-tabbar),
:global(uni-app:has(.favorites-page) .uni-tabbar-bottom) {
	display: none;
}

:global(uni-page-body:has(> .favorites-page)) {
	height: 100%;
	padding-bottom: 0 !important;
}
/* #endif */

.favorites-nav {
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

.head {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 24rpx;
	padding: 8rpx 4rpx 28rpx;
}

.title {
	color: #101217;
	font-size: 42rpx;
	font-weight: 900;
	line-height: 1.15;
}

.sub {
	margin-top: 12rpx;
	color: #969aa3;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.2;
}

.head-action {
	height: 52rpx;
	padding: 0 20rpx;
	border-radius: 999rpx;
	background: #f5f5f7;
	color: #d92733;
	font-size: 23rpx;
	font-weight: 900;
	line-height: 52rpx;
	white-space: nowrap;
}

.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18rpx;
}

.favorite-card {
	position: relative;
	min-width: 0;
	border: 1rpx solid #eeeeef;
	border-radius: 8rpx;
	background: #fff;
	overflow: hidden;
	box-shadow: 0 8rpx 18rpx rgba(28, 31, 42, 0.04);
	transition: transform 120ms ease, opacity 120ms ease;
}

.favorite-card:active,
.head-action:active,
.empty-btn:active,
.unfavorite:active {
	opacity: 0.72;
}

.favorite-card:active {
	transform: scale(0.986);
}

.preview {
	position: relative;
	height: 240rpx;
	background:
		radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.98) 0 30%, rgba(248, 249, 251, 0.96) 62%, rgba(244, 245, 248, 0.92) 100%),
		linear-gradient(180deg, #fff 0%, #fbfbfc 100%);
	overflow: hidden;
}

.bracelet-shadow {
	position: absolute;
	left: 50%;
	top: 154rpx;
	width: 154rpx;
	height: 30rpx;
	border-radius: 50%;
	background: radial-gradient(ellipse, rgba(93, 98, 108, 0.13) 0%, rgba(93, 98, 108, 0) 70%);
	transform: translateX(-50%);
}

.bracelet-ring {
	position: absolute;
	left: 50%;
	top: 118rpx;
	width: 132rpx;
	height: 132rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translate(-50%, -50%);
}

.bead {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 24rpx;
	height: 24rpx;
	margin: -12rpx 0 0 -12rpx;
	border-radius: 50%;
	box-shadow:
		0 5rpx 10rpx rgba(52, 58, 68, 0.16),
		inset 4rpx 5rpx 8rpx rgba(255, 255, 255, 0.4);
}

.brand {
	width: 72rpx;
	color: rgba(198, 143, 150, 0.34);
	font-size: 14rpx;
	font-weight: 900;
	line-height: 1.1;
	text-align: center;
}

.usage {
	position: absolute;
	right: 14rpx;
	top: 14rpx;
	color: #aeb2b8;
	font-size: 20rpx;
	font-weight: 800;
}

.card-body {
	padding: 18rpx 16rpx 20rpx;
}

.card-title {
	color: #15171c;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.card-author {
	margin-top: 8rpx;
	color: #a0a3ab;
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1;
}

.card-summary {
	height: 56rpx;
	margin-top: 14rpx;
	color: #636873;
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1.32;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.card-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
	margin-top: 18rpx;
}

.card-actions {
	margin-top: 16rpx;
}

.use-btn {
	width: 100%;
	height: 52rpx;
	margin: 0;
	padding: 0;
	border-radius: 999rpx;
	background: #202633;
	color: #fff;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 52rpx;
}

.use-btn--ghost {
	background: #fff;
	color: #202633;
	border: 1rpx solid rgba(32, 38, 51, 0.18);
}

.use-btn:active {
	opacity: 0.76;
}

.price {
	color: #d92733;
	font-size: 26rpx;
	font-weight: 900;
	line-height: 1;
}

.count {
	color: #969aa3;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 1;
}

.unfavorite {
	position: absolute;
	right: 12rpx;
	top: 200rpx;
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.96);
	color: #d92733;
	font-size: 26rpx;
	font-weight: 900;
	line-height: 48rpx;
	text-align: center;
	box-shadow: 0 5rpx 16rpx rgba(26, 28, 35, 0.12);
}

.empty {
	min-height: calc(100vh - 260rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
}

.empty-art {
	position: relative;
	width: 180rpx;
	height: 180rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.empty-heart {
	position: relative;
	z-index: 2;
	color: #d92733;
	font-size: 70rpx;
	line-height: 1;
}

.empty-orbit {
	position: absolute;
	border: 5rpx solid #ececf0;
	border-radius: 50%;
}

.empty-orbit-a {
	width: 146rpx;
	height: 106rpx;
	transform: rotate(-24deg);
}

.empty-orbit-b {
	width: 112rpx;
	height: 146rpx;
	transform: rotate(18deg);
}

.empty-title {
	margin-top: 18rpx;
	color: #15171c;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1.2;
}

.empty-sub {
	margin-top: 12rpx;
	max-width: 440rpx;
	color: #999da6;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.42;
}

.empty-btn {
	width: 250rpx;
	height: 72rpx;
	margin-top: 30rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 72rpx;
}
</style>
