<script setup lang="ts">
import { ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, type DesignDetail } from '@/api';
import { useDesignStore } from '@/stores/design';

const designId = ref('');
const detail = ref<DesignDetail | null>(null);
const loading = ref(false);
const designStore = useDesignStore();

onLoad((query: Record<string, string>) => {
	designId.value = query.id || query.designId || '';
});

async function fetchDetail() {
	if (!designId.value) return;
	loading.value = true;
	try {
		detail.value = await api.getGoodsDetail(designId.value);
	} catch (_e) {
		detail.value = null;
	} finally {
		loading.value = false;
	}
}

watch(designId, (id) => {
	if (id) fetchDetail();
}, { immediate: true });

async function useDesign() {
	if (!detail.value) return;
	try {
		await api.useDesign(detail.value.id);
		designStore.applyDesignFromPlaza(detail.value.composition);
		uni.switchTab({ url: '/pages/design/design' });
	} catch (_e) {
		// 仍可套用本地数据
		designStore.applyDesignFromPlaza(detail.value.composition);
		uni.switchTab({ url: '/pages/design/design' });
	}
}
</script>

<template>
	<view class="page">
		<view v-if="loading" class="loading">加载中...</view>
		<template v-else-if="detail">
			<view class="main-img-wrap">
				<image
					class="main-img"
					:src="detail.image"
					mode="aspectFit"
				/>
			</view>
			<view class="section">
				<view class="row title-row">
					<view class="title">{{ detail.title }}</view>
					<image
						v-if="detail.image"
						class="thumb"
						:src="detail.image"
						mode="aspectFit"
					/>
				</view>
				<view class="author">作者 {{ detail.author }}</view>
				<view class="usage">{{ detail.usageCount }}人使用过</view>
			</view>
			<view class="section">
				<view class="table-title">设计构成</view>
				<view class="table">
					<view class="table-head">
						<text class="col name">材料名称</text>
						<text class="col size">尺寸</text>
						<text class="col price">单价</text>
						<text class="col qty">数量</text>
						<text class="col amount">金额</text>
					</view>
					<view
						v-for="(row, i) in detail.composition"
						:key="i"
						class="table-row"
					>
						<text class="col name">{{ row.name }}</text>
						<text class="col size">{{ row.size ? row.size + 'mm' : '--' }}</text>
						<text class="col price">{{ row.price }}</text>
						<text class="col qty">{{ row.quantity }}</text>
						<text class="col amount">{{ (row.price * row.quantity).toFixed(1) }}</text>
					</view>
				</view>
			</view>
			<view class="footer">
				<button class="btn-use" @click="useDesign">使用该设计</button>
			</view>
		</template>
		<view v-else class="empty">未找到该设计</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7f9;
	padding-bottom: 140rpx;
}

.loading,
.empty {
	text-align: center;
	padding: 48rpx;
	color: #999;
}

.main-img-wrap {
	width: 100%;
	background: #fff;
	aspect-ratio: 1;
}

.main-img {
	width: 100%;
	height: 100%;
}

.section {
	background: #fff;
	margin-top: 24rpx;
	padding: 24rpx;
}

.title-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
}

.title {
	font-size: 36rpx;
	font-weight: 700;
	flex: 1;
}

.thumb {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	background: #f0f0f0;
	flex-shrink: 0;
}

.author {
	font-size: 26rpx;
	color: #666;
	margin-top: 12rpx;
}

.usage {
	font-size: 24rpx;
	color: #999;
	margin-top: 8rpx;
	text-decoration: underline;
}

.table-title {
	font-size: 28rpx;
	font-weight: 600;
	margin-bottom: 16rpx;
}

.table {
	border: 1rpx solid #eee;
	border-radius: 12rpx;
	overflow: hidden;
}

.table-head,
.table-row {
	display: flex;
	align-items: center;
	padding: 16rpx 12rpx;
	border-bottom: 1rpx solid #eee;
	font-size: 22rpx;
}

.table-row:last-child {
	border-bottom: none;
}

.table-head {
	background: #fafafa;
	font-weight: 600;
	color: #333;
}

.col {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.col.name {
	flex: 1.2;
	min-width: 0;
}

.col.size {
	width: 72rpx;
	text-align: center;
}

.col.price {
	width: 64rpx;
	text-align: right;
}

.col.qty {
	width: 48rpx;
	text-align: center;
}

.col.amount {
	width: 80rpx;
	text-align: right;
}

.footer {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 24rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	background: #fff;
	border-top: 1rpx solid #eee;
}

.btn-use {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	background: #fff;
	color: #ff4d4f;
	border: 2rpx solid #ff4d4f;
	border-radius: 44rpx;
	font-size: 30rpx;
	font-weight: 600;
}
</style>
