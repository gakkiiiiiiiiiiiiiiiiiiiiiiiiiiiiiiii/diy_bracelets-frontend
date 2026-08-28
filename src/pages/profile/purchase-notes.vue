<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useContentStore } from '@/stores/content';
import { openDesignStudio } from '@/utils/designNavigation';
import { resolveStaticUrl } from '@/utils/staticUrl';

interface SampleBead {
	id: string;
	name: string;
	image: string;
	tag: string;
}

const sampleBeads: SampleBead[] = [
	{
		id: 'rutile',
		name: '金发晶',
		image: '/static/materials/reference-crystals/golden-rutile/golden-rutile-preview.png',
		tag: '发丝',
	},
	{
		id: 'phantom',
		name: '绿幽灵',
		image: '/static/materials/reference-crystals/green-phantom/green-phantom-preview.png',
		tag: '内含物',
	},
	{
		id: 'tiger',
		name: '黄虎眼',
		image: '/static/materials/reference-crystals/yellow-tiger-eye/yellow-tiger-eye-preview.png',
		tag: '猫眼光',
	},
	{
		id: 'moon',
		name: '蓝月光',
		image: '/static/materials/reference-crystals/blue-moonstone/blue-moonstone-preview.png',
		tag: '柔光',
	},
];
const contentStore = useContentStore();
const purchase = computed(() => contentStore.support.purchase);
const sections = computed(() => purchase.value.sections);

onShow(() => {
	void contentStore.fetchContent();
	uni.hideTabBar({ animation: false, fail: () => undefined });
});

onHide(() => {
	uni.showTabBar({ animation: false, fail: () => undefined });
});

onBeforeUnmount(() => {
	uni.showTabBar({ animation: false, fail: () => undefined });
});

function goDesign() {
	uni.showTabBar({ animation: false, fail: () => undefined });
	openDesignStudio('bracelet');
}

function goGoods() {
	uni.showTabBar({ animation: false, fail: () => undefined });
	uni.navigateTo({ url: '/pages/goods/search/search' });
}

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}

function contactService() {
	uni.showModal({
		title: '联系客服',
		content: purchase.value.contactText,
		showCancel: false,
	});
}
</script>

<template>
	<view class="page app-subpage purchase-notes-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="purchase-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">{{ purchase.title }}</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="hero">
			<view class="hero-copy">
				<view class="hero-kicker">{{ purchase.heroKicker }}</view>
				<view class="hero-title">{{ purchase.title }}</view>
				<view class="hero-sub">{{ purchase.subtitle }}</view>
			</view>
			<view class="hero-visual">
				<view class="hero-twig" />
				<image class="hero-bead hero-bead--main" :src="resolveStaticUrl(sampleBeads[1].image)" mode="aspectFill" />
				<image class="hero-bead hero-bead--small" :src="resolveStaticUrl(sampleBeads[0].image)" mode="aspectFill" />
				<view class="hero-badge">买前必看</view>
			</view>
		</view>

		<view class="sample-strip">
			<view v-for="bead in sampleBeads" :key="bead.id" class="sample-card">
				<image class="sample-img" :src="resolveStaticUrl(bead.image)" mode="aspectFill" />
				<view class="sample-name">{{ bead.name }}</view>
				<view class="sample-tag">{{ bead.tag }}</view>
			</view>
		</view>

		<view class="section-list">
			<view
				v-for="section in sections"
				:key="section.id"
				class="note-card"
				:class="`note-card--${section.tone}`"
			>
				<view class="note-head">
					<view class="note-mark" />
					<view>
						<view class="note-title">{{ section.title }}</view>
						<view class="note-subtitle">{{ section.subtitle }}</view>
					</view>
				</view>
				<view class="note-points">
					<view v-for="(point, index) in section.points" :key="point" class="note-point">
						<view class="note-index">{{ index + 1 }}</view>
						<view class="note-text">{{ point }}</view>
					</view>
				</view>
			</view>
		</view>

		<view class="service-panel">
			<view class="service-title">不确定怎么选？</view>
			<view class="service-sub">{{ purchase.contactText }}</view>
			<view class="service-actions">
				<button class="service-btn primary" @tap="goDesign">去设计手串</button>
				<button class="service-btn" @tap="goGoods">找好物</button>
				<button class="service-btn ghost" @tap="contactService">联系客服</button>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(142rpx + env(safe-area-inset-top)) 28rpx 146rpx;
	box-sizing: border-box;
}

.purchase-nav {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 100;
	height: calc(118rpx + env(safe-area-inset-top));
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: calc(34rpx + env(safe-area-inset-top)) 26rpx 0;
	background: #fff;
	box-sizing: border-box;
}

.nav-side {
	width: 216rpx;
	height: 72rpx;
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
	max-width: 360rpx;
	transform: translate(-50%, -50%);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #111216;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1;
}

/* #ifdef H5 */
:global(uni-app:has(.purchase-notes-page) uni-tabbar),
:global(uni-app:has(.purchase-notes-page) .uni-tabbar-bottom) {
	display: none !important;
}

:global(uni-page-body:has(> .purchase-notes-page)) {
	padding-bottom: 0 !important;
}
/* #endif */

.hero {
	position: relative;
	min-height: 292rpx;
	border-radius: 10rpx;
	border: 1rpx solid #ede7df;
	background:
		linear-gradient(90deg, rgba(255, 255, 255, 0.96), rgba(253, 248, 241, 0.95)),
		#fff;
	overflow: hidden;
	padding: 34rpx 28rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
}

.hero::before,
.hero::after {
	content: '';
	position: absolute;
	left: 34rpx;
	right: 34rpx;
	height: 1rpx;
	background: #d8c6ad;
	opacity: 0.74;
}

