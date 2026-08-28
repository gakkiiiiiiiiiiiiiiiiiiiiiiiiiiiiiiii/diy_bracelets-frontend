<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { api } from '@/api';
import { useDesignStore } from '@/stores/design';
import { useMaterialsStore } from '@/stores/materials';
import { addLocalCartItems, usesRemoteCommerce } from '@/utils/checkout';
import { designEntrySourceForCartItem, openDesignStudio } from '@/utils/designNavigation';
import {
	ORDER_STATUS_TABS,
	cloneOrderItemsForCart,
	loadLocalOrders,
	saveLocalOrders,
	logisticsOrderNo,
	normalizeOrderStatus,
	orderMatchesStatus,
	updateLocalOrderStatus,
	type NormalizedOrderStatus,
	type OrderRecord,
	type OrderStatusTab,
} from '@/utils/orders';
import {
	cartItemDisplayName,
	cartItemSummaryText,
	cartItemTypeText,
	formatOrderDate,
	orderCompositionText,
	orderEditableComposition,
	orderImage,
} from '@/utils/orderDisplay';
import { resolveStaticUrl } from '@/utils/staticUrl';

const designStore = useDesignStore();
const materialsStore = useMaterialsStore();
const orders = ref<OrderRecord[]>([]);
const activeStatus = ref<OrderStatusTab>('全部');
const statusTabs = ORDER_STATUS_TABS;

type OrderListActionKey =
	| 'detail'
	| 'edit'
	| 'remind'
	| 'copyTracking'
	| 'confirmReceive'
	| 'afterSale'
	| 'repeat'
	| 'support';

interface OrderListAction {
	key: OrderListActionKey;
	label: string;
	tone: 'ghost' | 'primary';
}

const filteredOrders = computed(() => {
	return orders.value.filter((order) => orderMatchesStatus(order, activeStatus.value));
});
const statusCounts = computed<Record<OrderStatusTab, number>>(() => {
	const counts = statusTabs.reduce((acc, status) => {
		acc[status] = 0;
		return acc;
	}, {} as Record<OrderStatusTab, number>);
	counts['全部'] = orders.value.length;
	orders.value.forEach((order) => {
		counts[normalizeOrderStatus(order.status)] += 1;
	});
	return counts;
});
const hasAnyOrders = computed(() => orders.value.length > 0);
const emptyTitle = computed(() =>
	!hasAnyOrders.value ? '暂无数据' : `暂无${statusLabel(activeStatus.value)}订单`,
);
const emptySub = computed(() => {
	if (!hasAnyOrders.value) return '';
	if (activeStatus.value === '退款/售后') return '当前没有退款或售后记录，可查看全部订单。';
	return `当前没有${statusLabel(activeStatus.value)}状态的订单，可查看全部订单。`;
});
const showAllEmptyAction = computed(() => hasAnyOrders.value && activeStatus.value !== '全部');

onShow(() => {
	void refreshOrders();
	// #ifdef H5
	syncStatusFromQuery(h5QueryFromHash());
	// #endif
});

onLoad((query: Record<string, string | undefined>) => {
	syncStatusFromQuery(query);
});

onMounted(() => {
	// #ifdef H5
	window.addEventListener('hashchange', syncStatusFromH5Hash);
	syncStatusFromQuery(h5QueryFromHash());
	// #endif
});

onBeforeUnmount(() => {
	// #ifdef H5
	window.removeEventListener('hashchange', syncStatusFromH5Hash);
	// #endif
});

function isOrderStatusTab(value: string): value is OrderStatusTab {
	return statusTabs.includes(value as OrderStatusTab);
}

function syncStatusFromQuery(query: Record<string, string | undefined>) {
	const rawStatus = decodeURIComponent(query.status || '');
	if (rawStatus && isOrderStatusTab(rawStatus)) {
		activeStatus.value = rawStatus;
	}
}

function h5QueryFromHash() {
	// #ifdef H5
	const hashQuery = window.location.hash.split('?')[1] || '';
	return Object.fromEntries(new URLSearchParams(hashQuery).entries());
	// #endif
	// #ifndef H5
	return {};
	// #endif
}

function syncStatusFromH5Hash() {
	syncStatusFromQuery(h5QueryFromHash());
}

function setStatus(status: OrderStatusTab) {
	activeStatus.value = status;
}

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}

