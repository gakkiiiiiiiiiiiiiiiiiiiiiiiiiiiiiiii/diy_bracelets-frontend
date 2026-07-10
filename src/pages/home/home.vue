<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, isMockApiFallbackError } from '@/api';
import { mockHomeData } from '@/data/mock';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { openDesignStudio } from '@/utils/designNavigation';

interface HomeTile {
	id: string;
	label: string;
	sub: string;
	image: string;
	path: string;
}

interface HomeBanner {
	id: string;
	image: string;
	link: string;
	title?: string;
	subtitle?: string;
	variant?: 'notice' | 'rabbit' | 'image' | 'service';
	badge?: string;
	bullets?: string[];
}

interface HomeDesign {
	id: string;
	title: string;
	author: string;
	image: string;
	cta: string;
}

interface HomeData {
	logoText: string;
	tiles: HomeTile[];
	banners: HomeBanner[];
	designs: HomeDesign[];
}

const data = ref<HomeData>(mockHomeData);
const supportOpen = ref(false);
const activeBannerIndex = ref(1);
const statText = '累计已有531,061条手串设计，在养个石头上诞生';
const serviceId = 'YGS-STONE';
const QR_GRID_SIZE = 25;
const QR_CELL_SIZE = 18;

const qrCells = Array.from({ length: QR_GRID_SIZE * QR_GRID_SIZE }, (_, index) => {
	const row = Math.floor(index / QR_GRID_SIZE);
	const col = index % QR_GRID_SIZE;
	const inFinder =
		(row < 7 && col < 7) ||
		(row < 7 && col > QR_GRID_SIZE - 8) ||
		(row > QR_GRID_SIZE - 8 && col < 7);
	const inLogo = row >= 10 && row <= 14 && col >= 10 && col <= 14;
	const timing =
		(row === 8 && col > 6 && col < QR_GRID_SIZE - 7 && col % 2 === 0) ||
		(col === 8 && row > 6 && row < QR_GRID_SIZE - 7 && row % 2 === 0);
	const cluster = ((row * 13 + col * 29 + row * col * 5) % 10 < 4) || ((row + col * 3) % 13 < 3);
	return {
		id: `${row}-${col}`,
		visible: !inFinder && !inLogo && (timing || cluster),
		style: `left:${col * QR_CELL_SIZE}rpx;top:${row * QR_CELL_SIZE}rpx`,
	};
}).filter((cell) => cell.visible);

onMounted(async () => {
	try {
		const res = await api.getHome();
		const remote = res as HomeData | null;
		if (remote?.tiles?.length && remote?.banners?.length) {
			data.value = remote;
		}
	} catch (e) {
		if (!isMockApiFallbackError(e)) console.warn('[home] API getHome failed, using fallback:', e);
		data.value = mockHomeData;
	}
});

function go(path: string) {
	if (!path) return;
	if (path === '/pages/design/entry') {
		openDesignStudio('bracelet');
		return;
	}
	if (path === '/pages/design/design') {
		openDesignStudio('bracelet');
		return;
	}
	if (path === '/pages/goods/goods') {
		uni.switchTab({ url: path });
		return;
	}
	uni.navigateTo({ url: path });
}

function goTile(tile: HomeTile) {
	if (tile.id === 'diy') {
		openDesignStudio('bracelet');
		return;
	}
	go(tile.path);
}

function goBanner(banner: HomeBanner) {
	if (banner.link) {
		go(banner.link);
		return;
	}
	openSupport();
}

function onBannerChange(e: { detail?: { current?: number } }) {
	activeBannerIndex.value = Number(e.detail?.current ?? 0) || 0;
}

function spacedBannerTitle(title?: string) {
	const text = title || '兔毛水晶';
	if (text.includes(' ')) return text;
	return text.split('').join(' ');
}

function openSupport() {
	supportOpen.value = true;
}

function closeSupport() {
	supportOpen.value = false;
}

function copyServiceId() {
	uni.setClipboardData({
		data: serviceId,
		success: () => {
			uni.showToast({ title: '已复制客服号', icon: 'none' });
		},
	});
}

function goPlaza() {
	uni.navigateTo({ url: '/pages/plaza/plaza' });
}

function goDesignDetail(design: HomeDesign) {
	uni.navigateTo({ url: `/pages/goods/detail/detail?id=${encodeURIComponent(design.id)}` });
}
</script>

