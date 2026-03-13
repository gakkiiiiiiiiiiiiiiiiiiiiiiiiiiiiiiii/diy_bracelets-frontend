<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import NavigationBar from '@/components/NavigationBar.vue';
import InfoTag from '@/components/InfoTag.vue';
import BraceletCanvas from '@/components/BraceletCanvas.vue';
import ActionButton from '@/components/ActionButton.vue';
import MaterialSearch from '@/components/MaterialSearch.vue';
import MaterialCategoryList from '@/components/MaterialCategoryList.vue';
import MaterialCard from '@/components/MaterialCard.vue';
import { useDesignStore } from '@/stores/design';
import { useMaterialsStore } from '@/stores/materials';
import { useSavedDesignsStore } from '@/stores/savedDesigns';
const designStore = useDesignStore();
const materialsStore = useMaterialsStore();
const savedDesignsStore = useSavedDesignsStore();

onMounted(() => {
	materialsStore.fetchFromApi();
});

// 总价文本（带单位）
const totalPriceText = computed(() => `总价格: ${designStore.totalPrice.toFixed(1)} 元`);
// 是否可以完成设计按钮
const canFinish = computed(() => designStore.braceletDesign.length > 0);

// 价格变动激活动画
const priceBump = ref(false);
// 手围过小时“晃动”动画
const handTooSmallShake = ref(false);
// 前一次的总价格，便于对比变化
const prevTotalPrice = ref<number | null>(null);

// 监听总价变化，触发价格bump动画
watch(
	() => designStore.totalPrice,
	(cur) => {
		if (prevTotalPrice.value !== null && prevTotalPrice.value !== cur) {
			priceBump.value = true;
			setTimeout(() => {
				priceBump.value = false;
			}, 420);
		}
		prevTotalPrice.value = cur;
	},
);

// 监听手围过小，触发提示晃动动画
watch(
	() => designStore.isHandTooSmall,
	(is) => {
		if (is) {
			handTooSmallShake.value = true;
			setTimeout(() => {
				handTooSmallShake.value = false;
			}, 400);
		}
	},
);

// “更多/重置”操作，清空手链设计
function onMoreReset() {
	if (designStore.braceletDesign.length === 0) return;
	uni.showModal({
		title: '重置设计',
		content: '确定清空当前设计？',
		success: (res) => {
			if (res.confirm) designStore.clearDesign();
		},
	});
}

// 删除操作，清空手链设计
function onDelete() {
	if (designStore.braceletDesign.length === 0) return;
	uni.showModal({
		title: '清空设计',
		content: '确定清空当前设计？',
		success: (res) => {
			if (res.confirm) designStore.clearDesign();
		},
	});
}

// 保存当前设计到本地草稿
function onSave() {
	const data = JSON.stringify(designStore.braceletDesign);
	uni.setStorageSync('bracelet-draft', data);
	uni.showToast({ title: '已保存草稿', icon: 'success' });
}

// 保存到「我的设计」列表
function onSaveToList() {
	if (designStore.braceletDesign.length === 0) {
		uni.showToast({ title: '请至少添加一颗珠子', icon: 'none' });
		return;
	}
	const title = `我的设计 ${new Date().toLocaleDateString('zh-CN')}`;
	savedDesignsStore.add(title, designStore.braceletDesign);
	uni.showToast({ title: '已保存到我的设计', icon: 'success' });
}

// 完成设计，校验输入和显示警告
function onFinish() {
	if (!canFinish.value) {
		uni.showToast({ title: '请至少添加一颗珠子', icon: 'none' });
		return;
	}
	if (designStore.isHandTooSmall) {
		uni.showModal({
			title: '手围过小',
			content: '当前手串周长可能偏小，是否仍要下单？',
			success: (res) => {
				if (res.confirm) goOrder();
			},
		});
		return;
	}
	goOrder();
}

// 跳转订单页（占位）
function goOrder() {
	uni.showToast({ title: '订单页开发中', icon: 'none' });
}

// 使用须知弹窗
function onNotice() {
	uni.showModal({
		title: '使用须知',
		content: '请根据手围合理选择珠子数量与尺寸，成品以实际为准。',
		showCancel: false,
	});
}
</script>

