<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { api, type PlazaItem } from '@/api';

type TabType = 'designer' | 'user';

const activeTab = ref<TabType>('designer');
const items = ref<PlazaItem[]>([]);
const loading = ref(false);

async function fetchList() {
	loading.value = true;
	try {
		const res = await api.getGoods(activeTab.value);
		items.value = res?.items ?? [];
	} catch (_e) {
		items.value = [];
	} finally {
		loading.value = false;
	}
}

watch(activeTab, () => fetchList());
onMounted(() => fetchList());

function goDetail(id: string) {
	uni.navigateTo({ url: `/pages/goods/detail/detail?id=${id}` });
}
</script>

<template>
	<view class="page">
		<view class="header">
			<view class="title">设计广场</view>
			<view class="hint">点击查看实物图和设计细节</view>
		</view>
		<view class="tabs">
			<view
				class="tab"
				:class="{ active: activeTab === 'designer' }"
				@click="activeTab = 'designer'"
			>
				设计师款
			</view>
			<view
				class="tab"
				:class="{ active: activeTab === 'user' }"
				@click="activeTab = 'user'"
			>
				优秀客订
			</view>
		</view>
		<view v-if="loading" class="loading">加载中...</view>
		<view v-else class="grid">
			<view
				v-for="item in items"
				:key="item.id"
				class="card"
				@click="goDetail(item.id)"
			>
				<view class="card-img-wrap">
					<image class="card-img" :src="item.image" mode="aspectFill" />
					<view class="card-usage">{{ item.usageCount }}人使用</view>
				</view>
				<view class="card-info">
					<view class="card-title">{{ item.title }}</view>
					<view class="card-author">{{ item.author }}</view>
				</view>
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
	margin-bottom: 24rpx;
}

.title {
	font-size: 40rpx;
	font-weight: 700;
	margin-bottom: 8rpx;
}

.hint {
	font-size: 24rpx;
	color: #999;
}

.tabs {
	display: flex;
	gap: 32rpx;
	margin-bottom: 24rpx;
	border-bottom: 2rpx solid #eee;
}

.tab {
	font-size: 28rpx;
	color: #666;
	padding-bottom: 16rpx;
	margin-bottom: -2rpx;
	transition: color 0.2s;
}

.tab.active {
	color: #ff4d4f;
	font-weight: 600;
	border-bottom: 4rpx solid #ff4d4f;
}

.loading {
	text-align: center;
	padding: 48rpx;
	color: #999;
}

.grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 24rpx;
}

.card {
	background: #fff;
	border-radius: 16rpx;
	overflow: hidden;
	box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.04);
}

.card-img-wrap {
	position: relative;
	width: 100%;
	aspect-ratio: 1;
	background: #f5f5f7;
}

.card-img {
	width: 100%;
	height: 100%;
}

.card-usage {
	position: absolute;
	top: 12rpx;
	right: 12rpx;
	font-size: 20rpx;
	color: #999;
	background: rgba(255, 255, 255, 0.9);
	padding: 6rpx 12rpx;
	border-radius: 8rpx;
}

.card-info {
	padding: 16rpx;
}

.card-title {
	font-size: 26rpx;
	font-weight: 700;
	margin-bottom: 6rpx;
}

.card-author {
	font-size: 22rpx;
	color: #888;
}
</style>