<template>
	<view class="page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="stat">▸ {{ statText }}</view>

		<view class="brand">
			<view class="brand-mark">
				<view class="brand-face">
					<view class="brand-eye brand-eye--left" />
					<view class="brand-eye brand-eye--right" />
					<view class="brand-mouth" />
				</view>
				<view class="brand-shadow" />
				<view class="brand-stone" />
				<view class="brand-seal">热</view>
			</view>
			<view class="brand-title">养 个 石 头</view>
			<view class="brand-sub">全国首个手串DIY平台</view>
		</view>

		<view class="banner-wrap">
			<swiper
				class="banner-swiper"
				:current="activeBannerIndex"
				:circular="data.banners.length > 1"
				:autoplay="data.banners.length > 1"
				:interval="4600"
				:duration="340"
				@change="onBannerChange"
			>
				<swiper-item v-for="banner in data.banners" :key="banner.id">
					<view v-if="banner.variant === 'service'" class="service-banner" @tap="goBanner(banner)">
						<view class="service-banner__wash" />
						<view class="service-banner__copy">
							<view class="service-banner__title">{{ banner.title || '添加客服' }}</view>
							<view class="service-banner__arrow">↘</view>
						</view>
						<view class="service-banner__middle">
							<view class="service-banner__micro">JOIN US</view>
							<view class="service-banner__micro">FOR AN UNFORGETTABLE JOURNEY</view>
							<view class="service-banner__micro">THROUGH ART</view>
						</view>
						<view class="service-banner__headline">{{ banner.subtitle || '查看设计实物图！' }}</view>
						<view class="service-banner__qr">
							<view class="service-banner__qr-grid">
								<view
									v-for="cell in qrCells"
									:key="`banner-${cell.id}`"
									class="support-qr-cell service-banner__qr-cell"
									:style="cell.style"
								/>
							</view>
							<view class="service-banner__qr-corner service-banner__qr-corner--tl" />
							<view class="service-banner__qr-corner service-banner__qr-corner--tr" />
							<view class="service-banner__qr-corner service-banner__qr-corner--bl" />
							<view class="service-banner__qr-logo">石</view>
						</view>
					</view>

					<view v-else-if="banner.variant === 'notice'" class="notice-banner" @tap="goBanner(banner)">
						<view class="notice-banner__copy">
							<view class="notice-banner__title">{{ banner.title || '水晶购买须知' }}</view>
							<view class="notice-banner__sub">{{ banner.subtitle || 'NOTES OF PURCHASE' }}</view>
						</view>
						<view class="notice-banner__visual">
							<view class="notice-banner__twig" />
							<image class="notice-banner__main-bead" :src="banner.image" mode="aspectFill" />
							<view class="notice-banner__mini-bead notice-banner__mini-bead--top" />
							<view class="notice-banner__mini-bead notice-banner__mini-bead--bottom" />
						</view>
						<view class="notice-banner__points">
							<view
								v-for="point in banner.bullets || []"
								:key="point"
								class="notice-banner__point"
							>
								{{ point }}
							</view>
						</view>
						<view class="notice-banner__badge">{{ banner.badge || '买前必看' }}</view>
					</view>

					<view v-else class="rabbit-banner" @tap="goBanner(banner)">
						<view class="rabbit-banner__grain" />
						<view class="rabbit-banner__photo">
							<image class="rabbit-banner__img" :src="banner.image" mode="aspectFit" />
						</view>
						<view class="rabbit-banner__copy">
							<view class="rabbit-banner__title-row">
								<view class="rabbit-banner__title">{{ spacedBannerTitle(banner.title) }}</view>
								<view v-if="banner.badge" class="rabbit-banner__new">{{ banner.badge }}</view>
							</view>
							<view class="rabbit-banner__sub">{{ banner.subtitle || '好物 → 兔毛水晶' }}</view>
						</view>
						<view class="rabbit-banner__service" @tap.stop="openSupport">
							<view class="rabbit-banner__service-face">
								<view class="rabbit-banner__service-eye rabbit-banner__service-eye--left" />
								<view class="rabbit-banner__service-eye rabbit-banner__service-eye--right" />
								<view class="rabbit-banner__service-mouth" />
							</view>
						</view>
					</view>
				</swiper-item>
			</swiper>
			<view v-if="data.banners.length > 1" class="banner-dots">
				<view
					v-for="(_, index) in data.banners"
					:key="index"
					class="banner-dot"
					:class="{ active: activeBannerIndex === index }"
				/>
			</view>
		</view>

		<view class="tile-row">
			<view v-for="tile in data.tiles" :key="tile.id" class="tile" @tap="goTile(tile)">
				<image v-if="tile.image" class="tile-img" :src="tile.image" mode="aspectFill" />
				<view class="tile-label">{{ tile.label }}</view>
				<view class="tile-sub">{{ tile.sub }}</view>
			</view>
		</view>

		<view class="plaza-row" @tap="goPlaza">
			<view class="plaza-icon">
				<view class="plaza-icon__face" />
			</view>
			<view class="plaza-copy">
				<view class="plaza-title">设计广场</view>
				<view class="plaza-sub">从来自世界各地的设计中寻找灵感</view>
			</view>
			<view class="plaza-arrow">→</view>
		</view>

		<view v-if="data.designs.length" class="home-designs">
			<view class="home-designs__head">
				<view>
					<view class="home-designs__title">实物图精选</view>
					<view class="home-designs__sub">从热门搭配里继续创作</view>
				</view>
				<view class="home-designs__more" @tap="goPlaza">全部</view>
			</view>
			<scroll-view class="home-designs__rail" scroll-x :show-scrollbar="false">
				<view class="home-designs__track">
					<view
						v-for="design in data.designs"
						:key="design.id"
						class="home-design-card"
						@tap="goDesignDetail(design)"
					>
						<image class="home-design-card__img" :src="design.image" mode="aspectFill" />
						<view class="home-design-card__shade" />
						<view class="home-design-card__body">
							<view class="home-design-card__title">{{ design.title }}</view>
							<view class="home-design-card__author">{{ design.author }}</view>
							<view class="home-design-card__cta">{{ design.cta || '查看实物' }}</view>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>

		<view v-if="supportOpen" class="support-mask" @tap="closeSupport">
			<view class="support-sheet" @tap.stop>
				<view class="support-handle" />
				<view class="support-head">
					<view>
						<view class="support-title">添加客服</view>
						<view class="support-sub">查看设计实物图，确认库存、色差和手围</view>
					</view>
					<view class="support-close" @tap="closeSupport">×</view>
				</view>
				<view class="support-body">
					<view class="support-qr">
						<view class="support-qr-grid">
							<view
								v-for="cell in qrCells"
								:key="cell.id"
								class="support-qr-cell"
								:style="cell.style"
							/>
						</view>
						<view class="support-qr-corner support-qr-corner--tl" />
						<view class="support-qr-corner support-qr-corner--tr" />
						<view class="support-qr-corner support-qr-corner--bl" />
						<view class="support-qr-logo">石</view>
					</view>
					<view class="support-info">
						<view class="support-info-title">客服号</view>
						<view class="support-id">{{ serviceId }}</view>
						<view class="support-tip">发送设计截图或订单编号，可查询实物图、发货进度和售后处理。</view>
						<view class="support-actions">
							<button class="support-action primary" @tap="copyServiceId">复制客服号</button>
							<button class="support-action ghost" @tap="closeSupport">稍后再说</button>
						</view>
					</view>
				</view>
				<view class="support-note">工作日 10:00-19:00 人工回复，紧急订单请备注“加急”。</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(36rpx + env(safe-area-inset-top)) 44rpx 130rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