async function refreshOrders() {
	if (!usesRemoteCommerce) {
		orders.value = loadLocalOrders();
		return;
	}
	try {
		orders.value = await api.getOrders();
		saveLocalOrders(orders.value);
	} catch (error) {
		console.warn('[orders] 订单加载失败，暂时显示本机缓存', error);
		orders.value = loadLocalOrders();
	}
}

function statusLabel(status: OrderStatusTab) {
	if (status === '已收货') return '已发货';
	return status;
}

function tabCount(status: OrderStatusTab) {
	return statusCounts.value[status] || 0;
}

function formatAmount(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function shortOrderNo(order: OrderRecord) {
	return order.orderNo || order.id.replace(/^order-/, '').slice(-10);
}

function primaryName(order: OrderRecord) {
	const firstItem = order.items[0];
	return firstItem ? cartItemDisplayName(firstItem) : order.title;
}

function primaryType(order: OrderRecord) {
	const firstItem = order.items[0];
	return firstItem ? cartItemTypeText(firstItem) : '标准商品';
}

function primarySummary(order: OrderRecord) {
	const firstItem = order.items[0];
	return firstItem ? cartItemSummaryText(firstItem) : orderCompositionText(order);
}

function extraItemText(order: OrderRecord) {
	const extraCount = order.items.length - 1;
	return extraCount > 0 ? `另有 ${extraCount} 件` : '';
}

function hasEditableDesign(order: OrderRecord) {
	return order.items.some((item) => item.composition?.length);
}

function previewComposition(order: OrderRecord) {
	return order.items.find((item) => item.composition?.length)?.composition?.slice(0, 5) ?? [];
}

function orderListActions(order: OrderRecord): OrderListAction[] {
	const status = normalizeOrderStatus(order.status);
	const actions: OrderListAction[] = [{ key: 'detail', label: '查看详情', tone: 'ghost' }];

	if (status === '待发货') {
		if (hasEditableDesign(order)) {
			actions.push({ key: 'edit', label: usesRemoteCommerce ? '复制为新设计' : '继续编辑', tone: 'ghost' });
		}
		actions.push({ key: 'remind', label: '提醒发货', tone: 'primary' });
		return actions;
	}

	if (status === '已发货') {
		actions.push({ key: 'copyTracking', label: '复制单号', tone: 'ghost' });
		actions.push({ key: 'confirmReceive', label: '确认收货', tone: 'primary' });
		return actions;
	}

	if (status === '已收货') {
		actions.push({ key: 'afterSale', label: '申请售后', tone: 'ghost' });
		actions.push({ key: 'repeat', label: '再次购买', tone: 'primary' });
		return actions;
	}

	actions.push({ key: 'support', label: '联系客服', tone: 'ghost' });
	actions.push({ key: 'repeat', label: '再次购买', tone: 'primary' });
	return actions;
}

function showOrderDetail(order: OrderRecord) {
	uni.navigateTo({ url: `/pages/orders/detail?id=${encodeURIComponent(order.id)}` });
}

function continueEdit(order: OrderRecord) {
	const editableItem = order.items.find((item) => item.composition?.length);
	const composition = editableItem?.composition ?? orderEditableComposition(order);
	if (!composition?.length) return;
	designStore.applyDesignFromPlaza(composition, {
		source: 'order',
		handCircumferenceCm: editableItem?.handCircumferenceCm ?? null,
	});
	materialsStore.setSearchKeyword('');
	materialsStore.setCategory('in-use');
	openDesignStudio(designEntrySourceForCartItem(editableItem));
}

function repeatOrder(order: OrderRecord) {
	const items = cloneOrderItemsForCart(order);
	if (!items.length) {
		uni.showToast({ title: '订单商品不可复购', icon: 'none' });
		return;
	}
	addLocalCartItems(items);
	uni.showToast({ title: '已加入购物车', icon: 'success' });
	setTimeout(() => {
		uni.switchTab({ url: '/pages/cart/cart' });
	}, 450);
}

function applyOrderStatus(order: OrderRecord, status: NormalizedOrderStatus, toastTitle: string) {
	const updated = updateLocalOrderStatus(order.id, status);
	if (!updated) {
		uni.showToast({ title: '订单状态更新失败', icon: 'none' });
		return;
	}
	orders.value = orders.value.map((item) => (item.id === updated.id ? updated : item));
	uni.showToast({ title: toastTitle, icon: 'success' });
}

async function remindShipment(order: OrderRecord) {
	try {
		if (usesRemoteCommerce) {
			const updated = await api.remindOrder(order.id);
			orders.value = orders.value.map((item) => (item.id === updated.id ? updated : item));
			saveLocalOrders(orders.value);
		}
		uni.showModal({
			title: '已提醒客服',
			content: `订单 ${shortOrderNo(order)} 的发货提醒已记录，我们会优先核对晶石库存和手围信息。`,
			showCancel: false,
		});
	} catch (error) {
		console.warn('[orders] 提醒失败', error);
		uni.showToast({ title: '提醒失败或操作过于频繁', icon: 'none' });
	}
}

function confirmReceive(order: OrderRecord) {
	uni.showModal({
		title: '确认收货',
		content: '确认已经收到这笔订单的商品？确认后订单会进入已收货状态。',
		confirmText: '确认收货',
		success: async (res) => {
			if (!res.confirm) return;
			if (!usesRemoteCommerce) {
				applyOrderStatus(order, '已收货', '已确认收货');
				return;
			}
			try {
				const updated = await api.confirmOrderReceipt(order.id);
				orders.value = orders.value.map((item) => (item.id === updated.id ? updated : item));
				saveLocalOrders(orders.value);
				uni.showToast({ title: '已确认收货', icon: 'success' });
			} catch (error) {
				console.warn('[orders] 确认收货失败', error);
				uni.showToast({ title: '确认收货失败，请重试', icon: 'none' });
			}
		},
	});
}

function requestAfterSale(order: OrderRecord) {
	uni.showModal({
		title: '申请售后',
		content: '提交后订单会进入退款/售后状态，客服会继续核对商品、证书、补差价或改款问题。',
		confirmText: '申请售后',
		success: async (res) => {
			if (!res.confirm) return;
			if (!usesRemoteCommerce) {
				applyOrderStatus(order, '退款/售后', '已提交售后');
				return;
			}
			try {
				const updated = await api.requestOrderAfterSale(order.id, '用户从订单列表申请售后');
				orders.value = orders.value.map((item) => (item.id === updated.id ? updated : item));
				saveLocalOrders(orders.value);
				uni.showToast({ title: '已提交售后', icon: 'success' });
			} catch (error) {
				console.warn('[orders] 售后申请失败', error);
				uni.showToast({ title: '售后申请失败，请重试', icon: 'none' });
			}
		},
	});
}

function copyTrackingNo(order: OrderRecord) {
	const trackingNo = order.trackingNo || (!usesRemoteCommerce ? logisticsOrderNo(order.id) : '');
	if (!trackingNo) {
		uni.showToast({ title: '物流单号尚未录入', icon: 'none' });
		return;
	}
	uni.setClipboardData({
		data: trackingNo,
		success: () => {
			uni.showToast({ title: '已复制单号', icon: 'none' });
		},
	});
}

function contactService(order: OrderRecord) {
	uni.navigateTo({
		url: `/pages/profile/help?topic=order&support=1&order=${encodeURIComponent(shortOrderNo(order))}`,
	});
}

function runOrderAction(action: OrderListActionKey, order: OrderRecord) {
	if (action === 'detail') {
		showOrderDetail(order);
		return;
	}
	if (action === 'edit') {
		continueEdit(order);
		return;
	}
	if (action === 'remind') {
		remindShipment(order);
		return;
	}
	if (action === 'copyTracking') {
		copyTrackingNo(order);
		return;
	}
	if (action === 'confirmReceive') {
		confirmReceive(order);
		return;
	}
	if (action === 'afterSale') {
		requestAfterSale(order);
		return;
	}
	if (action === 'repeat') {
		repeatOrder(order);
		return;
	}
	if (action === 'support') {
		contactService(order);
	}
}

</script>

<template>
	<view class="page app-subpage orders-list-page" :class="{ 'page--empty': !filteredOrders.length }">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="orders-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">我的订单</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="tabs">
			<view
				v-for="status in statusTabs"
				:key="status"
				class="tab"
				:class="{ active: activeStatus === status }"
				@tap="setStatus(status)"
			>
				<view class="tab-inner">
					<text class="tab-label">{{ statusLabel(status) }}</text>
					<text v-if="tabCount(status)" class="tab-badge">{{ tabCount(status) }}</text>
				</view>
			</view>
		</view>

		<view v-if="filteredOrders.length" class="list">
			<view v-for="order in filteredOrders" :key="order.id" class="order-card">
				<view class="order-head">
					<view class="order-meta">
						<view class="order-no">订单编号 {{ shortOrderNo(order) }}</view>
						<view class="order-date">{{ formatOrderDate(order.createdAt) }}</view>
					</view>
					<view class="order-status">{{ normalizeOrderStatus(order.status) }}</view>
				</view>
				<view class="order-main" @tap="showOrderDetail(order)">
					<view class="order-img-wrap">
						<image class="order-img" :src="resolveStaticUrl(orderImage(order))" mode="aspectFill" />
						<view v-if="previewComposition(order).length" class="bead-strip">
							<view
								v-for="row in previewComposition(order)"
								:key="`${order.id}-${row.materialId}-${row.size}`"
								class="bead-mini"
							>
								<image class="bead-mini-img" :src="resolveStaticUrl(row.image)" mode="aspectFill" />
							</view>
						</view>
					</view>
					<view class="order-body">
						<view class="order-type">{{ primaryType(order) }}</view>
						<view class="order-title">{{ primaryName(order) }}</view>
						<view class="order-summary">{{ primarySummary(order) }}</view>
						<view v-if="extraItemText(order)" class="order-extra">{{ extraItemText(order) }}</view>
					</view>
					<view class="order-price">
						<view class="price-label">实付款</view>
						<view class="price-value">¥ {{ formatAmount(order.total) }}</view>
						<view class="item-count">共 {{ order.itemCount }} 件</view>
					</view>
				</view>
				<view class="order-actions">
					<button
						v-for="action in orderListActions(order)"
						:key="`${order.id}-${action.key}`"
						class="action-btn"
						:class="{ ghost: action.tone === 'ghost' }"
						@tap.stop="runOrderAction(action.key, order)"
					>
						{{ action.label }}
					</button>
				</view>
			</view>
		</view>

		<view v-else class="empty">
			<view class="empty-order-art">
				<view class="empty-doubt doubt-a" aria-hidden="true" />
				<view class="empty-doubt doubt-b" aria-hidden="true" />
				<view class="empty-ground" />
				<view class="empty-crystal crystal-a" />
				<view class="empty-crystal crystal-b" />
				<view class="empty-crystal crystal-c" />
				<view class="empty-stone">
					<view class="empty-crown" />
					<view class="empty-arm empty-arm-left" />
					<view class="empty-arm empty-arm-right" />
					<view class="empty-held-crystal" />
					<view class="empty-eye eye-left" />
					<view class="empty-eye eye-right" />
					<view class="empty-mouth" />
				</view>
				<view class="empty-question" aria-hidden="true" />
			</view>
			<view class="empty-title">{{ emptyTitle }}</view>
			<view v-if="emptySub" class="empty-sub">{{ emptySub }}</view>
			<view v-if="hasAnyOrders" class="empty-actions">
				<button v-if="showAllEmptyAction" class="empty-btn primary" @tap="setStatus('全部')">查看全部订单</button>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7fb;
	padding: calc(118rpx + env(safe-area-inset-top)) 0 132rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
:global(uni-page-body:has(> .orders-list-page)) {
	height: 100%;
	padding-bottom: 0 !important;
}

.orders-list-page {
	min-height: 100%;
}
/* #endif */

.orders-nav {
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

.tabs {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	align-items: center;
	height: 86rpx;
	background: #fff;
	border-bottom: 1rpx solid #eeeeef;
	margin-bottom: 0;
	box-sizing: border-box;
}

.tab {
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	min-width: 0;
	height: 84rpx;
	padding: 0 4rpx;
	box-sizing: border-box;
	color: #9b9da6;
	font-size: 26rpx;
	font-weight: 800;
	text-align: center;
	white-space: nowrap;
}

.tab-inner {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 0;
	max-width: 100%;
}

.tab-label {
	display: block;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tab-badge {
	position: absolute;
	left: calc(100% - 2rpx);
	top: -18rpx;
	min-width: 28rpx;
	height: 28rpx;
	line-height: 28rpx;
	padding: 0 8rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 18rpx;
	font-weight: 900;
	box-sizing: border-box;
}

.tab.active {
	color: #d92733;
}

.tab.active::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: 0;
	width: 54rpx;
	height: 5rpx;
	border-radius: 999rpx;
	background: #d92733;
	transform: translateX(-50%);
}

.list {
	display: flex;
	flex-direction: column;
	gap: 22rpx;
	padding: 24rpx;
	background: #f7f7f7;
	min-height: calc(100vh - 86rpx);
	box-sizing: border-box;
}

.order-card {
	background: #fff;
	border-radius: 14rpx;
	padding: 24rpx 22rpx 20rpx;
	box-shadow: 0 8rpx 20rpx rgba(24, 27, 35, 0.04);
}

.order-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	margin-bottom: 22rpx;
}

.order-meta {
	min-width: 0;
}

.order-no {
	max-width: 430rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 25rpx;
	font-weight: 900;
	color: #1d1f25;
}

.order-date {
	margin-top: 8rpx;
	color: #9a9da4;
	font-size: 21rpx;
}

.order-status {
	flex-shrink: 0;
	padding: 7rpx 14rpx;
	border-radius: 999rpx;
	background: #fff3f3;
	color: #d23a3a;
	font-size: 20rpx;
	font-weight: 700;
}

.order-main {
	display: flex;
	align-items: flex-start;
	gap: 18rpx;
	padding: 18rpx;
	border-radius: 12rpx;
	background: #fafafa;
	box-sizing: border-box;
}

.order-main:active,
.action-btn:active {
	opacity: 0.74;
}

.order-img-wrap {
	position: relative;
	width: 132rpx;
	height: 132rpx;
	border-radius: 10rpx;
	background: #f0f0f0;
	flex-shrink: 0;
	overflow: hidden;
}

.order-img {
	width: 100%;
	height: 100%;
	display: block;
}

.order-body {
	flex: 1;
	min-width: 0;
	padding-top: 2rpx;
}

.order-title {
	margin-top: 6rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 27rpx;
	font-weight: 900;
	color: #202229;
}

.order-type {
	color: #b5b6bc;
	font-size: 21rpx;
	font-weight: 900;
}

.order-summary {
	margin-top: 8rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	color: #7f828b;
	font-size: 22rpx;
	line-height: 1.45;
}

.order-extra {
	display: inline-flex;
	align-items: center;
	margin-top: 10rpx;
	padding: 5rpx 12rpx;
	border-radius: 999rpx;
	background: #fff;
	color: #9b9da6;
	font-size: 20rpx;
	font-weight: 800;
}

.order-price {
	width: 124rpx;
	flex-shrink: 0;
	text-align: right;
}

.price-label,
.item-count {
	color: #a3a5ab;
	font-size: 20rpx;
}

.price-value {
	margin-top: 10rpx;
	color: #d92733;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1;
}

.item-count {
	margin-top: 14rpx;
}

.bead-strip {
	position: absolute;
	left: 8rpx;
	right: 8rpx;
	bottom: 8rpx;
	display: flex;
	justify-content: center;
}

.bead-mini {
	width: 26rpx;
	height: 26rpx;
	border-radius: 50%;
	background: #fff;
	border: 2rpx solid rgba(255, 255, 255, 0.82);
	box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.12);
	overflow: hidden;
	margin-left: -5rpx;
}

