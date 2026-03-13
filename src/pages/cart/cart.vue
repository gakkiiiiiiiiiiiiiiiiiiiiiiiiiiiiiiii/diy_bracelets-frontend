<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '@/api';

interface CartItem {
	id: string;
	name: string;
	image: string;
	price: number;
	qty: number;
}

const items = ref<CartItem[]>([]);

const total = computed(() => items.value.reduce((sum, item) => sum + item.price * item.qty, 0));

onMounted(async () => {
	try {
		const res = await api.getCart();
		items.value = (res?.items || []) as CartItem[];
	} catch (_e) {
		items.value = [];
	}
});

function goDesign() {
	uni.switchTab({ url: '/pages/design/design' });
}

function goGoods() {
	uni.switchTab({ url: '/pages/goods/goods' });
}
</script>

<template>
	<view class="page">
		<view class="title">购物车</view>

		<view v-if="items.length === 0" class="empty">
			<view class="empty-text">购物车没有订单哟</view>
			<view class="empty-actions">
				<button class="btn" @tap="goDesign">去定制</button>
				<button class="btn btn-outline" @tap="goGoods">找好物</button>
			</view>
		</view>

		<view v-else class="list">
			<view v-for="item in items" :key="item.id" class="item">
				<image class="item-img" :src="item.image" mode="aspectFit" />
				<view class="item-info">
					<view class="item-name">{{ item.name }}</view>
					<view class="item-sub">¥ {{ item.price }} × {{ item.qty }}</view>
				</view>
			</view>
		</view>

		<view class="footer">
			<view class="footer-total">合计: ¥ {{ total }}</view>
			<button class="footer-btn" :disabled="items.length === 0">去结算 ({{ items.length }}件)</button>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7f9;
	padding: 24rpx 24rpx 140rpx;
}

.title {
	text-align: center;
	font-size: 28rpx;
	font-weight: 700;
	margin-bottom: 20rpx;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16rpx;
	margin-top: 80rpx;
}

.empty-text {
	color: #999;
	font-size: 24rpx;
}

.empty-actions {
	display: flex;
	gap: 16rpx;
}

.btn {
	padding: 12rpx 28rpx;
	border-radius: 999rpx;
	background: #d23a3a;
	color: #fff;
	font-size: 24rpx;
}

.btn-outline {
	background: #fff;
	color: #d23a3a;
	border: 1px solid #d23a3a;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.item {
	background: #fff;
	border-radius: 16rpx;
	padding: 16rpx;
	display: flex;
	gap: 16rpx;
	align-items: center;
}

.item-img {
	width: 120rpx;
	height: 120rpx;
}

.item-name {
	font-size: 26rpx;
	font-weight: 600;
}

.item-sub {
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #777;
}

.footer {
	position: fixed;
	left: 24rpx;
	right: 24rpx;
	bottom: 24rpx;
	background: #d23a3a;
	border-radius: 999rpx;
	padding: 18rpx 24rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	color: #fff;
}

.footer-btn {
	background: transparent;
	color: #fff;
	font-weight: 700;
	border: none;
}
</style>