<template>
	<view class="page">
		<!-- 顶部自定义导航栏，含重置按钮 -->
		<NavigationBar @reset="onMoreReset" @save-to-list="onSaveToList" />
		<!-- 顶部信息区：玻璃卡片 -->
		<view class="info-section">
			<view class="info-tags">
				<!-- 使用须知标签，可点击 -->
				<view class="info-tag-wrap" @click="onNotice">
					<InfoTag type="notice" label="使用须知 ?" />
				</view>
				<!-- 手围过小时警告标签，并晃动动效 -->
				<InfoTag v-if="designStore.isHandTooSmall" type="warn" label="手围过小" :shake="handTooSmallShake" />
				<!-- 总价信息标签，价格变化时有bump动效 -->
				<view class="price-tag-wrap" :class="{ 'price-tag-wrap--bump': priceBump }">
					<InfoTag :label="totalPriceText" />
				</view>
			</view>
		</view>
		<!-- 中部画布区：手链设计效果图 -->
		<view class="canvas-section">
			<view class="canvas-card">
				<BraceletCanvas />
			</view>
		</view>
		<!-- 底部操作区和材料选择区 -->
		<view class="bottom-section">
			<!-- 操作按钮行：左侧删除+保存，右侧完成设计（中间留空） -->
			<view class="action-row">
				<view class="action-row__left">
					<ActionButton type="delete" icon="🗑" label="" @click="onDelete" />
					<ActionButton type="save" icon="💾" label="保存" @click="onSave" />
				</view>
				<view class="action-row__spacer" />
				<view class="action-row__right">
					<ActionButton type="primary" icon="🛒" label="完成设计" :disabled="!canFinish" @click="onFinish" />
				</view>
			</view>
			<!-- 材料选择区 -->
			<view class="material-panel">
				<!-- 搜索框 -->
				<MaterialSearch />
				<view class="material-body">
					<!-- 左侧材料分类 -->
					<MaterialCategoryList />
					<!-- 右侧材料列表，滚动容器 -->
					<scroll-view class="material-grid-wrap" scroll-y>
						<view class="material-grid">
							<!-- 单个材料卡片，支持动画 -->
							<view v-for="(m, idx) in materialsStore.filteredMaterials" :key="m.id" class="material-grid-item">
								<MaterialCard :material="m" />
							</view>
						</view>
					</scroll-view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@use '@/uni.scss' as u;

// 页面整体
.page {
	min-height: 100vh;
	position: relative;
	z-index: 1;
	padding-bottom: env(safe-area-inset-bottom);
}

// 顶部信息区
.info-section {
	padding: 16rpx 24rpx 24rpx;
}

// 信息标签布局
.info-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	align-items: center;
}

// 可点的信息标签包裹
.info-tag-wrap {
	cursor: pointer;
}

// 总价标签（动画）
.price-tag-wrap {
	display: inline-block;
	transition: transform u.$duration-price-return u.$ease-in-out;
}

.price-tag-wrap--bump {
	animation: price-bump 0.42s u.$ease-out;
}

// 价格跳动动画
@keyframes price-bump {
	0% {
		transform: scale(1);
	}
	28% {
		transform: scale(1.06);
	}
	72% {
		transform: scale(1.06);
	}
	100% {
		transform: scale(1);
	}
}

// 中部画布区域（无左右边距，手串画布撑满）
.canvas-section {
	padding: 24rpx 0;
}

// 画布玻璃卡片（无左右 padding，画布贴边）
.canvas-card {
	border-radius: u.$radius-card;
	padding: 32rpx 0;
	max-width: 1120rpx;
	margin: 0 auto;
	animation: fade-in-up u.$duration-enter u.$ease-brand;
}

// 淡入上移动画
@keyframes fade-in-up {
	from {
		opacity: 0;
		transform: translateY(24rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

// 底部操作区和材料列表
.bottom-section {
	background: u.$glass-bg;
	backdrop-filter: blur(20px);
	border-radius: 32rpx 32rpx 0 0;
	border-top: 1px solid u.$hairline;
	padding: 24rpx 0;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

// 操作按钮行：左侧两组按钮紧挨，中间撑开，右侧「完成设计」靠右
.action-row {
	display: flex;
	align-items: center;
	margin-bottom: 24rpx;
}

.action-row__left {
	display: flex;
	gap: 16rpx;
}

.action-row__spacer {
	flex: 1;
	min-width: 24rpx;
}

.action-row__right {
	flex-shrink: 0;
}

// 材料面板总体布局
.material-panel {
	display: flex;
	flex-direction: column;
	max-height: 60vh;
}

// 材料主区域（分类+列表）
.material-body {
	display: flex;
	flex: 1;
	min-height: 320rpx;
}

// 材料列表滚动区
.material-grid-wrap {
	flex: 1;
	height: 400rpx;
}

// 材料卡片网格：图中为 3 列
.material-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 20rpx;
	padding: 16rpx 20rpx 32rpx;
	max-width: 1120rpx;
}

// 材料卡片动画
.material-grid-item {
	animation: fade-in-up u.$duration-state u.$ease-brand backwards;
}

// 为前6张卡片分别设置动画延迟
.material-grid-item:nth-child(1) {
	animation-delay: 0.02s;
}
.material-grid-item:nth-child(2) {
	animation-delay: 0.04s;
}
.material-grid-item:nth-child(3) {
	animation-delay: 0.06s;
}
.material-grid-item:nth-child(4) {
	animation-delay: 0.08s;
}
.material-grid-item:nth-child(5) {
	animation-delay: 0.1s;
}
.material-grid-item:nth-child(6) {
	animation-delay: 0.12s;
}
</style>