.bead-mini:first-child {
	margin-left: 0;
}

.bead-mini-img {
	width: 100%;
	height: 100%;
	display: block;
}

.order-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 14rpx;
	margin-top: 20rpx;
}

.action-btn {
	margin: 0;
	padding: 0 24rpx;
	height: 56rpx;
	line-height: 56rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 22rpx;
	font-weight: 900;
}

.action-btn.ghost {
	background: #fff;
	color: #d92733;
	border: 1rpx solid #f0c3c6;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 252rpx 36rpx 0;
	text-align: center;
}

.empty-title {
	margin-top: 70rpx;
	font-size: 28rpx;
	font-weight: 800;
	color: #aaa3a2;
}

.empty-sub {
	max-width: 520rpx;
	margin-top: 16rpx;
	color: #9a9da4;
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.5;
}

.empty-actions {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 18rpx;
	margin-top: 30rpx;
	flex-wrap: wrap;
}

.empty-btn {
	min-width: 168rpx;
	height: 64rpx;
	line-height: 64rpx;
	margin: 0;
	padding: 0 26rpx;
	border-radius: 999rpx;
	background: #fff;
	border: 1rpx solid #f0c3c6;
	color: #d92733;
	font-size: 24rpx;
	font-weight: 900;
}

.empty-btn.primary {
	background: #d92733;
	border-color: #d92733;
	color: #fff;
	box-shadow: 0 10rpx 20rpx rgba(217, 39, 51, 0.16);
}

