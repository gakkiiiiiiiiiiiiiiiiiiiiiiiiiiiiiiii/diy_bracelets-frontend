<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

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

const fallback: HomeData = {
	logoText: '养个石头',
	tiles: [
		{ id: 'diy', label: 'DIY-CUSTOM', sub: '设计手串', image: '/static/textures/crystal-pink.png', path: '/pages/design/design' },
		{ id: 'goods', label: 'DESIGN-PLAZA', sub: '设计广场', image: '/static/textures/crystal-milky.png', path: '/pages/goods/goods' },
	],
	banners: [
		{ id: 'b1', image: '/static/textures/crystal-agate.png', link: '', title: '添加客服 查看设计实物图！' },
		{ id: 'b2', image: '/static/textures/crystal-milky.png', link: '/pages/design/design', title: '立即 DIY 手串' },
	],
	designs: [
		{ id: 'd1', title: '菩提蛋糕', author: '@吴烦恼', image: '/static/textures/crystal-white.png', cta: '查看实物' },
		{ id: 'd2', title: '怒目绿龙', author: '@Oo', image: '/static/textures/crystal-deep-purple.png', cta: '查看实物' },
	],
};

const data = ref<HomeData>(fallback);
const logoImage = '/static/textures/crystal-white.png';

onMounted(async () => {
	try {
		const res = await api.getHome();
		if (res) data.value = res as HomeData;
	} catch (_e) {
		data.value = fallback;
	}
});

function go(path: string) {
	if (!path) return;
	uni.navigateTo({ url: path });
}
</script>

<template>
	<view class="page">
		<view class="logo-wrap">
			<image class="logo-img" :src="logoImage" mode="aspectFit" />
			<view class="logo-text">{{ data.logoText }}</view>
			<view class="logo-sub">只做天然珠宝</view>
		</view>

		<view class="tile-row">
			<view v-for="tile in data.tiles" :key="tile.id" class="tile" @tap="go(tile.path)">
				<image class="tile-img" :src="tile.image" mode="aspectFit" />
				<view class="tile-label">{{ tile.label }}</view>
				<view class="tile-sub">{{ tile.sub }}</view>
			</view>
		</view>

		<view class="banner-wrap" v-if="data.banners.length">
			<swiper
				class="banner-swiper"
				:autoplay="true"
				:interval="4000"
				:circular="true"
				:indicator-dots="data.banners.length > 1"
				indicator-color="rgba(255,255,255,0.5)"
				indicator-active-color="#fff"
			>
				<swiper-item v-for="b in data.banners" :key="b.id">
					<view class="banner-item" @tap="go(b.link)">
						<image class="banner-img" :src="b.image" mode="aspectFill" />
						<view v-if="b.title" class="banner-text">{{ b.title }}</view>
					</view>
				</swiper-item>
			</swiper>
		</view>

		<view class="section">
			<view class="section-title">
				<text class="section-title__main">设计广场</text>
				<text class="section-title__sub">从来自世界各地的设计中寻找灵感</text>
			</view>
			<view class="design-card" v-for="item in data.designs" :key="item.id">
				<view class="design-info">
					<view class="design-title">{{ item.title }}</view>
					<view class="design-author">{{ item.author }}</view>
					<view class="design-cta">{{ item.cta }}</view>
				</view>
				<image class="design-img" :src="item.image" mode="aspectFit" />
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

.page {
	min-height: 100vh;
	background: #f7f7f9;
	padding: 24rpx 24rpx 120rpx;
}

.logo-wrap {
	text-align: center;
	padding: 40rpx 0 24rpx;
}

.logo-img {
	width: 120rpx;
	height: 120rpx;
	margin: 0 auto 12rpx;
}

.logo-text {
	font-size: 34rpx;
	font-weight: 700;
}

.logo-sub {
	font-size: 22rpx;
	color: #777;
	margin-top: 6rpx;
}

.tile-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 18rpx;
}

.tile {
	background: #fff;
	border-radius: 16rpx;
	padding: 18rpx;
	text-align: center;
	box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.04);
}

.tile-img {
	width: 120rpx;
	height: 120rpx;
	margin: 0 auto 12rpx;
}

.tile-label {
	font-size: 22rpx;
	color: #222;
	font-weight: 600;
}

.tile-sub {
	font-size: 24rpx;
	margin-top: 4rpx;
	font-weight: 700;
}

.banner-wrap {
	margin: 20rpx 0;
	border-radius: 16rpx;
	overflow: hidden;
}

.banner-swiper {
	width: 100%;
	height: 320rpx;
}

.banner-item {
	position: relative;
	width: 100%;
	height: 100%;
}

.banner-swiper .banner-img {
	width: 100%;
	height: 100%;
	display: block;
}

.banner-item .banner-text {
	position: absolute;
	left: 24rpx;
	bottom: 18rpx;
	color: #fff;
	font-size: 24rpx;
	font-weight: 600;
	text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.3);
}

.section {
	margin-top: 8rpx;
}

.section-title {
	margin: 12rpx 0 16rpx;
}

.section-title__main {
	font-size: 28rpx;
	font-weight: 700;
}

.section-title__sub {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #666;
}

.design-card {
	background: #fff;
	border-radius: 18rpx;
	padding: 20rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
	box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.04);
}

.design-info {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.design-title {
	font-size: 26rpx;
	font-weight: 700;
}

.design-author {
	font-size: 22rpx;
	color: #888;
}

.design-cta {
	font-size: 22rpx;
	color: #111;
	border-bottom: 2rpx solid #111;
	width: fit-content;
}

.design-img {
	width: 120rpx;
	height: 120rpx;
}
</style>
