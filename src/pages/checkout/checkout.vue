<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { api, type CartItem } from '@/api';
import { createLocalOrder, saveLocalOrders, type OrderRecord } from '@/utils/orders';
import { cartItemSummaryText } from '@/utils/orderDisplay';
import {
	clearCheckoutDraft,
	defaultCheckoutAddress,
	loadCheckoutAddresses,
	loadCheckoutAddressesRemote,
	loadCheckoutDraft,
	removeLocalCartItems,
	type CheckoutAddress,
	type CheckoutDraft,
	usesRemoteCommerce,
} from '@/utils/checkout';
import { resolveStaticUrl } from '@/utils/staticUrl';

interface CouponRecord {
	id: string;
	code: string;
	title: string;
	amount: number;
	threshold: number;
	status: 'unused' | 'used' | 'expired';
	expireAt: string;
}

const COUPON_STORAGE_KEY = 'diy-bracelets-coupons';
const draft = ref<CheckoutDraft | null>(null);
const addresses = ref<CheckoutAddress[]>([]);
const note = ref('');
const coupons = ref<CouponRecord[]>([]);
const submittedOrder = ref<OrderRecord | null>(null);
const couponSheetOpen = ref(false);
const selectedCouponId = ref<string | null>(null);
const skipCoupon = ref(false);
const draftSignature = ref('');
const submitting = ref(false);

const items = computed(() => draft.value?.items || []);
const selectedAddress = computed(() => defaultCheckoutAddress(addresses.value));
const itemTotal = computed(() => Number(items.value.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(1)));
const freight = computed(() => (items.value.length ? 0 : 0));
const availableCoupons = computed(() =>
	coupons.value
		.filter((coupon) => isCouponValid(coupon))
		.sort((a, b) => {
			const usableRank = Number(isCouponUsable(b)) - Number(isCouponUsable(a));
			if (usableRank) return usableRank;
			if (b.amount !== a.amount) return b.amount - a.amount;
			return a.threshold - b.threshold;
		}),
);
const usableCoupons = computed(() => availableCoupons.value.filter((coupon) => isCouponUsable(coupon)));
const bestCoupon = computed(() => {
	return usableCoupons.value[0] || null;
});
const selectedCoupon = computed(() => {
	if (skipCoupon.value) return null;
	if (selectedCouponId.value) {
		const explicitCoupon = usableCoupons.value.find((coupon) => coupon.id === selectedCouponId.value);
		if (explicitCoupon) return explicitCoupon;
	}
	return bestCoupon.value;
});
const discount = computed(() => selectedCoupon.value?.amount || 0);
const payable = computed(() => Number(Math.max(0, itemTotal.value + freight.value - discount.value).toFixed(1)));
const noteCount = computed(() => note.value.length);
const successOrderNo = computed(() => submittedOrder.value?.orderNo || submittedOrder.value?.id.replace(/^order-/, '').slice(-12) || '');
const successPrimaryItem = computed(() => submittedOrder.value?.items[0] || null);
const couponRowText = computed(() => {
	if (skipCoupon.value) return '不使用优惠';
	if (selectedCoupon.value) return `${selectedCoupon.value.title} -¥${formatAmount(selectedCoupon.value.amount)}`;
	if (availableCoupons.value.length) return `${availableCoupons.value.length} 张优惠券暂不可用`;
	return '暂无可用优惠券';
});
const couponRowSubText = computed(() => {
	if (!availableCoupons.value.length || skipCoupon.value) return '';
	if (usableCoupons.value.length) return `${usableCoupons.value.length} 张可用`;
	return '未达到使用门槛';
});
const couponSheetSubText = computed(() => {
	if (!availableCoupons.value.length) return '当前暂无未使用优惠券';
	const unusableCount = availableCoupons.value.length - usableCoupons.value.length;
	if (!unusableCount) return `${availableCoupons.value.length} 张可用`;
	return `${usableCoupons.value.length} 张可用，${unusableCount} 张未达门槛`;
});

onShow(loadCheckoutState);

onMounted(() => {
	// #ifdef H5
	window.addEventListener('hashchange', syncCheckoutStateFromHash);
	syncCheckoutStateFromHash();
	// #endif
});

onBeforeUnmount(() => {
	// #ifdef H5
	window.removeEventListener('hashchange', syncCheckoutStateFromHash);
	// #endif
});

function syncCheckoutStateFromHash() {
	// #ifdef H5
	if (!window.location.hash.startsWith('#/pages/checkout/checkout')) return;
	// #endif
	loadCheckoutState();
}