.empty-btn::after {
	border: 0;
}

.empty-order-art {
	position: relative;
	width: 282rpx;
	height: 238rpx;
	transform: scale(1.28);
	transform-origin: center;
}

.empty-ground {
	position: absolute;
	left: 70rpx;
	bottom: 18rpx;
	width: 154rpx;
	height: 30rpx;
	border-bottom: 8rpx solid rgba(169, 120, 72, 0.86);
	border-radius: 50%;
	transform: rotate(-6deg);
}

.empty-stone {
	position: absolute;
	left: 84rpx;
	top: 54rpx;
	z-index: 2;
	width: 126rpx;
	height: 118rpx;
	border-radius: 49% 49% 45% 45%;
	border: 6rpx solid #a97848;
	background: #fff9ef;
	box-shadow: 0 12rpx 20rpx rgba(153, 111, 66, 0.14);
	box-sizing: border-box;
}

.empty-crown {
	position: absolute;
	left: 38rpx;
	top: -28rpx;
	width: 48rpx;
	height: 36rpx;
	background:
		linear-gradient(135deg, transparent 0 38%, #a97848 39% 62%, transparent 63%),
		linear-gradient(225deg, transparent 0 38%, #a97848 39% 62%, transparent 63%);
}

.empty-arm {
	position: absolute;
	z-index: 4;
	width: 44rpx;
	height: 42rpx;
	border: 6rpx solid #a97848;
	border-top: 0;
	border-radius: 0 0 26rpx 26rpx;
	background: #fff9ef;
	box-sizing: border-box;
}

.empty-arm-left {
	left: 26rpx;
	top: 72rpx;
	transform: rotate(22deg);
}

.empty-arm-right {
	right: 22rpx;
	top: 72rpx;
	transform: rotate(-22deg);
}

.empty-held-crystal {
	position: absolute;
	left: 41rpx;
	top: 60rpx;
	z-index: 3;
	width: 50rpx;
	height: 72rpx;
	border: 5rpx solid #a97848;
	background:
		linear-gradient(135deg, rgba(250, 230, 197, 0.72) 0 44%, transparent 45%),
		linear-gradient(45deg, transparent 0 45%, rgba(250, 230, 197, 0.72) 46% 68%, transparent 69%),
		#fff6e8;
	clip-path: polygon(50% 0, 100% 32%, 78% 100%, 22% 100%, 0 32%);
	transform: rotate(-14deg);
	box-sizing: border-box;
}

.empty-eye {
	position: absolute;
	top: 44rpx;
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #a97848;
}

.eye-left {
	left: 37rpx;
}

.eye-right {
	right: 37rpx;
}

.empty-mouth {
	position: absolute;
	left: 54rpx;
	top: 62rpx;
	width: 16rpx;
	height: 8rpx;
	border-bottom: 4rpx solid #a97848;
	border-radius: 0 0 999rpx 999rpx;
}

.empty-question {
	position: absolute;
	right: 8rpx;
	top: 44rpx;
	color: #a97848;
	font-size: 104rpx;
	font-weight: 900;
	line-height: 1;
}

.empty-question::before,
.empty-doubt::before {
	content: '?';
	display: block;
}

.empty-doubt {
	position: absolute;
	z-index: 3;
	color: #a97848;
	font-weight: 900;
	line-height: 1;
	transform: rotate(-18deg);
}

.doubt-a {
	left: 50rpx;
	top: 28rpx;
	font-size: 50rpx;
}

.doubt-b {
	left: 22rpx;
	top: 74rpx;
	font-size: 42rpx;
}

.empty-crystal {
	position: absolute;
	left: 24rpx;
	bottom: 30rpx;
	z-index: 1;
	width: 58rpx;
	height: 72rpx;
	border: 5rpx solid #a97848;
	background: #fff;
	transform: rotate(-22deg) skewY(-12deg);
	box-sizing: border-box;
}

.empty-crystal::before,
.empty-crystal::after {
	content: '';
	position: absolute;
	background: #a97848;
	transform-origin: center;
}

.empty-crystal::before {
	left: 50%;
	top: -4rpx;
	width: 5rpx;
	height: calc(100% + 8rpx);
	transform: translateX(-50%) rotate(20deg);
}

.empty-crystal::after {
	left: 4rpx;
	right: 4rpx;
	top: 50%;
	height: 5rpx;
	transform: rotate(-16deg);
}

.crystal-b {
	left: 68rpx;
	bottom: 4rpx;
	width: 42rpx;
	height: 54rpx;
	transform: rotate(18deg) skewY(10deg);
}

.crystal-c {
	left: 4rpx;
	bottom: 4rpx;
	width: 34rpx;
	height: 42rpx;
	transform: rotate(-10deg) skewY(-8deg);
}

</style>