.page {
	padding-top: calc(118rpx + env(safe-area-inset-top));
}
/* #endif */

.stat {
	margin-top: 34rpx;
	color: #565b66;
	font-size: 26rpx;
	font-weight: 700;
	text-align: center;
}

.brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 100rpx 0 72rpx;
}

.brand-mark {
	position: relative;
	width: 204rpx;
	height: 160rpx;
	margin-bottom: 14rpx;
}

.brand-face {
	position: absolute;
	left: 24rpx;
	top: 0;
	width: 134rpx;
	height: 120rpx;
	border-radius: 52% 48% 46% 54%;
	border: 7rpx solid #0f1012;
	background: #fff;
	z-index: 2;
	box-sizing: border-box;
}

.brand-eye {
	position: absolute;
	top: 42rpx;
	width: 9rpx;
	height: 9rpx;
	border-radius: 50%;
	background: #111;
}

.brand-eye--left {
	left: 40rpx;
}

.brand-eye--right {
	right: 40rpx;
}

.brand-mouth {
	position: absolute;
	left: 50rpx;
	top: 70rpx;
	width: 34rpx;
	height: 16rpx;
	border-bottom: 6rpx solid #111;
	border-radius: 0 0 999rpx 999rpx;
}

.brand-shadow {
	position: absolute;
	right: 12rpx;
	bottom: 18rpx;
	width: 104rpx;
	height: 52rpx;
	border-radius: 50%;
	background: #0f1012;
	z-index: 1;
}