function loadCheckoutState() {
	if (submittedOrder.value) return;
	const nextDraft = loadCheckoutDraft();
	const nextSignature = getDraftSignature(nextDraft);
	if (nextSignature !== draftSignature.value) {
		selectedCouponId.value = null;
		skipCoupon.value = false;
		note.value = nextDraft?.note || '';
	}
	draftSignature.value = nextSignature;
	draft.value = nextDraft;
	addresses.value = loadCheckoutAddresses();
	void loadCheckoutAddressesRemote().then((remote) => {
		addresses.value = remote;
	});
	coupons.value = usesRemoteCommerce ? [] : loadCoupons();
	couponSheetOpen.value = false;
	normalizeSelectedCoupon();
}

function loadCoupons(): CouponRecord[] {
	try {
		const raw = uni.getStorageSync(COUPON_STORAGE_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(cached) ? cached : [];
	} catch {
		return [];
	}
}

function saveCoupons(next: CouponRecord[]) {
	uni.setStorageSync(COUPON_STORAGE_KEY, JSON.stringify(next));
}

function formatAmount(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatAmountFixed(value: number) {
	return value.toFixed(1);
}

function formatDate(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}.${month}.${day}`;
}

function getDraftSignature(nextDraft: CheckoutDraft | null) {
	if (!nextDraft) return '';
	const itemsSignature = nextDraft.items.map((item) => `${item.id}:${item.qty}:${item.price}`).join('|');
	return `${nextDraft.id}|${itemsSignature}`;
}

function couponExpireTime(coupon: CouponRecord) {
	const time = new Date(coupon.expireAt).getTime();
	return Number.isNaN(time) ? 0 : time;
}

function isCouponValid(coupon: CouponRecord) {
	return coupon.status === 'unused' && couponExpireTime(coupon) >= Date.now();
}

function isCouponUsable(coupon: CouponRecord) {
	return isCouponValid(coupon) && itemTotal.value >= coupon.threshold;
}

function normalizeSelectedCoupon() {
	if (!selectedCouponId.value) return;
	if (!usableCoupons.value.some((coupon) => coupon.id === selectedCouponId.value)) {
		selectedCouponId.value = null;
	}
}

function couponThresholdText(coupon: CouponRecord) {
	return coupon.threshold > 0 ? `满 ${formatAmount(coupon.threshold)} 可用` : '无门槛';
}

function couponExpireText(coupon: CouponRecord) {
	const date = formatDate(coupon.expireAt);
	return date ? `有效期至 ${date}` : '长期有效';
}

function couponDisabledText(coupon: CouponRecord) {
	if (isCouponUsable(coupon)) return '';
	const gap = Number(Math.max(0, coupon.threshold - itemTotal.value).toFixed(1));
	return gap ? `还差 ¥${formatAmount(gap)}` : '不可用';
}

function legacyNameParts(item: CartItem) {
	if (item.spec || !item.name.includes(' · ')) return { name: item.name, spec: '' };
	const [name, ...specParts] = item.name.split(' · ');
	return { name: name || item.name, spec: specParts.join(' · ') };
}

function itemDisplayName(item: CartItem) {
	return legacyNameParts(item).name;
}

function itemSpecText(item: CartItem) {
	return item.spec || legacyNameParts(item).spec;
}

function itemCompositionText(item: CartItem) {
	if (!item.composition?.length) return '';
	return cartItemSummaryText(item);
}

function goAddress() {
	uni.navigateTo({ url: '/pages/profile/address?select=1&returnTo=checkout' });
}

function goCart() {
	uni.switchTab({ url: '/pages/cart/cart' });
}

function goBack() {
	uni.navigateBack({ fail: () => goCart() });
}

function goOrderDetail() {
	if (!submittedOrder.value) return;
	uni.redirectTo({ url: `/pages/orders/detail?id=${encodeURIComponent(submittedOrder.value.id)}` });
}

function goGoods() {
	submittedOrder.value = null;
	uni.navigateTo({ url: '/pages/goods/search/search' });
}

function openCouponSheet() {
	couponSheetOpen.value = true;
}

function closeCouponSheet() {
	couponSheetOpen.value = false;
}

function isCouponSelected(coupon: CouponRecord) {
	return selectedCoupon.value?.id === coupon.id && !skipCoupon.value;
}

function chooseCoupon(coupon: CouponRecord) {
	if (!isCouponUsable(coupon)) {
		uni.showToast({ title: couponDisabledText(coupon), icon: 'none' });
		return;
	}
	selectedCouponId.value = coupon.id;
	skipCoupon.value = false;
	closeCouponSheet();
}

function chooseNoCoupon() {
	selectedCouponId.value = null;
	skipCoupon.value = true;
	closeCouponSheet();
}

function markCouponUsed(coupon: CouponRecord | null) {
	if (!coupon) return;
	saveCoupons(loadCoupons().map((item) => (item.id === coupon.id ? { ...item, status: 'used' } : item)));
}

function submitOrder() {
	if (!items.value.length) {
		uni.showToast({ title: '没有待结算商品', icon: 'none' });
		return;
	}
	const address = selectedAddress.value;
	if (!address) {
		uni.showToast({ title: '请选择收货地址', icon: 'none' });
		return;
	}
	uni.showModal({
		title: '确认提交订单',
		content: `${address.name} ${address.phone}\n${address.region} ${address.detail}\n预估金额 ¥${formatAmount(payable.value)}\n服务端会按当前商品和材料价格重新核算，提交后由客服确认库存与制作信息。`,
		confirmText: '确认提交',
		confirmColor: '#D92733',
		cancelText: '再看看',
		success: (res) => {
			if (res.confirm) commitOrder();
		},
	});
}

async function commitOrder() {
	if (!items.value.length || !selectedAddress.value) return;
	if (submitting.value) return;
	submitting.value = true;
	const currentDraft = draft.value;
	let order: OrderRecord;
	try {
		if (usesRemoteCommerce) {
			order = await api.createOrder({
				addressId: selectedAddress.value.id,
				idempotencyKey: currentDraft?.id || `checkout-${Date.now()}-direct`,
				items: items.value,
				cartItemIds: currentDraft?.source === 'cart' ? currentDraft.selectedIds : [],
				note: note.value.trim(),
			});
			saveLocalOrders([order, ...loadExistingOrdersWithout(order.id)]);
		} else {
			order = createLocalOrder(items.value, {
				address: selectedAddress.value,
				discount: discount.value,
				freight: freight.value,
				couponCode: selectedCoupon.value?.code,
				note: note.value.trim(),
			});
		}
	} catch (error) {
		console.warn('[checkout] 下单失败', error);
		uni.showToast({ title: '订单提交失败，请检查网络后重试', icon: 'none' });
		submitting.value = false;
		return;
	}
	if (currentDraft?.source === 'cart') {
		removeLocalCartItems(currentDraft.selectedIds);
	}
	if (!usesRemoteCommerce) markCouponUsed(selectedCoupon.value);
	clearCheckoutDraft();
	couponSheetOpen.value = false;
	selectedCouponId.value = null;
	skipCoupon.value = false;
	submittedOrder.value = order;
	draft.value = null;
	note.value = '';
	submitting.value = false;
	uni.showToast({ title: '订单已生成', icon: 'success' });
}

function loadExistingOrdersWithout(orderId: string): OrderRecord[] {
	try {
		const raw = uni.getStorageSync('diy-bracelets-orders');
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(cached) ? cached.filter((order) => order?.id !== orderId) : [];
	} catch {
		return [];
	}
}
</script>

<template>
	<view class="page app-subpage checkout-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="checkout-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">提交订单</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view v-if="submittedOrder" class="success-page">
			<view class="success-card">
				<view class="success-check">
					<view class="success-check-mark" />
				</view>
				<view class="success-title">订单已生成</view>
				<view class="success-sub">我们会尽快核对晶石库存和尺寸信息</view>
				<view class="success-amount">¥ {{ formatAmount(submittedOrder.total) }}</view>
				<view class="success-no">订单编号 {{ successOrderNo }}</view>
			</view>

			<view class="success-section">
				<view class="success-section-title">下一步</view>
				<view class="success-progress">
					<view class="success-step active">
						<view class="success-dot" />
						<view>
							<view class="success-step-title">订单提交</view>
							<view class="success-step-sub">订单已经进入待确认</view>
						</view>
					</view>
					<view class="success-step">
						<view class="success-dot" />
						<view>
							<view class="success-step-title">核对制作</view>
							<view class="success-step-sub">客服确认库存、手围和备注</view>
						</view>
					</view>
					<view class="success-step">
						<view class="success-dot" />
						<view>
							<view class="success-step-title">发货通知</view>
							<view class="success-step-sub">发出后可在订单详情查看进度</view>
						</view>
					</view>
				</view>
			</view>

			<view class="success-section">
				<view class="success-section-title">订单摘要</view>
				<view v-if="successPrimaryItem" class="success-item">
					<image class="success-item-img" :src="resolveStaticUrl(successPrimaryItem.image)" mode="aspectFill" />
					<view class="success-item-body">
						<view class="success-item-name">{{ itemDisplayName(successPrimaryItem) }}</view>
						<view class="success-item-sub">
							共 {{ submittedOrder.itemCount }} 件 · 核算金额 ¥{{ formatAmount(submittedOrder.total) }}
						</view>
					</view>
				</view>
				<view v-if="submittedOrder.address" class="success-address">
					<view class="success-address-name">
						{{ submittedOrder.address.name }} {{ submittedOrder.address.phone }}
					</view>
					<view class="success-address-text">
						{{ submittedOrder.address.region }} {{ submittedOrder.address.detail }}
					</view>
				</view>
			</view>

			<view class="success-actions">
				<button class="success-btn ghost" @tap="goGoods">继续逛</button>
				<button class="success-btn" @tap="goOrderDetail">查看订单</button>
			</view>
		</view>

		<view v-else-if="!items.length" class="empty">
			<view class="empty-title">暂无结算商品</view>
			<view class="empty-sub">请先选择需要购买的手串或好物</view>
			<button class="empty-btn" @tap="goCart">返回购物车</button>
		</view>

		<template v-else>
			<view class="address-card" @tap="goAddress">
				<view class="address-icon">
					<view class="pin-dot" />
				</view>
				<view v-if="selectedAddress" class="address-body">
					<view class="address-top">
						<text class="address-name">{{ selectedAddress.name }}</text>
						<text class="address-phone">{{ selectedAddress.phone }}</text>
						<text v-if="selectedAddress.isDefault" class="address-badge">默认</text>
					</view>
					<view class="address-text">{{ selectedAddress.region }} {{ selectedAddress.detail }}</view>
				</view>
				<view v-else class="address-body">
					<view class="address-empty-title">暂无收货地址</view>
					<view class="address-empty-sub">立即添加收货地址</view>
				</view>
				<view class="address-arrow">›</view>
			</view>

			<view class="section product-section">
				<view v-for="item in items" :key="item.id" class="checkout-item">
					<image class="item-img" :src="resolveStaticUrl(item.image)" mode="aspectFill" />
					<view class="item-body">
						<view class="item-name">{{ itemDisplayName(item) }}</view>
						<view v-if="itemCompositionText(item)" class="item-summary">{{ itemCompositionText(item) }}</view>
						<view v-else-if="itemSpecText(item)" class="item-summary">规格：{{ itemSpecText(item) }}</view>
						<view class="item-unit-price">¥{{ formatAmount(item.price) }}</view>
					</view>
					<view class="item-price">
						<view class="item-qty">×{{ item.qty }}</view>
					</view>
				</view>
			</view>

			<view class="section">
				<view class="amount-row">
					<text>商品总金额</text>
					<text>{{ formatAmountFixed(itemTotal) }}</text>
				</view>
				<view class="amount-row">
					<view class="freight-label">
						<text>运费</text>
						<view class="freight-help" aria-hidden="true" />
					</view>
					<text class="muted">{{ selectedAddress ? `¥ ${formatAmount(freight)}` : '请选择地址' }}</text>
				</view>
				<view v-if="availableCoupons.length" class="amount-row coupon-row" @tap="openCouponSheet">
					<text>优惠券</text>
					<view class="coupon-row-value">
						<view class="coupon-row-copy">
							<text class="coupon-row-main" :class="{ red: selectedCoupon, muted: !selectedCoupon }">{{ couponRowText }}</text>
							<text v-if="couponRowSubText" class="coupon-row-sub">{{ couponRowSubText }}</text>
						</view>
						<text class="coupon-arrow">›</text>
					</view>
				</view>
			</view>

			<view class="section note-section">
				<view class="note-head">
					<text>备注</text>
					<text class="note-count">{{ noteCount }}/45</text>
				</view>
				<input v-model="note" class="note-input" maxlength="45" placeholder="选填，给商家留言，如需加急,请备注“加急”二字" />
			</view>

			<view class="footer">
				<view class="footer-total">
					<text>实付：</text>
					<text class="footer-price">￥{{ formatAmount(payable) }}</text>
				</view>
				<button class="submit-btn" :disabled="submitting" @tap="submitOrder">
					{{ submitting ? '正在提交…' : '提交订单' }}
				</button>
			</view>
		</template>

		<view v-if="couponSheetOpen" class="coupon-mask" @tap="closeCouponSheet">
			<view class="coupon-sheet" @tap.stop>
				<view class="coupon-sheet-grip" />
				<view class="coupon-sheet-head">
					<view>
						<view class="coupon-sheet-title">选择优惠券</view>
						<view class="coupon-sheet-sub">{{ couponSheetSubText }}</view>
					</view>
					<view class="coupon-close" @tap="closeCouponSheet">×</view>
				</view>

				<view class="coupon-none" :class="{ active: skipCoupon }" @tap="chooseNoCoupon">
					<view>
						<view class="coupon-none-title">不使用优惠</view>
						<view class="coupon-none-sub">保留优惠券，按原价提交订单</view>
					</view>
					<view class="coupon-check" :class="{ active: skipCoupon }" />
				</view>

				<scroll-view class="coupon-list-sheet" scroll-y>
					<view
						v-for="coupon in availableCoupons"
						:key="coupon.id"
						class="coupon-ticket"
						:class="{ active: isCouponSelected(coupon), disabled: !isCouponUsable(coupon) }"
						@tap="chooseCoupon(coupon)"
					>
						<view class="coupon-ticket-value">
							<view class="coupon-money">
								<text class="coupon-money-symbol">¥</text>
								<text>{{ formatAmount(coupon.amount) }}</text>
							</view>
							<view class="coupon-condition">{{ couponThresholdText(coupon) }}</view>
						</view>
						<view class="coupon-ticket-body">
							<view class="coupon-ticket-title">{{ coupon.title }}</view>
							<view class="coupon-ticket-date">{{ couponExpireText(coupon) }}</view>
							<view v-if="!isCouponUsable(coupon)" class="coupon-ticket-tip">{{ couponDisabledText(coupon) }}</view>
						</view>
						<view class="coupon-ticket-status" :class="{ selected: isCouponSelected(coupon) }">
							{{ isCouponSelected(coupon) ? '已选' : isCouponUsable(coupon) ? '选择' : '不可用' }}
						</view>
					</view>

					<view v-if="!availableCoupons.length" class="coupon-empty">暂无未使用优惠券</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f5f5f8;
	padding: calc(134rpx + env(safe-area-inset-top)) 0 150rpx;
	box-sizing: border-box;
}

.checkout-nav {
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
:global(uni-page-body:has(> .checkout-page)) {
	height: 100%;
	padding-bottom: 0 !important;
}

:global(uni-app:has(.checkout-page) uni-tabbar),
:global(uni-app:has(.checkout-page) .uni-tabbar-bottom) {
	display: none !important;
}

.checkout-page {
	min-height: 100%;
}
/* #endif */

.success-page {
	min-height: 100vh;
	padding: 24rpx 24rpx 156rpx;
	box-sizing: border-box;
}

.success-card {
	position: relative;
	border-radius: 18rpx;
	background: #d92733;
	color: #fff;
	padding: 44rpx 34rpx 36rpx;
	text-align: center;
	box-shadow: 0 14rpx 30rpx rgba(217, 39, 51, 0.18);
	box-sizing: border-box;
	overflow: hidden;
}

.success-card::after {
	content: '';
	position: absolute;
	right: -86rpx;
	top: -110rpx;
	width: 260rpx;
	height: 260rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.12);
}

.success-check {
	position: relative;
	z-index: 1;
	width: 78rpx;
	height: 78rpx;
	margin: 0 auto 22rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.18);
	display: flex;
	align-items: center;
	justify-content: center;
}

.success-check-mark {
	width: 34rpx;
	height: 18rpx;
	border-left: 7rpx solid #fff;
	border-bottom: 7rpx solid #fff;
	transform: rotate(-45deg) translate(2rpx, -2rpx);
	box-sizing: border-box;
}

.success-title {
	position: relative;
	z-index: 1;
	font-size: 40rpx;
	font-weight: 900;
	line-height: 1.2;
}

.success-sub {
	position: relative;
	z-index: 1;
	margin-top: 14rpx;
	font-size: 25rpx;
	font-weight: 800;
	opacity: 0.9;
	line-height: 1.35;
}

.success-amount {
	position: relative;
	z-index: 1;
	margin-top: 28rpx;
	font-size: 44rpx;
	font-weight: 900;
	line-height: 1;
}

.success-no {
	position: relative;
	z-index: 1;
	display: inline-flex;
	margin-top: 24rpx;
	padding: 9rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.16);
	font-size: 22rpx;
	font-weight: 900;
}

.success-section {
	margin-top: 20rpx;
	padding: 26rpx 28rpx;
	border-radius: 14rpx;
	background: #fff;
	box-sizing: border-box;
}

.success-section-title {
	color: #202229;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.2;
}

.success-progress {
	margin-top: 24rpx;
}

.success-step {
	position: relative;
	display: flex;
	gap: 18rpx;
	padding-bottom: 26rpx;
}

.success-step:last-child {
	padding-bottom: 0;
}

.success-step::after {
	content: '';
	position: absolute;
	left: 8rpx;
	top: 24rpx;
	bottom: -2rpx;
	width: 3rpx;
	border-radius: 999rpx;
	background: #eeeeef;
}

.success-step:last-child::after {
	display: none;
}

.success-dot {
	position: relative;
	z-index: 1;
	width: 18rpx;
	height: 18rpx;
	margin-top: 4rpx;
	border-radius: 50%;
	background: #d7d8de;
	box-shadow: 0 0 0 8rpx #f6f6f8;
	flex-shrink: 0;
}

.success-step.active .success-dot {
	background: #d92733;
	box-shadow: 0 0 0 8rpx #fff0f1;
}

.success-step-title {
	color: #202229;
	font-size: 27rpx;
	font-weight: 900;
	line-height: 1.2;
}

.success-step.active .success-step-title {
	color: #d92733;
}

.success-step-sub {
	margin-top: 10rpx;
	color: #8b8e97;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.4;
}

.success-item {
	display: flex;
	align-items: center;
	gap: 18rpx;
	margin-top: 22rpx;
	padding: 18rpx;
	border-radius: 12rpx;
	background: #fafafa;
}

.success-item-img {
	width: 108rpx;
	height: 108rpx;
	border-radius: 10rpx;
	background: #f0f0f0;
	flex-shrink: 0;
}

.success-item-body {
	flex: 1;
	min-width: 0;
}

.success-item-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #202229;
	font-size: 28rpx;
	font-weight: 900;
}

.success-item-sub {
	margin-top: 12rpx;
	color: #858891;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.35;
}

.success-address {
	margin-top: 18rpx;
	padding-top: 18rpx;
	border-top: 1rpx solid #f0f0f2;
}

.success-address-name {
	color: #202229;
	font-size: 26rpx;
	font-weight: 900;
}

.success-address-text {
	margin-top: 10rpx;
	color: #6d7079;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.45;
}

.success-actions {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	gap: 18rpx;
	padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
	background: #fff;
	box-shadow: 0 -4rpx 18rpx rgba(31, 35, 48, 0.05);
	box-sizing: border-box;
	z-index: 5;
}

.success-btn {
	flex: 1;
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 29rpx;
	font-weight: 900;
}

.success-btn.ghost {
	background: #fff;
	color: #d92733;
	border: 1rpx solid #f0c3c6;
}

.section {
	margin: 20rpx 30rpx 0;
	border-radius: 8rpx;
	background: #fff;
	box-shadow: none;
	box-sizing: border-box;
}

.address-card {
	position: relative;
	display: flex;
	align-items: center;
	gap: 18rpx;
	min-height: 156rpx;
	padding: 28rpx 28rpx 34rpx;
	background: #fff;
	box-sizing: border-box;
	overflow: hidden;
}

.address-card::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 6rpx;
	background: repeating-linear-gradient(
		135deg,
		#df5a61 0,
		#df5a61 18rpx,
		#fff 22rpx,
		#fff 31rpx,
		#7eaeea 31rpx,
		#7eaeea 49rpx,
		#fff 56rpx,
		#fff 66rpx
	);
}

.address-icon {
	position: relative;
	width: 48rpx;
	height: 56rpx;
	flex-shrink: 0;
}

.address-icon::before {
	content: '';
	position: absolute;
	left: 7rpx;
	top: 2rpx;
	width: 34rpx;
	height: 34rpx;
	border: 4rpx solid #17191f;
	border-radius: 50%;
	box-sizing: border-box;
}

.address-icon::after {
	content: '';
	position: absolute;
	left: 20rpx;
	top: 33rpx;
	width: 10rpx;
	height: 20rpx;
	border-left: 4rpx solid #17191f;
	border-bottom: 4rpx solid #17191f;
	transform: rotate(-42deg);
	transform-origin: top left;
	box-sizing: border-box;
}

.pin-dot {
	position: absolute;
	left: 20rpx;
	top: 15rpx;
	width: 9rpx;
	height: 9rpx;
	border-radius: 50%;
	background: #17191f;
}

.address-body {
	flex: 1;
	min-width: 0;
}

.address-top {
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.address-name {
	color: #17191f;
	font-size: 30rpx;
	font-weight: 900;
}

.address-phone {
	color: #686c75;
	font-size: 25rpx;
	font-weight: 800;
}

.address-badge {
	height: 32rpx;
	line-height: 32rpx;
	padding: 0 10rpx;
	border-radius: 999rpx;
	background: #fff0f1;
	color: #d92733;
	font-size: 20rpx;
	font-weight: 900;
}

.address-text {
	margin-top: 12rpx;
	color: #555963;
	font-size: 25rpx;
	line-height: 1.45;
}

.address-empty-title {
	color: #17191f;
	font-size: 31rpx;
	font-weight: 900;
}

.address-empty-sub {
	margin-top: 8rpx;
	color: #a7a2a5;
	font-size: 25rpx;
	font-weight: 800;
}

.address-arrow {
	color: #a7a9af;
	font-size: 42rpx;
	line-height: 1;
}

.section {
	padding: 0 28rpx;
	box-sizing: border-box;
}

.product-section {
	padding-top: 28rpx;
	padding-bottom: 28rpx;
}

.checkout-item {
	display: flex;
	align-items: flex-start;
	gap: 22rpx;
	padding: 0;
	border-top: 0;
	background: #fff;
}

.checkout-item + .checkout-item {
	margin-top: 0;
}

.item-img {
	width: 176rpx;
	height: 176rpx;
	border-radius: 8rpx;
	background: #f0f0f0;
	flex-shrink: 0;
}

.item-body {
	flex: 1;
	min-width: 0;
}

.item-name {
	margin-top: 10rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	color: #202229;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.35;
}

.item-summary {
	margin-top: 12rpx;
	color: #858891;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.45;
}

.item-unit-price {
	margin-top: 22rpx;
	color: #df3440;
	font-size: 29rpx;
	font-weight: 900;
}

.item-price {
	width: 52rpx;
	color: #9b9da4;
	font-size: 25rpx;
	font-weight: 900;
	text-align: right;
	flex-shrink: 0;
	align-self: flex-end;
	padding-bottom: 8rpx;
}

.item-qty {
	color: #9b9da4;
	font-size: 26rpx;
}

.amount-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
	min-height: 84rpx;
	color: #24262d;
	font-size: 28rpx;
	font-weight: 900;
	border-bottom: 1rpx solid #f0f0f2;
}

.amount-row:last-child {
	border-bottom: 0;
}

.amount-row > text:last-child {
	color: #2b2d34;
	font-weight: 900;
}

.coupon-row {
	cursor: pointer;
}

.coupon-row-value {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12rpx;
	flex: 1;
	min-width: 0;
	text-align: right;
}

.coupon-row-copy {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 4rpx;
	min-width: 0;
}

.coupon-row-main {
	max-width: 410rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #2b2d34;
	font-size: 27rpx;
	font-weight: 900;
}

.coupon-row-sub {
	color: #a3a5ad;
	font-size: 22rpx;
	font-weight: 800;
	line-height: 1.2;
}

.coupon-arrow {
	color: #b7b9bf;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1;
}

.freight-label {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.freight-help {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	border: 2rpx solid #a7a9af;
	color: #a7a9af;
	font-size: 18rpx;
	font-weight: 900;
	line-height: 22rpx;
	text-align: center;
	box-sizing: border-box;
}

.freight-help::before {
	content: '?';
}

.muted {
	color: #aaa5a8 !important;
}

.red {
	color: #d92733 !important;
}

.coupon-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 30;
	background: rgba(22, 24, 31, 0.42);
	display: flex;
	align-items: flex-end;
}

.coupon-sheet {
	width: 100%;
	max-height: 76vh;
	padding: 14rpx 24rpx calc(28rpx + env(safe-area-inset-bottom));
	border-radius: 32rpx 32rpx 0 0;
	background: #f7f7fb;
	box-sizing: border-box;
	box-shadow: 0 -18rpx 44rpx rgba(25, 28, 38, 0.16);
}

.coupon-sheet-grip {
	width: 74rpx;
	height: 8rpx;
	margin: 0 auto 24rpx;
	border-radius: 999rpx;
	background: #d8d9de;
}

.coupon-sheet-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
	margin-bottom: 22rpx;
}

.coupon-sheet-title {
	color: #202229;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1.2;
}

.coupon-sheet-sub {
	margin-top: 8rpx;
	color: #9b9da4;
	font-size: 24rpx;
	font-weight: 800;
}

.coupon-close {
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	background: #fff;
	color: #7d8088;
	font-size: 38rpx;
	font-weight: 700;
	line-height: 54rpx;
	text-align: center;
	box-shadow: 0 8rpx 18rpx rgba(31, 35, 48, 0.06);
}

.coupon-none {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	min-height: 116rpx;
	margin-bottom: 18rpx;
	padding: 24rpx 24rpx;
	border: 2rpx solid transparent;
	border-radius: 18rpx;
	background: #fff;
	box-sizing: border-box;
}

.coupon-none.active {
	border-color: rgba(217, 39, 51, 0.42);
	background: #fff8f8;
}

.coupon-none-title {
	color: #252832;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1.25;
}

.coupon-none-sub {
	margin-top: 8rpx;
	color: #9da0a8;
	font-size: 23rpx;
	font-weight: 800;
}

.coupon-check {
	position: relative;
	width: 36rpx;
	height: 36rpx;
	border: 3rpx solid #d3d5da;
	border-radius: 50%;
	box-sizing: border-box;
	flex-shrink: 0;
}

.coupon-check.active {
	border-color: #d92733;
	background: #d92733;
}

.coupon-check.active::after {
	content: '';
	position: absolute;
	left: 9rpx;
	top: 6rpx;
	width: 12rpx;
	height: 7rpx;
	border-left: 4rpx solid #fff;
	border-bottom: 4rpx solid #fff;
	transform: rotate(-45deg);
}

.coupon-list-sheet {
	max-height: 46vh;
}

.coupon-ticket {
	position: relative;
	display: flex;
	align-items: stretch;
	gap: 22rpx;
	min-height: 150rpx;
	margin-bottom: 18rpx;
	padding: 0 20rpx 0 0;
	border: 2rpx solid transparent;
	border-radius: 18rpx;
	background: #fff;
	box-sizing: border-box;
	overflow: hidden;
}

.coupon-ticket::before,
.coupon-ticket::after {
	content: '';
	position: absolute;
	left: 168rpx;
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	background: #f7f7fb;
	z-index: 1;
}

.coupon-ticket::before {
	top: -12rpx;
}

.coupon-ticket::after {
	bottom: -12rpx;
}

.coupon-ticket.active {
	border-color: rgba(217, 39, 51, 0.48);
	box-shadow: 0 12rpx 26rpx rgba(217, 39, 51, 0.1);
}

.coupon-ticket.disabled {
	opacity: 0.54;
}

.coupon-ticket-value {
	width: 180rpx;
	padding: 28rpx 14rpx;
	background: linear-gradient(135deg, #f0444f 0%, #d92733 100%);
	color: #fff;
	text-align: center;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.coupon-ticket.disabled .coupon-ticket-value {
	background: #b9bbc2;
}

.coupon-money {
	display: flex;
	align-items: baseline;
	justify-content: center;
	gap: 3rpx;
	font-size: 42rpx;
	font-weight: 900;
	line-height: 1;
}

.coupon-money-symbol {
	font-size: 22rpx;
	font-weight: 900;
}

.coupon-condition {
	margin-top: 12rpx;
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1.2;
}

.coupon-ticket-body {
	flex: 1;
	min-width: 0;
	padding: 24rpx 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.coupon-ticket-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #262934;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.25;
}

.coupon-ticket-date,
.coupon-ticket-tip {
	margin-top: 10rpx;
	color: #9699a2;
	font-size: 22rpx;
	font-weight: 800;
	line-height: 1.2;
}

.coupon-ticket-tip {
	color: #d92733;
}

.coupon-ticket-status {
	align-self: center;
	min-width: 74rpx;
	height: 46rpx;
	line-height: 46rpx;
	border-radius: 999rpx;
	background: #f1f2f5;
	color: #7e828b;
	font-size: 22rpx;
	font-weight: 900;
	text-align: center;
}

.coupon-ticket-status.selected {
	background: #d92733;
	color: #fff;
}

.coupon-empty {
	height: 168rpx;
	line-height: 168rpx;
	text-align: center;
	color: #a5a7ae;
	font-size: 25rpx;
	font-weight: 800;
}

.note-section {
	padding-top: 28rpx;
	padding-bottom: 34rpx;
}

.note-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	color: #24262d;
	font-size: 28rpx;
	font-weight: 900;
}

.note-count {
	color: #a8a3a6;
	font-size: 24rpx;
}

.note-input {
	width: 100%;
	margin-top: 26rpx;
	color: #555963;
	font-size: 27rpx;
	font-weight: 800;
	text-align: left;
}

.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 126rpx;
	padding: 18rpx 22rpx calc(18rpx + env(safe-area-inset-bottom));
	background: #fff;
	box-shadow: 0 -4rpx 18rpx rgba(31, 35, 48, 0.05);
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
	box-sizing: border-box;
}

.footer-total {
	flex: 1;
	min-width: 0;
	color: #1f222a;
	font-size: 30rpx;
	font-weight: 900;
}

.footer-price {
	color: #dc2934;
	font-size: 34rpx;
	font-weight: 900;
}

.submit-btn {
	width: 302rpx;
	height: 92rpx;
	line-height: 92rpx;
	margin: 0;
	border-radius: 46rpx;
	background: #dc2934;
	color: #fff;
	font-size: 30rpx;
	font-weight: 900;
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