.hero::before {
	top: 34rpx;
}

.hero::after {
	bottom: 34rpx;
}

.hero-copy {
	position: relative;
	z-index: 2;
	flex: 1;
	min-width: 0;
}

.hero-kicker {
	color: #9d8464;
	font-size: 19rpx;
	font-weight: 900;
	letter-spacing: 0;
}

.hero-title {
	margin-top: 12rpx;
	color: #2a2119;
	font-size: 50rpx;
	font-weight: 900;
	line-height: 1.12;
}

.hero-sub {
	margin-top: 18rpx;
	max-width: 430rpx;
	color: #6f6255;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.5;
}

.hero-visual {
	position: relative;
	z-index: 2;
	width: 210rpx;
	height: 220rpx;
	flex-shrink: 0;
}

.hero-twig {
	position: absolute;
	right: 16rpx;
	top: 24rpx;
	width: 124rpx;
	height: 144rpx;
	border-right: 5rpx solid rgba(96, 67, 42, 0.48);
	border-radius: 50%;
	transform: rotate(22deg);
}

.hero-twig::before,
.hero-twig::after {
	content: '';
	position: absolute;
	right: 16rpx;
	width: 54rpx;
	height: 3rpx;
	border-radius: 999rpx;
	background: rgba(96, 67, 42, 0.42);
	transform-origin: right center;
}

.hero-twig::before {
	top: 44rpx;
	transform: rotate(-32deg);
}

.hero-twig::after {
	top: 92rpx;
	transform: rotate(28deg);
}

.hero-bead {
	position: absolute;
	border-radius: 50%;
	box-shadow:
		inset 10rpx 12rpx 24rpx rgba(255, 255, 255, 0.56),
		0 18rpx 34rpx rgba(66, 44, 29, 0.14);
}

.hero-bead--main {
	right: 48rpx;
	bottom: 20rpx;
	width: 116rpx;
	height: 116rpx;
}

.hero-bead--small {
	left: 10rpx;
	top: 28rpx;
	width: 72rpx;
	height: 72rpx;
}

.hero-badge {
	position: absolute;
	right: 4rpx;
	top: 8rpx;
	padding: 8rpx 12rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 20rpx;
	font-weight: 900;
	box-shadow: 0 10rpx 22rpx rgba(217, 39, 51, 0.22);
}

.sample-strip {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 14rpx;
	margin-top: 22rpx;
}

.sample-card {
	min-width: 0;
	border-radius: 8rpx;
	background: #f8f8fa;
	padding: 18rpx 10rpx 16rpx;
	text-align: center;
	box-sizing: border-box;
}

.sample-img {
	width: 76rpx;
	height: 76rpx;
	border-radius: 50%;
	box-shadow: inset 6rpx 8rpx 16rpx rgba(255, 255, 255, 0.42);
}

.sample-name {
	margin-top: 12rpx;
	color: #17191f;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 1.15;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.sample-tag {
	margin-top: 7rpx;
	color: #9b9da5;
	font-size: 19rpx;
	font-weight: 800;
	line-height: 1.1;
	white-space: nowrap;
}

.section-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
	margin-top: 26rpx;
}

.note-card {
	border-radius: 10rpx;
	background: #fafafa;
	padding: 26rpx 24rpx 28rpx;
	box-sizing: border-box;
}

.note-card--texture {
	background: #fbf7ef;
}

.note-card--color {
	background: #fdf2f5;
}

.note-card--size {
	background: #f4f8fc;
}

.note-card--shipping {
	background: #f5f8f2;
}

.note-head {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.note-mark {
	width: 11rpx;
	height: 54rpx;
	border-radius: 999rpx;
	background: #d92733;
	box-shadow: 0 8rpx 18rpx rgba(217, 39, 51, 0.18);
}

.note-title {
	color: #15171c;
	font-size: 31rpx;
	font-weight: 900;
	line-height: 1.15;
}

.note-subtitle {
	margin-top: 8rpx;
	color: #777a82;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.2;
}

.note-points {
	margin-top: 22rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.note-point {
	display: flex;
	gap: 15rpx;
	align-items: flex-start;
}

.note-index {
	width: 34rpx;
	height: 34rpx;
	border-radius: 50%;
	background: #fff;
	color: #d92733;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 34rpx;
	text-align: center;
	flex-shrink: 0;
	box-shadow: 0 4rpx 12rpx rgba(34, 37, 47, 0.04);
}

.note-text {
	flex: 1;
	min-width: 0;
	color: #3f424a;
	font-size: 25rpx;
	font-weight: 800;
	line-height: 1.52;
}

.service-panel {
	margin-top: 26rpx;
	border-radius: 10rpx;
	background: #16181d;
	color: #fff;
	padding: 30rpx 26rpx 28rpx;
	box-sizing: border-box;
}

.service-title {
	font-size: 31rpx;
	font-weight: 900;
	line-height: 1.2;
}

.service-sub {
	margin-top: 12rpx;
	color: rgba(255, 255, 255, 0.76);
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.48;
}

.service-actions {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 12rpx;
	margin-top: 24rpx;
}

.service-btn {
	height: 72rpx;
	border-radius: 8rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.26);
	background: rgba(255, 255, 255, 0.08);
	color: #fff;
	font-size: 24rpx;
	font-weight: 900;
	line-height: 72rpx;
	padding: 0;
}

.service-btn.primary {
	border-color: #d92733;
	background: #d92733;
}

.service-btn.ghost {
	background: #fff;
	color: #17191f;
	border-color: #fff;
}

.service-btn::after {
	border: 0;
}

.service-btn:active,
.sample-card:active {
	opacity: 0.72;
}
</style>