.brand-stone {
	position: absolute;
	left: 80rpx;
	top: 62rpx;
	width: 94rpx;
	height: 64rpx;
	background:
		linear-gradient(28deg, transparent 49%, #fff 50% 54%, transparent 55%),
		linear-gradient(145deg, #17171a 0%, #404044 100%);
	transform: rotate(26deg);
	clip-path: polygon(12% 22%, 84% 0, 100% 70%, 30% 100%);
	z-index: 3;
}

.brand-seal {
	position: absolute;
	right: 22rpx;
	top: 2rpx;
	width: 28rpx;
	height: 28rpx;
	border-radius: 50%;
	background: #dd2d37;
	color: #fff;
	font-size: 15rpx;
	font-weight: 900;
	line-height: 28rpx;
	text-align: center;
	z-index: 4;
}

.brand-title {
	color: #151618;
	font-size: 36rpx;
	font-weight: 900;
	letter-spacing: 10rpx;
	text-indent: 10rpx;
}

.brand-sub {
	margin-top: 8rpx;
	color: #5c5f66;
	font-size: 18rpx;
	font-weight: 900;
	letter-spacing: 4rpx;
	text-indent: 4rpx;
}

.banner-wrap {
	margin: 0 0 30rpx;
	overflow: visible;
}

.banner-swiper {
	height: 180rpx;
	overflow: hidden;
}

.notice-banner {
	position: relative;
	height: 180rpx;
	border: 2rpx solid #ead7c3;
	background:
		linear-gradient(90deg, rgba(255, 255, 255, 0.82), rgba(249, 237, 219, 0.72)),
		#fbf1e6;
	box-sizing: border-box;
	overflow: hidden;
	display: flex;
	align-items: center;
	padding: 0 28rpx;
	transition: transform 120ms ease;
}

.notice-banner::before,
.notice-banner::after {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.notice-banner::before {
	background:
		linear-gradient(90deg, rgba(91, 43, 37, 0.08), transparent 38%),
		repeating-linear-gradient(0deg, rgba(152, 112, 78, 0.05) 0 1rpx, transparent 1rpx 16rpx);
}

.notice-banner::after {
	left: 34rpx;
	right: 34rpx;
	top: auto;
	bottom: 18rpx;
	height: 2rpx;
	background: linear-gradient(90deg, transparent, rgba(145, 94, 68, 0.22), transparent);
}

.notice-banner__copy {
	position: relative;
	z-index: 2;
	width: 390rpx;
	min-width: 0;
}

.notice-banner__title {
	color: #43282a;
	font-size: 42rpx;
	font-weight: 900;
	line-height: 1.08;
	letter-spacing: 2rpx;
	white-space: nowrap;
}

.notice-banner__sub {
	margin-top: 8rpx;
	color: #7d5d50;
	font-size: 14rpx;
	font-weight: 900;
	letter-spacing: 4rpx;
}

.notice-banner__visual {
	position: absolute;
	right: 108rpx;
	top: 20rpx;
	z-index: 2;
	width: 150rpx;
	height: 138rpx;
}

.notice-banner__twig {
	position: absolute;
	right: 6rpx;
	top: 10rpx;
	width: 118rpx;
	height: 8rpx;
	border-radius: 999rpx;
	background: linear-gradient(90deg, #9c6a46, #473026);
	transform: rotate(-55deg);
	transform-origin: right center;
	box-shadow:
		-34rpx -5rpx 0 -2rpx #7d5136,
		-72rpx 8rpx 0 -3rpx rgba(93, 61, 42, 0.72);
}

.notice-banner__main-bead {
	position: absolute;
	left: 24rpx;
	top: 48rpx;
	width: 66rpx;
	height: 66rpx;
	border-radius: 50%;
	box-shadow:
		0 9rpx 16rpx rgba(87, 58, 44, 0.16),
		inset 8rpx 10rpx 14rpx rgba(255, 255, 255, 0.42);
}

.notice-banner__mini-bead {
	position: absolute;
	width: 22rpx;
	height: 22rpx;
	border-radius: 50%;
	background:
		radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.88), rgba(225, 206, 184, 0.45) 38%, rgba(133, 93, 70, 0.38));
	box-shadow: 0 5rpx 10rpx rgba(80, 55, 39, 0.14);
}

.notice-banner__mini-bead--top {
	left: 84rpx;
	top: 36rpx;
}

.notice-banner__mini-bead--bottom {
	left: 92rpx;
	top: 92rpx;
}

.notice-banner__points {
	position: absolute;
	right: 32rpx;
	top: 36rpx;
	z-index: 2;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.notice-banner__point {
	position: relative;
	padding-left: 16rpx;
	color: #8a5f48;
	font-size: 15rpx;
	font-weight: 900;
	white-space: nowrap;
}

.notice-banner__point::before {
	content: '';
	position: absolute;
	left: 0;
	top: 50%;
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #a45f46;
	transform: translateY(-50%);
}

.notice-banner__badge {
	position: absolute;
	right: 26rpx;
	bottom: 22rpx;
	z-index: 2;
	width: 44rpx;
	padding: 8rpx 5rpx;
	background: #8b5b3f;
	color: #fff7ec;
	font-size: 17rpx;
	font-weight: 900;
	line-height: 1.16;
	text-align: center;
	box-sizing: border-box;
}

.banner-dots {
	height: 22rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	margin-top: -18rpx;
	position: relative;
	z-index: 3;
}

.banner-dot {
	width: 11rpx;
	height: 6rpx;
	border-radius: 999rpx;
	background: #ded4cd;
	transition: width 160ms ease, background-color 160ms ease;
}

.banner-dot.active {
	width: 26rpx;
	background: #dc2f3a;
}

.service-banner {
	position: relative;
	height: 180rpx;
	background:
		radial-gradient(circle at 68% 8%, rgba(86, 225, 120, 0.9), transparent 28%),
		radial-gradient(circle at 44% 54%, rgba(8, 190, 232, 0.86), transparent 38%),
		linear-gradient(128deg, #ed842e 0%, #f59a34 20%, #19a4ca 48%, #22313f 74%, #ef9f85 100%);
	box-sizing: border-box;
	overflow: hidden;
	display: flex;
	align-items: center;
	padding: 0 16rpx 0 28rpx;
	box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.22), 0 10rpx 24rpx rgba(29, 37, 44, 0.08);
	transition: transform 120ms ease;
}

.service-banner::before,
.service-banner::after {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.service-banner::before {
	background:
		repeating-linear-gradient(163deg, rgba(255, 255, 255, 0.14) 0 2rpx, transparent 2rpx 16rpx),
		linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 35%, rgba(0, 0, 0, 0.18) 72%, rgba(255, 255, 255, 0.08));
	mix-blend-mode: screen;
}

.service-banner::after {
	inset: auto 0 0;
	height: 50rpx;
	background: linear-gradient(0deg, rgba(0, 0, 0, 0.1), transparent);
}

.service-banner__wash {
	position: absolute;
	left: -38rpx;
	top: -20rpx;
	width: 245rpx;
	height: 250rpx;
	background:
		radial-gradient(circle at 48% 34%, rgba(255, 236, 151, 0.62), transparent 42%),
		radial-gradient(circle at 26% 78%, rgba(237, 73, 73, 0.72), transparent 44%);
	filter: blur(2rpx);
	opacity: 0.76;
}

.service-banner__copy,
.service-banner__middle,
.service-banner__headline,
.service-banner__qr {
	position: relative;
	z-index: 2;
}

.service-banner__copy {
	width: 138rpx;
	color: #fff;
	text-shadow: 0 3rpx 10rpx rgba(42, 33, 28, 0.28);
	flex-shrink: 0;
}

.service-banner__title {
	font-size: 39rpx;
	font-weight: 300;
	line-height: 1.08;
	letter-spacing: 4rpx;
	text-indent: 4rpx;
	white-space: nowrap;
}

.service-banner__arrow {
	margin-top: 16rpx;
	margin-left: 12rpx;
	font-size: 42rpx;
	font-weight: 300;
	line-height: 1;
}

.service-banner__middle {
	width: 84rpx;
	margin-left: 0;
	margin-right: 8rpx;
	color: rgba(255, 255, 255, 0.78);
	font-size: 8rpx;
	font-weight: 900;
	line-height: 1.45;
	letter-spacing: 1rpx;
	text-transform: uppercase;
}

.service-banner__headline {
	flex: 1;
	min-width: 0;
	color: #fff;
	font-size: 32rpx;
	font-weight: 300;
	line-height: 1.1;
	letter-spacing: 2rpx;
	text-align: center;
	text-shadow: 0 4rpx 12rpx rgba(10, 18, 24, 0.24);
	white-space: nowrap;
}

.service-banner__qr {
	width: 92rpx;
	height: 92rpx;
	margin-left: 10rpx;
	padding: 8rpx;
	background: #fff;
	box-shadow: 0 8rpx 16rpx rgba(17, 23, 30, 0.12);
	box-sizing: border-box;
	flex-shrink: 0;
}

.service-banner__qr-grid {
	position: absolute;
	left: 8rpx;
	top: 8rpx;
	width: 450rpx;
	height: 450rpx;
	transform: scale(0.168);
	transform-origin: left top;
}

.service-banner__qr-cell {
	width: 16rpx;
	height: 16rpx;
	border-radius: 2rpx;
}

.service-banner__qr-corner {
	position: absolute;
	width: 20rpx;
	height: 20rpx;
	border: 4rpx solid #15171c;
	border-radius: 3rpx;
	box-shadow: inset 0 0 0 4rpx #fff;
	box-sizing: border-box;
}

.service-banner__qr-corner--tl {
	left: 10rpx;
	top: 10rpx;
}

.service-banner__qr-corner--tr {
	right: 10rpx;
	top: 10rpx;
}

.service-banner__qr-corner--bl {
	left: 10rpx;
	bottom: 10rpx;
}

.service-banner__qr-logo {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 22rpx;
	height: 22rpx;
	border-radius: 6rpx;
	background: #d92733;
	color: #fff;
	font-size: 13rpx;
	font-weight: 900;
	line-height: 22rpx;
	text-align: center;
	transform: translate(-50%, -50%);
}

.rabbit-banner {
	position: relative;
	height: 180rpx;
	background:
		linear-gradient(110deg, rgba(116, 52, 25, 0.82), rgba(210, 176, 121, 0.45) 45%, rgba(249, 241, 214, 0.92)),
		#dfc391;
	box-sizing: border-box;
	overflow: hidden;
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 0 22rpx 0 24rpx;
	box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.3), 0 10rpx 24rpx rgba(70, 51, 31, 0.08);
	transition: transform 120ms ease;
}

.rabbit-banner::before,
.rabbit-banner::after {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.rabbit-banner::before {
	background:
		radial-gradient(circle at 12% 70%, rgba(255, 220, 170, 0.88) 0 8%, transparent 24%),
		radial-gradient(circle at 58% 42%, rgba(255, 255, 255, 0.5) 0 12%, transparent 38%),
		linear-gradient(155deg, transparent 0 68%, rgba(250, 231, 177, 0.9) 69% 100%);
	mix-blend-mode: screen;
}

.rabbit-banner::after {
	background:
		repeating-linear-gradient(168deg, rgba(79, 56, 34, 0.08) 0 1rpx, transparent 1rpx 12rpx),
		linear-gradient(90deg, rgba(42, 25, 17, 0.2), transparent 42%, rgba(255, 255, 255, 0.22));
}

.rabbit-banner__grain {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 38rpx;
	background: repeating-linear-gradient(160deg, rgba(196, 150, 85, 0.42) 0 2rpx, transparent 2rpx 10rpx);
	opacity: 0.72;
}

.rabbit-banner__photo,
.rabbit-banner__copy,
.rabbit-banner__service {
	position: relative;
	z-index: 2;
}

.rabbit-banner__photo {
	width: 158rpx;
	height: 140rpx;
	margin-left: -16rpx;
	border-radius: 0;
	flex-shrink: 0;
	overflow: visible;
	background: transparent;
	box-shadow: none;
}

.rabbit-banner__img {
	width: 100%;
	height: 100%;
	display: block;
	filter: drop-shadow(0 10rpx 14rpx rgba(70, 43, 22, 0.12));
	transform: scale(1.28);
	transform-origin: center;
}

.rabbit-banner__copy {
	flex: 1;
	min-width: 0;
	color: #fff;
	text-align: center;
	text-shadow: 0 4rpx 12rpx rgba(62, 41, 24, 0.42);
}

.rabbit-banner__title-row {
	display: inline-flex;
	align-items: flex-start;
	justify-content: center;
	gap: 10rpx;
	max-width: 100%;
}

.rabbit-banner__title {
	color: #fffaf0;
	font-size: 48rpx;
	font-weight: 900;
	line-height: 1.05;
	letter-spacing: 6rpx;
	text-indent: 6rpx;
	white-space: nowrap;
}

.rabbit-banner__new {
	margin-top: -14rpx;
	height: 32rpx;
	padding: 0 10rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 19rpx;
	font-weight: 900;
	line-height: 32rpx;
	transform: rotate(-8deg);
	text-indent: 0;
	letter-spacing: 0;
	text-shadow: none;
	box-shadow: 0 4rpx 10rpx rgba(115, 31, 20, 0.22);
}

.rabbit-banner__sub {
	display: inline-flex;
	margin-top: 18rpx;
	padding: 5rpx 20rpx;
	border-radius: 999rpx;
	background: rgba(255, 250, 238, 0.7);
	color: #583b22;
	font-size: 19rpx;
	font-weight: 900;
	line-height: 1.2;
	text-shadow: none;
}

.rabbit-banner__service {
	width: 68rpx;
	height: 68rpx;
	border-radius: 50%;
	border: 6rpx solid rgba(255, 255, 255, 0.9);
	background: #f5ead3;
	box-shadow: 0 6rpx 16rpx rgba(76, 52, 32, 0.18);
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.rabbit-banner__service-face {
	position: relative;
	width: 36rpx;
	height: 32rpx;
	border: 4rpx solid #1c1d20;
	border-radius: 48% 52% 46% 54%;
	box-sizing: border-box;
}

.rabbit-banner__service-eye {
	position: absolute;
	top: 10rpx;
	width: 4rpx;
	height: 4rpx;
	border-radius: 50%;
	background: #1c1d20;
}

.rabbit-banner__service-eye--left {
	left: 9rpx;
}

.rabbit-banner__service-eye--right {
	right: 9rpx;
}

.rabbit-banner__service-mouth {
	position: absolute;
	left: 12rpx;
	bottom: 6rpx;
	width: 10rpx;
	height: 5rpx;
	border-bottom: 3rpx solid #1c1d20;
	border-radius: 0 0 999rpx 999rpx;
}

.tile-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 38rpx;
}

.tile {
	min-height: 292rpx;
	background: #fbfbfb;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	transition: transform 120ms ease;
}

.tile:active,
.plaza-row:active,
.notice-banner:active,
.service-banner:active,
.rabbit-banner:active {
	transform: scale(0.985);
}

.tile-img {
	width: 132rpx;
	height: 132rpx;
	border-radius: 50%;
	margin-bottom: 18rpx;
	box-shadow: 0 12rpx 24rpx rgba(46, 50, 66, 0.12);
}

.tile-label {
	color: #1c1e22;
	font-size: 23rpx;
	font-weight: 900;
	letter-spacing: 0;
}

.tile-sub {
	margin-top: 4rpx;
	color: #111;
	font-size: 32rpx;
	font-weight: 900;
}

.plaza-row {
	margin-top: 34rpx;
	min-height: 122rpx;
	background: #fff;
	display: flex;
	align-items: center;
	gap: 18rpx;
	padding: 0 8rpx;
	box-sizing: border-box;
	transition: transform 120ms ease;
}

.plaza-icon {
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	border: 4rpx solid #1d1f24;
	position: relative;
	box-sizing: border-box;
}

.plaza-icon__face::before,
.plaza-icon__face::after {
	content: '';
	position: absolute;
	top: 20rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background: #1d1f24;
}

.plaza-icon__face::before {
	left: 16rpx;
}

.plaza-icon__face::after {
	right: 16rpx;
}

.plaza-icon::after {
	content: '';
	position: absolute;
	left: 18rpx;
	bottom: 14rpx;
	width: 18rpx;
	height: 8rpx;
	border-bottom: 4rpx solid #1d1f24;
	border-radius: 0 0 999rpx 999rpx;
}

.plaza-copy {
	flex: 1;
	min-width: 0;
}

.plaza-title {
	color: #17191d;
	font-size: 32rpx;
	font-weight: 900;
}

.plaza-sub {
	margin-top: 8rpx;
	color: #5f636d;
	font-size: 25rpx;
	font-weight: 800;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.plaza-arrow {
	width: 58rpx;
	color: #1a1d22;
	font-size: 40rpx;
	font-weight: 900;
	text-align: right;
}

.home-designs {
	margin-top: 18rpx;
}

.home-designs__head {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 24rpx;
	padding: 0 4rpx;
}

.home-designs__title {
	color: #17191d;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1.18;
}

.home-designs__sub {
	margin-top: 8rpx;
	color: #6a6e78;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.2;
}

.home-designs__more {
	height: 46rpx;
	padding: 0 20rpx;
	border-radius: 999rpx;
	background: #f5f5f6;
	color: #202329;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 46rpx;
	flex-shrink: 0;
}

.home-designs__rail {
	margin-top: 18rpx;
	width: 100%;
	white-space: nowrap;
}

.home-designs__track {
	display: inline-flex;
	gap: 18rpx;
	padding: 0 4rpx 6rpx;
}

.home-design-card {
	position: relative;
	width: 246rpx;
	height: 286rpx;
	overflow: hidden;
	background: #f6f6f7;
	flex-shrink: 0;
	transition: transform 120ms ease;
}

.home-design-card:active,
.home-designs__more:active {
	transform: scale(0.985);
}

.home-design-card__img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	display: block;
}

.home-design-card__shade {
	position: absolute;
	inset: 0;
	background:
		linear-gradient(180deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.1) 42%, rgba(0, 0, 0, 0.66) 100%),
		radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.36), transparent 34%);
}

