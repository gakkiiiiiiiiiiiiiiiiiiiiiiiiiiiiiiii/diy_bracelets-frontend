<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

interface ProfileEntry {
	id: string;
	label: string;
	sub: string;
	icon: string;
	path?: string;
}

interface ProfileData {
	name: string;
	greeting: string;
	entries: ProfileEntry[];
}

const data = ref<ProfileData>({
	name: '朋友',
	greeting: '您好！欢迎来到养个石头',
	entries: [],
});
onMounted(async () => {
	try {
		const res = await api.getProfile();
		if (res) data.value = res as ProfileData;
	} catch (_e) {
		data.value.entries = [
			{ id: 'design', label: '我的设计', sub: '查看已保存的设计记录', icon: 'D', path: '/pages/designs/list' },
			{ id: 'orders', label: '我的订单', sub: '定制记录、购买记录', icon: 'O' },
			{ id: 'address', label: '收货地址', sub: '完善地址，方便下单', icon: 'A' },
			{ id: 'help', label: '帮助中心', sub: '联系客服处理问题', icon: 'H' },
			{ id: 'terms', label: '条款和条件', sub: '我们的服务', icon: 'T' },
		];
	}
	const designEntry = data.value.entries.find((e) => e.id === 'design');
	if (designEntry && !designEntry.path) designEntry.path = '/pages/designs/list';
});

function go(entry: ProfileEntry) {
	if (!entry.path) return;
	uni.navigateTo({ url: entry.path });
}

function goToDesigns() {
	uni.navigateTo({ url: '/pages/designs/list' });
}
</script>

<template>
	<view class="page">
		<view class="header">
			<view class="header-avatar">
				<view class="header-avatar__ring" />
				<view class="header-avatar__letter">{{ (data.name || ' ').charAt(0) }}</view>
			</view>
			<view class="header-copy">
				<view class="name">{{ data.name }}</view>
				<view class="greeting">{{ data.greeting }}</view>
			</view>
		</view>

		<view class="promo" @tap="goToDesigns">
			<view class="promo-title">我的设计</view>
			<view class="promo-sub">查看已保存的设计记录</view>
			<text class="promo-arrow">></text>
		</view>

		<view class="panel">
			<view v-for="entry in data.entries" :key="entry.id" class="entry" @tap="go(entry)">
				<view class="entry-icon">{{ entry.icon }}</view>
				<view class="entry-body">
					<view class="entry-label">{{ entry.label }}</view>
					<view class="entry-sub">{{ entry.sub }}</view>
				</view>
				<text class="entry-arrow">></text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7f9;
	padding: 24rpx 24rpx 120rpx;
}

.header {
	padding: 30rpx 0 12rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.header-avatar {
	position: relative;
	width: 104rpx;
	height: 104rpx;
	border-radius: 50%;
	background: linear-gradient(180deg, #fff7f7 0%, #ffe9ea 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	box-shadow: 0 10rpx 24rpx rgba(210, 58, 58, 0.12);
	overflow: hidden;
}

.header-avatar__ring {
	position: absolute;
	inset: 4rpx;
	border-radius: 50%;
	border: 1px solid rgba(255, 255, 255, 0.9);
	pointer-events: none;
	z-index: 2;
}

/* 头像首字占位，与品牌色一致 */
.header-avatar__letter {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 44rpx;
	font-weight: 600;
	color: #d23a3a;
	opacity: 0.85;
	z-index: 0;
}

.header-copy {
	min-width: 0;
}

.name {
	font-size: 36rpx;
	font-weight: 700;
}

.greeting {
	margin-top: 10rpx;
	font-size: 24rpx;
	color: #666;
}

.promo {
	background: #d23a3a;
	color: #fff;
	border-radius: 16rpx;
	padding: 22rpx;
	margin: 18rpx 0;
	position: relative;
}

.promo-title {
	font-size: 28rpx;
	font-weight: 700;
}

.promo-sub {
	margin-top: 6rpx;
	font-size: 22rpx;
}

.promo-arrow {
	position: absolute;
	right: 20rpx;
	top: 50%;
	transform: translateY(-50%);
	font-size: 32rpx;
}

.panel {
	background: #fff;
	border-radius: 18rpx;
	padding: 8rpx 0;
}

.entry {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 18rpx 20rpx;
}

.entry + .entry {
	border-top: 1px solid #f0f0f0;
}

.entry-icon {
	width: 44rpx;
	height: 44rpx;
	border-radius: 12rpx;
	background: #fff3f3;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
}

.entry-body {
	flex: 1;
}

.entry-label {
	font-size: 26rpx;
	font-weight: 600;
}

.entry-sub {
	font-size: 22rpx;
	color: #999;
	margin-top: 4rpx;
}

.entry-arrow {
	font-size: 28rpx;
	color: #bbb;
}
</style>
