<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useDesignStore } from '@/stores/design';
import { useMaterialsStore } from '@/stores/materials';
import { addLocalCartItems } from '@/utils/checkout';
import { designEntrySourceForCartItem, openDesignStudio } from '@/utils/designNavigation';
import {
	cloneOrderItemsForCart,
	loadLocalOrders,
	logisticsOrderNo,
	normalizeOrderStatus,
	updateLocalOrderStatus,
	type NormalizedOrderStatus,
	type OrderRecord,
} from '@/utils/orders';
import {
	cartItemDisplayName,
	cartItemSummaryText,
	cartItemTypeText,
	formatOrderDate,
	orderEditableComposition,
	orderImage,
} from '@/utils/orderDisplay';

const orderId = ref('');
const order = ref<OrderRecord | null>(null);
const designStore = useDesignStore();
const materialsStore = useMaterialsStore();
const supportOpen = ref(false);
const supportId = 'YGS-STONE';

interface LogisticsEvent {
	title: string;
	desc: string;
	time: string;
	state: 'active' | 'done';
}

interface LogisticsInfo {
	carrier: string;
	current: string;
	status: string;
	trackingNo: string;
	updatedAt: string;
	events: LogisticsEvent[];
}

const itemTotal = computed(() => order.value?.itemTotal ?? order.value?.total ?? 0);
const freight = computed(() => order.value?.freight ?? 0);
const discount = computed(() => order.value?.discount ?? 0);
const hasEditableDesign = computed(() => (order.value ? !!orderEditableComposition(order.value)?.length : false));
const normalizedStatus = computed<NormalizedOrderStatus>(() => normalizeOrderStatus(order.value?.status || ''));
const logisticsInfo = computed(() => (order.value ? buildLogisticsInfo(order.value) : null));
const primaryOrderActionText = computed(() => {
	if (normalizedStatus.value === '待发货') return '提醒发货';
	if (normalizedStatus.value === '已发货') return '确认收货';
	if (normalizedStatus.value === '已收货') return '再次购买';
	if (hasEditableDesign.value) return '继续编辑';
	return '';
});
const secondaryOrderActionText = computed(() => {
	if (normalizedStatus.value === '待发货' && hasEditableDesign.value) return '继续编辑';
	if (normalizedStatus.value === '已发货' && logisticsInfo.value) return '复制单号';
	if (normalizedStatus.value === '已收货') return '申请售后';
	return '';
});
const statusMeta = computed(() => {
	const status = normalizedStatus.value;
	if (status === '已发货') {
		return {
			title: '已发货',
			sub: '包裹已交给快递，请留意物流更新',
			icon: '运',
			progress: 66,
		};
	}
	if (status === '已收货') {
		return {
			title: '已收货',
			sub: '订单已完成，感谢把这条手串带回家',
			icon: '收',
			progress: 100,
		};
	}
	if (status === '退款/售后') {
		return {
			title: '退款/售后',
			sub: '售后申请处理中，客服会同步处理进度',
			icon: '售',
			progress: 50,
		};
	}
	return {
		title: '待发货',
		sub: '已收到订单，我们正在核对晶石库存和尺寸信息',
		icon: '制',
		progress: 34,
	};
});
const timelineSteps = computed(() => (order.value ? buildTimeline(order.value) : []));

onLoad((query: Record<string, string | undefined>) => {
	syncFromQuery(query);
});

onShow(() => {
	// #ifdef H5
	syncFromQuery(h5QueryFromHash());
	// #endif
	// #ifndef H5
	loadOrder();
	// #endif
});

onMounted(() => {
	// #ifdef H5
	window.addEventListener('hashchange', syncFromH5Hash);
	syncFromH5Hash();
	// #endif
});

onBeforeUnmount(() => {
	// #ifdef H5
	window.removeEventListener('hashchange', syncFromH5Hash);
	// #endif
});