.home-design-card__body {
	position: absolute;
	left: 18rpx;
	right: 18rpx;
	bottom: 18rpx;
	color: #fff;
	text-shadow: 0 3rpx 10rpx rgba(10, 12, 16, 0.32);
}

.home-design-card__title,
.home-design-card__author {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.home-design-card__title {
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1.18;
}

.home-design-card__author {
	margin-top: 6rpx;
	color: rgba(255, 255, 255, 0.82);
	font-size: 20rpx;
	font-weight: 800;
	line-height: 1.2;
}

.home-design-card__cta {
	display: inline-flex;
	align-items: center;
	height: 38rpx;
	margin-top: 14rpx;
	padding: 0 14rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.9);
	color: #17191d;
	font-size: 19rpx;
	font-weight: 900;
	line-height: 38rpx;
	text-shadow: none;
}

.support-mask {
	position: fixed;
	inset: 0;
	z-index: 60;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding: 24rpx;
	background: rgba(16, 18, 24, 0.38);
	box-sizing: border-box;
}

.support-sheet {
	width: 100%;
	max-width: 720rpx;
	padding: 16rpx 26rpx calc(26rpx + env(safe-area-inset-bottom));
	border-radius: 22rpx 22rpx 0 0;
	background: #fff;
	box-shadow: 0 -18rpx 42rpx rgba(20, 23, 31, 0.18);
	box-sizing: border-box;
	animation: support-in 160ms ease-out both;
}

