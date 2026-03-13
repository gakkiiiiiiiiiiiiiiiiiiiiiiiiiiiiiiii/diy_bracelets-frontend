<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useSavedDesignsStore, type SavedDesign } from '@/stores/savedDesigns';
import { useDesignStore } from '@/stores/design';
import { api } from '@/api';

const savedStore = useSavedDesignsStore();
const designStore = useDesignStore();

const userName = ref('');

onMounted(async () => {
	try {
		const profile = await api.getProfile();
		if (profile?.name) userName.value = profile.name;
	} catch {
		userName.value = '朋友';
	}
	await savedStore.fetchList();
});

const designList = computed(() => savedStore.list);

function formatDate(iso: string) {
	const d = new Date(iso);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function previewLabel(beads: { length: number }): string {
	if (beads.length <= 0) return '';
	if (beads.length === 1) return '单珠';
	return `${beads.length} 颗珠`;
}

function previewImage(item: SavedDesign): string {
	const first = item.beads[0];
	return first?.image || '';
}

function goAdd() {
	designStore.clearDesign();
	uni.navigateTo({ url: '/pages/design/design' });
}

function goContinue(item: SavedDesign) {
	const beads = savedStore.getBeadsForDesign(item.id);
	if (!beads.length) return;
	designStore.applyDesignFromPlaza(
		beads.map((b) => ({
			materialId: b.materialId,
			name: b.name,
			image: b.image,
			size: b.size,
			price: b.price,
			quantity: 1,
		})),
	);
	uni.navigateTo({ url: '/pages/design/design' });
}

function onDelete(item: SavedDesign, e: Event) {
	e.stopPropagation?.();
	uni.showModal({
		title: '删除设计',
		content: `确定删除「${item.title}」？`,
		success: (res) => {
			if (res.confirm) savedStore.remove(item.id);
		},
	});
}

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}
</script>

<template>
	<view class="page">
		<view class="nav">
			<view class="nav-left" @tap="goBack">
				<text class="nav-icon">&lt;</text>
			</view>
			<view class="nav-title">我的设计</view>
			<view class="nav-right">
				<!-- 预留右侧图标 -->
			</view>
		</view>

		<view class="header">
			<view class="header-name">{{ userName || '朋友' }}</view>
			<view class="header-sub">查看已保存的设计记录</view>
		</view>

		<view class="grid">
			<view class="card card-add" @tap="goAdd">
				<view class="card-add-icon">+</view>
				<view class="card-add-text">添加新设计</view>
			</view>

			<view
				v-for="item in designList"
				:key="item.id"
				class="card card-design"
				@tap="goContinue(item)"
			>
				<view class="card-preview">
					<view v-if="previewLabel(item.beads)" class="card-tag">{{ previewLabel(item.beads) }}</view>
					<view class="card-preview-circle">
						<image
							v-if="previewImage(item)"
							class="card-preview-img"
							:src="previewImage(item)"
							mode="aspectFill"
						/>
						<view v-else class="card-preview-placeholder" />
						<text class="card-preview-brand">养个石头</text>
					</view>
					<view class="card-delete" @tap.stop="onDelete(item, $event)">
						<text class="card-delete-x">×</text>
					</view>
				</view>
				<view class="card-action">继续设计</view>
				<view class="card-date">上次更新: {{ formatDate(item.updatedAt) }}</view>
			</view>
		</view>

		<view class="footer">已加载全部数据</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7f9;
	padding-bottom: 120rpx;
}

.nav {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 88rpx;
	padding: 0 24rpx;
	background: #fff;
	border-bottom: 1rpx solid #eee;
}

.nav-left,
.nav-right {
	width: 80rpx;
}

.nav-right {
	text-align: right;
}

.nav-icon {
	font-size: 40rpx;
	color: #333;
}

.nav-title {
	font-size: 34rpx;
	font-weight: 700;
	color: #000;
}

.header {
	padding: 28rpx 24rpx 20rpx;
	background: #fff;
}

.header-name {
	font-size: 40rpx;
	font-weight: 700;
	color: #000;
}

.header-sub {
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #666;
}

.grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 24rpx;
	padding: 24rpx;
}

.card {
	background: #fff;
	border-radius: 20rpx;
	overflow: hidden;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.card-add {
	aspect-ratio: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	border: 2rpx dashed #ddd;
}

.card-add-icon {
	font-size: 72rpx;
	color: #999;
	line-height: 1;
}

.card-add-text {
	font-size: 26rpx;
	color: #666;
}

.card-design {
	display: flex;
	flex-direction: column;
}

.card-preview {
	position: relative;
	width: 100%;
	aspect-ratio: 1;
	background: linear-gradient(180deg, #f8f6f9 0%, #ebe8f0 100%);
}

.card-tag {
	position: absolute;
	top: 12rpx;
	left: 12rpx;
	padding: 6rpx 14rpx;
	font-size: 20rpx;
	color: #666;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 8rpx;
	z-index: 1;
}

.card-preview-circle {
	position: absolute;
	inset: 50%;
	transform: translate(-50%, -50%);
	width: 70%;
	height: 70%;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.95);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	box-shadow: inset 0 0 0 1rpx rgba(0, 0, 0, 0.06);
}

.card-preview-img {
	width: 100%;
	height: 100%;
}

.card-preview-placeholder {
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, #f0f0f0, #e5e5ea);
}

.card-preview-brand {
	position: absolute;
	font-size: 20rpx;
	color: #b7b1bc;
	z-index: 1;
}

.card-delete {
	position: absolute;
	top: 12rpx;
	right: 12rpx;
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	background: #d23a3a;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2;
}

.card-delete-x {
	font-size: 36rpx;
	color: #fff;
	line-height: 1;
}

.card-action {
	padding: 20rpx;
	text-align: center;
	font-size: 28rpx;
	font-weight: 600;
	color: #d23a3a;
}

.card-date {
	padding: 0 20rpx 20rpx;
	text-align: center;
	font-size: 22rpx;
	color: #999;
}

.footer {
	padding: 32rpx;
	text-align: center;
	font-size: 24rpx;
	color: #999;
}
</style>