function syncFromQuery(query: Record<string, string | undefined>) {
	orderId.value = decodeURIComponent(query.id || '');
	loadOrder();
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

function syncFromH5Hash() {
	syncFromQuery(h5QueryFromHash());
}

function loadOrder() {
	if (!orderId.value) {
		order.value = null;
		return;
	}
	order.value = loadLocalOrders().find((item) => item.id === orderId.value) || null;
}

function shortOrderNo(id: string) {
	return id.replace(/^order-/, '').slice(-12);
}

function formatAmount(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function itemLineTotalText(price: number, qty: number) {
	return formatAmount(price * qty);
}

function dateObjectByOffset(iso: string, days: number, hours = 0, minutes = 0) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return null;
	date.setDate(date.getDate() + days);
	date.setHours(date.getHours() + hours);
	date.setMinutes(date.getMinutes() + minutes);
	const now = new Date();
	return date.getTime() > now.getTime() ? now : date;
}

function dateByOffset(iso: string, days: number) {
	const date = dateObjectByOffset(iso, days);
	return date ? formatOrderDate(date.toISOString()) : '';
}

function logisticsTimeByOffset(iso: string, days: number, hours = 0, minutes = 0) {
	const date = dateObjectByOffset(iso, days, hours, minutes);
	if (!date) return '';
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${month}-${day} ${hour}:${minute}`;
}

function buildLogisticsInfo(current: OrderRecord): LogisticsInfo | null {
	const status = normalizeOrderStatus(current.status);
	if (status !== '已发货' && status !== '已收货') return null;

	const receivedDone = status === '已收货';
	const baseDate = current.createdAt;
	const shippedTime = logisticsTimeByOffset(baseDate, 1, 3, 20);
	const pickedTime = logisticsTimeByOffset(baseDate, 1, 7, 45);
	const transitTime = logisticsTimeByOffset(baseDate, 2, 1, 10);
	const deliveryTime = logisticsTimeByOffset(baseDate, 3, 3, 25);
	const signedTime = logisticsTimeByOffset(baseDate, 3, 6, 5);
	const events: LogisticsEvent[] = receivedDone
		? [
				{
					title: '已签收',
					desc: '包裹已由收件人签收，感谢确认。',
					time: signedTime,
					state: 'active',
				},
				{
					title: '派送中',
					desc: '快递员正在派送，请保持电话畅通。',
					time: deliveryTime,
					state: 'done',
				},
				{
					title: '运输中',
					desc: '包裹已到达目的地转运中心，准备安排派送。',
					time: transitTime,
					state: 'done',
				},
				{
					title: '快件已揽收',
					desc: '承运方已揽收手串包裹。',
					time: pickedTime,
					state: 'done',
				},
				{
					title: '商家已发货',
					desc: '手串已完成检查和包装，交给顺丰速运。',
					time: shippedTime,
					state: 'done',
				},
			]
		: [
				{
					title: '运输中',
					desc: '包裹正在前往目的地转运中心，物流会持续更新。',
					time: transitTime,
					state: 'active',
				},
				{
					title: '快件已揽收',
					desc: '承运方已揽收手串包裹。',
					time: pickedTime,
					state: 'done',
				},
				{
					title: '商家已发货',
					desc: '手串已完成检查和包装，交给顺丰速运。',
					time: shippedTime,
					state: 'done',
				},
			];

	return {
		carrier: '顺丰速运',
		current: receivedDone ? '包裹已签收' : '包裹运输中',
		status: receivedDone ? '已完成' : '待收货',
		trackingNo: logisticsOrderNo(current.id),
		updatedAt: events[0]?.time || formatOrderDate(baseDate),
		events,
	};
}

function buildTimeline(current: OrderRecord) {
	const status = normalizeOrderStatus(current.status);
	const baseDate = current.createdAt;
	if (status === '退款/售后') {
		return [
			{
				title: '订单已提交',
				desc: '订单信息已生成，可在详情页继续查看商品和金额',
				time: formatOrderDate(baseDate),
				state: 'done',
			},
			{
				title: '售后处理中',
				desc: '客服正在核对订单、商品状态和处理方案',
				time: dateByOffset(baseDate, 1),
				state: 'active',
			},
			{
				title: '处理完成',
				desc: '处理结果会同步到订单状态，请留意客服通知',
				time: '',
				state: 'pending',
			},
		];
	}
	const shippedDone = status === '已发货' || status === '已收货';
	const receivedDone = status === '已收货';
	return [
		{
			title: '订单已提交',
			desc: '我们已收到您的订单，正在整理定制信息',
			time: formatOrderDate(baseDate),
			state: 'done',
		},
		{
			title: '核对制作',
			desc: shippedDone ? '晶石库存和尺寸信息已核对完成' : '正在核对晶石库存、尺寸和备注信息',
			time: shippedDone ? dateByOffset(baseDate, 1) : '',
			state: shippedDone ? 'done' : 'active',
		},
		{
			title: '包裹发出',
			desc: receivedDone ? '包裹已发出并进入运输流程' : '发货后可在这里查看物流进度',
			time: shippedDone ? dateByOffset(baseDate, 2) : '',
			state: shippedDone ? (receivedDone ? 'done' : 'active') : 'pending',
		},
		{
			title: '确认收货',
			desc: receivedDone ? '订单已完成，可再次购买或申请售后' : '收到手串后可联系客服处理保养和售后',
			time: receivedDone ? dateByOffset(baseDate, 4) : '',
			state: receivedDone ? 'done' : 'pending',
		},
	];
}

function contactService() {
	supportOpen.value = true;
}

function closeSupport() {
	supportOpen.value = false;
}

function copyServiceId() {
	uni.setClipboardData({
		data: supportId,
		success: () => {
			uni.showToast({ title: '已复制客服号', icon: 'none' });
		},
	});
}

function applyOrderStatus(status: NormalizedOrderStatus, toastTitle: string) {
	if (!order.value) return;
	const updated = updateLocalOrderStatus(order.value.id, status);
	if (!updated) {
		uni.showToast({ title: '订单状态更新失败', icon: 'none' });
		return;
	}
	order.value = updated;
	uni.showToast({ title: toastTitle, icon: 'success' });
}

function remindShipment() {
	if (!order.value) return;
	uni.showModal({
		title: '已提醒客服',
		content: '我们已记录提醒，会优先核对晶石库存、手围信息和发货安排。',
		showCancel: false,
	});
}

function confirmReceive() {
	if (!order.value) return;
	uni.showModal({
		title: '确认收货',
		content: '确认已经收到这笔订单的商品？确认后订单会进入已收货状态。',
		confirmText: '确认收货',
		success: (res) => {
			if (res.confirm) applyOrderStatus('已收货', '已确认收货');
		},
	});
}

function requestAfterSale() {
	if (!order.value) return;
	uni.showModal({
		title: '申请售后',
		content: '提交后订单会进入退款/售后状态，客服会继续核对商品、证书、补差价或改款问题。',
		confirmText: '申请售后',
		success: (res) => {
			if (res.confirm) applyOrderStatus('退款/售后', '已提交售后');
		},
	});
}

function handlePrimaryOrderAction() {
	if (normalizedStatus.value === '待发货') {
		remindShipment();
		return;
	}
	if (normalizedStatus.value === '已发货') {
		confirmReceive();
		return;
	}
	if (normalizedStatus.value === '已收货') {
		repeatOrder();
		return;
	}
	if (hasEditableDesign.value) {
		continueEdit();
	}
}

function handleSecondaryOrderAction() {
	if (secondaryOrderActionText.value === '继续编辑' || secondaryOrderActionText.value === '再次编辑') {
		continueEdit();
		return;
	}
	if (secondaryOrderActionText.value === '复制单号') {
		copyTrackingNo();
		return;
	}
	if (secondaryOrderActionText.value === '申请售后') {
		requestAfterSale();
	}
}

function copyTrackingNo() {
	if (!logisticsInfo.value) return;
	uni.setClipboardData({
		data: logisticsInfo.value.trackingNo,
		success: () => {
			uni.showToast({ title: '已复制单号', icon: 'none' });
		},
	});
}

function continueEdit() {
	if (!order.value) return;
	const editableItem = order.value.items.find((item) => item.composition?.length);
	const composition = editableItem?.composition ?? orderEditableComposition(order.value);
	if (!composition?.length) return;
	designStore.applyDesignFromPlaza(composition, {
		source: 'order',
		handCircumferenceCm: editableItem?.handCircumferenceCm ?? null,
	});
	materialsStore.setSearchKeyword('');
	materialsStore.setCategory('in-use');
	openDesignStudio(designEntrySourceForCartItem(editableItem));
}

function repeatOrder() {
	if (!order.value) return;
	const items = cloneOrderItemsForCart(order.value);
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

function goOrders() {
	uni.redirectTo({ url: '/pages/orders/list' });
}

function goBack() {
	uni.navigateBack({ fail: () => goOrders() });
}
</script>

<template>
	<view class="page app-subpage order-detail-page" :class="{ 'page--missing': !order }">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="order-detail-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">订单详情</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view v-if="!order" class="empty">
			<view class="empty-title">订单不存在</view>
			<view class="empty-sub">可能已被清理，请返回订单列表查看</view>
			<button class="empty-btn" @tap="goOrders">返回订单</button>
		</view>

		<template v-else>
			<view class="status-card">
				<view>
					<view class="status-title">{{ statusMeta.title }}</view>
					<view class="status-sub">{{ statusMeta.sub }}</view>
				</view>
				<view class="status-icon">{{ statusMeta.icon }}</view>
				<view class="status-progress">
					<view class="status-progress-bar" :style="{ width: `${statusMeta.progress}%` }" />
				</view>
			</view>

			<view v-if="order.address" class="section address-card">
				<view class="section-title">收货信息</view>
				<view class="address-top">
					<text class="address-name">{{ order.address.name }}</text>
					<text class="address-phone">{{ order.address.phone }}</text>
				</view>
				<view class="address-text">{{ order.address.region }} {{ order.address.detail }}</view>
			</view>

			<view v-if="logisticsInfo" class="section logistics-card">
				<view class="section-head logistics-head">
					<view>
						<view class="section-title">物流信息</view>
						<view class="logistics-current">{{ logisticsInfo.current }}</view>
					</view>
					<view class="logistics-status">{{ logisticsInfo.status }}</view>
				</view>
				<view class="logistics-summary">
					<view class="logistics-row">
						<text class="logistics-label">承运方</text>
						<text class="logistics-value">{{ logisticsInfo.carrier }}</text>
					</view>
					<view class="logistics-row logistics-row--tap" @tap="copyTrackingNo">
						<text class="logistics-label">快递单号</text>
						<view class="logistics-copy">
							<text class="logistics-value">{{ logisticsInfo.trackingNo }}</text>
							<text class="logistics-copy-action">复制</text>
						</view>
					</view>
					<view class="logistics-row">
						<text class="logistics-label">最近更新</text>
						<text class="logistics-value">{{ logisticsInfo.updatedAt }}</text>
					</view>
				</view>
				<view class="logistics-events">
					<view
						v-for="event in logisticsInfo.events"
						:key="`${event.title}-${event.time}`"
						class="logistics-event"
						:class="`logistics-event--${event.state}`"
					>
						<view class="logistics-event-rail">
							<view class="logistics-event-dot" />
						</view>
						<view class="logistics-event-body">
							<view class="logistics-event-row">
								<view class="logistics-event-title">{{ event.title }}</view>
								<view class="logistics-event-time">{{ event.time }}</view>
							</view>
							<view class="logistics-event-desc">{{ event.desc }}</view>
						</view>
					</view>
				</view>
			</view>

			<view class="section tracking-section">
				<view class="section-head tracking-head">
					<view class="section-title">订单进度</view>
					<view class="tracking-updated">更新 {{ formatOrderDate(order.createdAt) }}</view>
				</view>
				<view class="progress-line">
					<view class="progress-line-fill" :style="{ width: `${statusMeta.progress}%` }" />
				</view>
				<view class="timeline">
					<view
						v-for="step in timelineSteps"
						:key="step.title"
						class="timeline-step"
						:class="`timeline-step--${step.state}`"
					>
						<view class="timeline-rail">
							<view class="timeline-dot" />
						</view>
						<view class="timeline-body">
							<view class="timeline-row">
								<view class="timeline-title">{{ step.title }}</view>
								<view v-if="step.time" class="timeline-time">{{ step.time }}</view>
							</view>
							<view class="timeline-desc">{{ step.desc }}</view>
						</view>
					</view>
				</view>
			</view>

			<view class="section">
				<view class="section-head">
					<view class="section-title">商品信息</view>
					<view class="section-count">共 {{ order.itemCount }} 件</view>
				</view>
				<view v-for="item in order.items" :key="item.id" class="order-item">
					<image class="item-img" :src="item.image || orderImage(order)" mode="aspectFill" />
					<view class="item-body">
						<view class="item-type">{{ cartItemTypeText(item) }}</view>
						<view class="item-name">{{ cartItemDisplayName(item) }}</view>
						<view class="item-summary">{{ cartItemSummaryText(item) }}</view>
					</view>
					<view class="item-price">
						<view>¥ {{ formatAmount(item.price) }}</view>
						<view class="item-qty">×{{ item.qty }}</view>
						<view class="item-line-total">小计 ¥ {{ itemLineTotalText(item.price, item.qty) }}</view>
					</view>
				</view>
			</view>

			<view class="section amount-section">
				<view class="amount-row">
					<text>商品金额</text>
					<text>¥ {{ formatAmount(itemTotal) }}</text>
				</view>
				<view class="amount-row">
					<text>运费</text>
					<text>¥ {{ formatAmount(freight) }}</text>
				</view>
				<view v-if="discount" class="amount-row">
					<text>优惠抵扣</text>
					<text class="red">-¥ {{ formatAmount(discount) }}</text>
				</view>
				<view class="amount-row total-row">
					<text>实付款</text>
					<text class="total-price">¥ {{ formatAmount(order.total) }}</text>
				</view>
			</view>

			<view class="section info-section">
				<view class="info-row">
					<text>订单编号</text>
					<text>{{ shortOrderNo(order.id) }}</text>
				</view>
				<view class="info-row">
					<text>下单时间</text>
					<text>{{ formatOrderDate(order.createdAt) }}</text>
				</view>
				<view v-if="order.couponCode" class="info-row">
					<text>优惠口令</text>
					<text>{{ order.couponCode }}</text>
				</view>
				<view v-if="order.note" class="info-row">
					<text>买家留言</text>
					<text>{{ order.note }}</text>
				</view>
			</view>

			<view class="footer">
				<button class="footer-btn ghost" @tap="contactService">联系客服</button>
				<button v-if="secondaryOrderActionText" class="footer-btn ghost" @tap="handleSecondaryOrderAction">
					{{ secondaryOrderActionText }}
				</button>
				<button v-if="primaryOrderActionText" class="footer-btn" @tap="handlePrimaryOrderAction">
					{{ primaryOrderActionText }}
				</button>
			</view>
		</template>

		<view v-if="supportOpen" class="support-mask" @tap="closeSupport">
			<view class="support-sheet" @tap.stop>
				<view class="support-handle" />
				<view class="support-head">
					<view>
						<view class="support-title">联系客服</view>
						<view class="support-sub">订单、改地址、发货和售后都可以发给客服处理</view>
					</view>
					<view class="support-close" @tap="closeSupport">×</view>
				</view>
				<view class="support-body">
					<view class="support-qr">
						<view class="support-qr-corner support-qr-corner--tl" />
						<view class="support-qr-corner support-qr-corner--tr" />
						<view class="support-qr-corner support-qr-corner--bl" />
						<view class="support-qr-dot support-qr-dot--a" />
						<view class="support-qr-dot support-qr-dot--b" />
						<view class="support-qr-dot support-qr-dot--c" />
						<view class="support-qr-logo">石</view>
					</view>
					<view class="support-info">
						<view class="support-label">客服号</view>
						<view class="support-id">{{ supportId }}</view>
						<view class="support-note">发送订单号 {{ order ? shortOrderNo(order.id) : '' }}，可查询实物图、制作进度和售后处理。</view>
						<button class="support-copy" @tap="copyServiceId">复制客服号</button>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7f7;
	padding: calc(142rpx + env(safe-area-inset-top)) 22rpx 156rpx;
	box-sizing: border-box;
}

.order-detail-nav {
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

/* #ifdef H5 */
:global(uni-app:has(.order-detail-page) uni-tabbar),
:global(uni-app:has(.order-detail-page) .uni-tabbar-bottom) {
	display: none;
}

:global(uni-page-body:has(> .order-detail-page)) {
	min-height: 100%;
	padding-bottom: 0 !important;
}

.order-detail-page {
	min-height: 100%;
}
/* #endif */

.status-card {
	position: relative;
	min-height: 146rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	padding: 28rpx 28rpx 40rpx;
	border-radius: 16rpx;
	background: #d92733;
	color: #fff;
	box-shadow: 0 12rpx 26rpx rgba(217, 39, 51, 0.18);
	box-sizing: border-box;
}

.status-title {
	font-size: 36rpx;
	font-weight: 900;
}

.status-sub {
	margin-top: 14rpx;
	font-size: 23rpx;
	font-weight: 800;
	opacity: 0.9;
}

.status-icon {
	width: 78rpx;
	height: 78rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.18);
	font-size: 36rpx;
	font-weight: 900;
	line-height: 78rpx;
	text-align: center;
	flex-shrink: 0;
}

.status-progress {
	position: absolute;
	left: 28rpx;
	right: 28rpx;
	bottom: 20rpx;
	height: 8rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.24);
	overflow: hidden;
}

.status-progress-bar {
	height: 100%;
	border-radius: inherit;
	background: #fff;
	transition: width 160ms ease;
}

.section {
	margin-top: 18rpx;
	padding: 22rpx;
	border-radius: 14rpx;
	background: #fff;
	box-shadow: 0 8rpx 20rpx rgba(31, 35, 48, 0.04);
	box-sizing: border-box;
}

.section-title {
	color: #202229;
	font-size: 29rpx;
	font-weight: 900;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
	margin-bottom: 18rpx;
}

.tracking-head {
	margin-bottom: 20rpx;
}

.tracking-updated {
	flex-shrink: 0;
	color: #a0a3aa;
	font-size: 22rpx;
	font-weight: 800;
	white-space: nowrap;
}

.progress-line {
	height: 10rpx;
	border-radius: 999rpx;
	background: #f0f0f2;
	overflow: hidden;
}

.progress-line-fill {
	height: 100%;
	border-radius: inherit;
	background: #d92733;
	transition: width 160ms ease;
}

.timeline {
	margin-top: 24rpx;
}

.timeline-step {
	position: relative;
	display: flex;
	gap: 18rpx;
	min-height: 92rpx;
	padding-bottom: 20rpx;
	box-sizing: border-box;
}

.timeline-step:last-child {
	min-height: 0;
	padding-bottom: 0;
}

.timeline-rail {
	position: relative;
	width: 24rpx;
	display: flex;
	justify-content: center;
	flex-shrink: 0;
}

.timeline-rail::after {
	content: '';
	position: absolute;
	top: 24rpx;
	bottom: -4rpx;
	width: 3rpx;
	border-radius: 999rpx;
	background: #eeeeef;
}

.timeline-step:last-child .timeline-rail::after {
	display: none;
}

.timeline-dot {
	position: relative;
	z-index: 1;
	width: 18rpx;
	height: 18rpx;
	margin-top: 4rpx;
	border-radius: 50%;
	background: #d7d8de;
	box-shadow: 0 0 0 8rpx #f6f6f8;
}

.timeline-body {
	flex: 1;
	min-width: 0;
}

.timeline-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
}

.timeline-title {
	color: #202229;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1.2;
}

.timeline-time {
	flex-shrink: 0;
	color: #a0a3aa;
	font-size: 21rpx;
	font-weight: 800;
	white-space: nowrap;
}

.timeline-desc {
	margin-top: 10rpx;
	color: #8b8e97;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.42;
}

.timeline-step--done .timeline-dot {
	background: #d92733;
	box-shadow: 0 0 0 8rpx #fff0f1;
}

.timeline-step--done .timeline-rail::after {
	background: #f2b1b5;
}

.timeline-step--active .timeline-dot {
	width: 22rpx;
	height: 22rpx;
	margin-top: 2rpx;
	background: #d92733;
	box-shadow: 0 0 0 8rpx #fff0f1;
}

.timeline-step--active .timeline-title {
	color: #d92733;
}

.section-count {
	color: #a0a3aa;
	font-size: 23rpx;
	font-weight: 900;
}

.address-top {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.address-name {
	color: #17191f;
	font-size: 29rpx;
	font-weight: 900;
}

.address-phone {
	color: #70747d;
	font-size: 25rpx;
	font-weight: 800;
}

.address-text {
	margin-top: 12rpx;
	color: #555963;
	font-size: 25rpx;
	line-height: 1.45;
}

.logistics-card {
	overflow: hidden;
}

.logistics-head {
	align-items: flex-start;
	margin-bottom: 20rpx;
}

.logistics-current {
	margin-top: 10rpx;
	color: #d92733;
	font-size: 24rpx;
	font-weight: 900;
}

.logistics-status {
	flex-shrink: 0;
	min-width: 104rpx;
	height: 44rpx;
	padding: 0 18rpx;
	border-radius: 999rpx;
	background: #fff1f2;
	color: #d92733;
	font-size: 22rpx;
	font-weight: 900;
	line-height: 44rpx;
	text-align: center;
	box-sizing: border-box;
}

.logistics-summary {
	border-radius: 12rpx;
	background: #fafafa;
	padding: 10rpx 18rpx;
}

.logistics-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	min-height: 58rpx;
	border-bottom: 1rpx solid #efeff2;
	font-size: 24rpx;
	font-weight: 850;
}

.logistics-row:last-child {
	border-bottom: 0;
}

.logistics-row--tap {
	cursor: pointer;
}

.logistics-label {
	flex-shrink: 0;
	color: #8d9099;
}

.logistics-value {
	min-width: 0;
	color: #25272f;
	text-align: right;
	word-break: break-all;
}

.logistics-copy {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12rpx;
	min-width: 0;
}

.logistics-copy-action {
	flex-shrink: 0;
	height: 38rpx;
	padding: 0 14rpx;
	border-radius: 999rpx;
	background: #202229;
	color: #fff;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 38rpx;
}

.logistics-events {
	margin-top: 24rpx;
}

.logistics-event {
	display: flex;
	gap: 18rpx;
	min-height: 92rpx;
	padding-bottom: 18rpx;
	box-sizing: border-box;
}

.logistics-event:last-child {
	min-height: 0;
	padding-bottom: 0;
}

.logistics-event-rail {
	position: relative;
	width: 24rpx;
	display: flex;
	justify-content: center;
	flex-shrink: 0;
}

.logistics-event-rail::after {
	content: '';
	position: absolute;
	top: 24rpx;
	bottom: -4rpx;
	width: 3rpx;
	border-radius: 999rpx;
	background: #ececf0;
}

.logistics-event:last-child .logistics-event-rail::after {
	display: none;
}

.logistics-event-dot {
	position: relative;
	z-index: 1;
	width: 18rpx;
	height: 18rpx;
	margin-top: 4rpx;
	border-radius: 50%;
	background: #cfd1d8;
	box-shadow: 0 0 0 8rpx #f7f7f9;
}

.logistics-event--active .logistics-event-dot {
	width: 22rpx;
	height: 22rpx;
	margin-top: 2rpx;
	background: #d92733;
	box-shadow: 0 0 0 8rpx #fff0f1;
}

.logistics-event--done .logistics-event-dot {
	background: #d92733;
	box-shadow: 0 0 0 8rpx #fff0f1;
}

.logistics-event--done .logistics-event-rail::after {
	background: #f2b1b5;
}

.logistics-event-body {
	flex: 1;
	min-width: 0;
}

.logistics-event-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
}

.logistics-event-title {
	color: #202229;
	font-size: 26rpx;
	font-weight: 900;
	line-height: 1.25;
}

.logistics-event--active .logistics-event-title {
	color: #d92733;
}

.logistics-event-time {
	flex-shrink: 0;
	color: #a0a3aa;
	font-size: 21rpx;
	font-weight: 850;
	white-space: nowrap;
}

.logistics-event-desc {
	margin-top: 10rpx;
	color: #858891;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.42;
}

.order-item {
	display: flex;
	align-items: flex-start;
	gap: 18rpx;
	padding: 18rpx;
	border-radius: 12rpx;
	background: #fafafa;
}

.order-item + .order-item {
	margin-top: 14rpx;
}

.item-img {
	width: 118rpx;
	height: 118rpx;
	border-radius: 10rpx;
	background: #f0f0f0;
	flex-shrink: 0;
}

.item-body {
	flex: 1;
	min-width: 0;
}

.item-name {
	margin-top: 8rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	color: #202229;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1.35;
}

.item-type {
	color: #b5b6bc;
	font-size: 22rpx;
	font-weight: 900;
}

.item-summary {
	margin-top: 10rpx;
	color: #858891;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.45;
}

.item-price {
	width: 132rpx;
	color: #d92733;
	font-size: 25rpx;
	font-weight: 900;
	text-align: right;
	flex-shrink: 0;
}

.item-qty {
	margin-top: 10rpx;
	color: #a0a3aa;
	font-size: 22rpx;
}

.item-line-total {
	margin-top: 22rpx;
	color: #545864;
	font-size: 21rpx;
	font-weight: 900;
}

.amount-row,
.info-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	min-height: 66rpx;
	border-bottom: 1rpx solid #f0f0f2;
	color: #25272f;
	font-size: 25rpx;
	font-weight: 800;
}

.amount-row:last-child,
.info-row:last-child {
	border-bottom: 0;
}

.amount-row text:last-child,
.info-row text:last-child {
	max-width: 430rpx;
	color: #555963;
	text-align: right;
}

.red {
	color: #d92733 !important;
}

.total-row {
	margin-top: 4rpx;
}

.total-price {
	color: #d92733 !important;
	font-size: 34rpx;
	font-weight: 900;
}

.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	justify-content: flex-end;
	gap: 16rpx;
	padding: 18rpx 22rpx calc(18rpx + env(safe-area-inset-bottom));
	background: #fff;
	box-shadow: 0 -8rpx 24rpx rgba(31, 35, 48, 0.08);
	box-sizing: border-box;
}

.footer-btn {
	width: 176rpx;
	height: 72rpx;
	line-height: 72rpx;
	margin: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 25rpx;
	font-weight: 900;
}

.footer-btn.ghost {
	background: #fff;
	color: #d92733;
	border: 1rpx solid #f0c3c6;
}

.support-mask {
	position: fixed;
	inset: 0;
	z-index: 80;
	display: flex;
	align-items: flex-end;
	background: rgba(0, 0, 0, 0.36);
}

.support-sheet {
	width: 100%;
	padding: 14rpx 24rpx calc(34rpx + env(safe-area-inset-bottom));
	border-radius: 22rpx 22rpx 0 0;
	background: #fff;
	box-shadow: 0 -16rpx 44rpx rgba(31, 35, 48, 0.18);
	box-sizing: border-box;
}

.support-handle {
	width: 72rpx;
	height: 8rpx;
	margin: 0 auto 22rpx;
	border-radius: 999rpx;
	background: #dfe1e6;
}

.support-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
}

.support-title {
	color: #15171d;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1.2;
}

.support-sub {
	margin-top: 10rpx;
	color: #7f838d;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.4;
}

.support-close {
	width: 54rpx;
	height: 54rpx;
	border-radius: 50%;
	background: #f1f2f5;
	color: #777c86;
	font-size: 40rpx;
	font-weight: 900;
	line-height: 48rpx;
	text-align: center;
	flex-shrink: 0;
}

.support-body {
	display: flex;
	align-items: center;
	gap: 24rpx;
	margin-top: 28rpx;
}

.support-qr {
	position: relative;
	width: 176rpx;
	height: 176rpx;
	border-radius: 12rpx;
	background:
		linear-gradient(90deg, transparent 9rpx, #111 9rpx 18rpx, transparent 18rpx 27rpx),
		linear-gradient(0deg, transparent 9rpx, #111 9rpx 18rpx, transparent 18rpx 27rpx),
		#fff;
	background-size: 27rpx 27rpx;
	box-shadow: inset 0 0 0 1rpx #eceef2;
	overflow: hidden;
	flex-shrink: 0;
}

.support-qr::before {
	content: '';
	position: absolute;
	inset: 22rpx 28rpx 30rpx 22rpx;
	background:
		linear-gradient(45deg, transparent 0 38%, #111 38% 50%, transparent 50% 100%),
		linear-gradient(-45deg, transparent 0 42%, #111 42% 54%, transparent 54% 100%);
	opacity: 0.92;
}

.support-qr-corner {
	position: absolute;
	width: 48rpx;
	height: 48rpx;
	border: 10rpx solid #111;
	background: #fff;
	box-shadow: inset 0 0 0 9rpx #fff, inset 0 0 0 18rpx #111;
	box-sizing: border-box;
}

.support-qr-corner--tl {
	left: 14rpx;
	top: 14rpx;
}

.support-qr-corner--tr {
	right: 14rpx;
	top: 14rpx;
}

.support-qr-corner--bl {
	left: 14rpx;
	bottom: 14rpx;
}

.support-qr-dot {
	position: absolute;
	width: 18rpx;
	height: 18rpx;
	background: #111;
}

.support-qr-dot--a {
	right: 48rpx;
	bottom: 46rpx;
	box-shadow: 24rpx 0 #111, 0 26rpx #111;
}

.support-qr-dot--b {
	left: 78rpx;
	top: 78rpx;
	box-shadow: 28rpx -18rpx #111, 44rpx 30rpx #111, -28rpx 34rpx #111;
}

.support-qr-dot--c {
	right: 22rpx;
	bottom: 18rpx;
}

.support-qr-logo {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 54rpx;
	height: 54rpx;
	border-radius: 50%;
	background: #d92733;
	color: #fff;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 54rpx;
	text-align: center;
	transform: translate(-50%, -50%);
}

.support-info {
	flex: 1;
	min-width: 0;
}

.support-label {
	color: #9ca0a8;
	font-size: 22rpx;
	font-weight: 900;
}

.support-id {
	margin-top: 8rpx;
	color: #15171d;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 1.2;
}

.support-note {
	margin-top: 12rpx;
	color: #6e727c;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.45;
}

.support-copy {
	height: 64rpx;
	line-height: 64rpx;
	margin: 18rpx 0 0;
	padding: 0 28rpx;
	border: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 24rpx;
	font-weight: 900;
}

.support-copy::after {
	border: 0;
}

.support-copy:active,
.support-close:active {
	opacity: 0.76;
}

.empty {
	margin-top: 260rpx;
	text-align: center;
}

.empty-title {
	color: #1f222a;
	font-size: 30rpx;
	font-weight: 900;
}

.empty-sub {
	margin-top: 14rpx;
	color: #a0a3aa;
	font-size: 24rpx;
}

.empty-btn {
	width: 190rpx;
	height: 68rpx;
	line-height: 68rpx;
	margin: 34rpx auto 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 25rpx;
	font-weight: 900;
}
</style>