.support-handle {
	width: 74rpx;
	height: 8rpx;
	margin: 0 auto 24rpx;
	border-radius: 999rpx;
	background: #e4e5e8;
}

.support-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
}

.support-title {
	color: #15171c;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1.2;
}

.support-sub {
	margin-top: 10rpx;
	color: #686d77;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.38;
}

.support-close {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	background: #f3f4f6;
	color: #626670;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 52rpx;
	text-align: center;
	flex-shrink: 0;
}

.support-body {
	display: flex;
	gap: 24rpx;
	margin-top: 28rpx;
}

.support-qr {
	position: relative;
	width: 238rpx;
	height: 238rpx;
	padding: 18rpx;
	border-radius: 14rpx;
	background: #fff;
	border: 1rpx solid #ededf0;
	box-shadow: 0 12rpx 26rpx rgba(24, 27, 38, 0.08);
	box-sizing: border-box;
	flex-shrink: 0;
}

.support-qr-grid {
	position: absolute;
	left: 18rpx;
	top: 18rpx;
	width: 450rpx;
	height: 450rpx;
	transform: scale(0.448);
	transform-origin: left top;
}

.support-qr-cell {
	position: absolute;
	width: 16rpx;
	height: 16rpx;
	border-radius: 3rpx;
	background: #15171c;
}

.support-qr-corner {
	position: absolute;
	width: 48rpx;
	height: 48rpx;
	border: 8rpx solid #15171c;
	border-radius: 8rpx;
	box-shadow: inset 0 0 0 9rpx #fff;
	box-sizing: border-box;
}

.support-qr-corner--tl {
	left: 22rpx;
	top: 22rpx;
}

.support-qr-corner--tr {
	right: 22rpx;
	top: 22rpx;
}

.support-qr-corner--bl {
	left: 22rpx;
	bottom: 22rpx;
}

.support-qr-logo {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 54rpx;
	height: 54rpx;
	border-radius: 14rpx;
	background: #d92733;
	color: #fff;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 54rpx;
	text-align: center;
	transform: translate(-50%, -50%);
	box-shadow: 0 8rpx 18rpx rgba(217, 39, 51, 0.22);
}

.support-info {
	flex: 1;
	min-width: 0;
	padding-top: 4rpx;
}

.support-info-title {
	color: #9a9da5;
	font-size: 22rpx;
	font-weight: 900;
}

.support-id {
	margin-top: 8rpx;
	color: #111318;
	font-size: 34rpx;
	font-weight: 900;
	letter-spacing: 1rpx;
	word-break: break-all;
}

.support-tip {
	margin-top: 18rpx;
	color: #5e636e;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.48;
}

.support-actions {
	display: flex;
	gap: 14rpx;
	margin-top: 22rpx;
}

.support-action {
	height: 66rpx;
	line-height: 66rpx;
	margin: 0;
	padding: 0 22rpx;
	border-radius: 999rpx;
	font-size: 23rpx;
	font-weight: 900;
	white-space: nowrap;
}

.support-action.primary {
	background: #d92733;
	color: #fff;
}

.support-action.ghost {
	background: #f5f5f6;
	color: #4f535c;
}

.support-note {
	margin-top: 24rpx;
	padding: 18rpx 20rpx;
	border-radius: 12rpx;
	background: #fafafa;
	color: #7a7e88;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.42;
}

@keyframes support-in {
	from {
		opacity: 0;
		transform: translateY(26rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
