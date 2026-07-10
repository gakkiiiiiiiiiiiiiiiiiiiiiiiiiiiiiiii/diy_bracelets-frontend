<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { openDesignStudio } from '@/utils/designNavigation';

type CouponStatus = 'unused' | 'used' | 'expired';

interface CouponRecord {
	id: string;
	code: string;
	title: string;
	desc: string;
	amount: number;
	threshold: number;
	status: CouponStatus;
	expireAt: string;
	createdAt: string;
}

interface CouponTemplate {
	title: string;
	desc: string;
	amount: number;
	threshold: number;
	days: number;
}

const COUPON_STORAGE_KEY = 'diy-bracelets-coupons';
const active = ref<CouponStatus>('unused');
const coupons = ref<CouponRecord[]>([]);
const redeemOpen = ref(false);
const redeemCode = ref('');
const tabs: Array<{ id: CouponStatus; label: string }> = [
	{ id: 'unused', label: '未使用' },
	{ id: 'used', label: '已使用' },
	{ id: 'expired', label: '已失效' },
];
const redeemTemplates: Record<string, CouponTemplate> = {
	YGS10: { title: '新人定制券', desc: '定制手串与好物通用', amount: 10, threshold: 99, days: 30 },
	STONE20: { title: '天然水晶券', desc: '适用于水晶散珠和设计款', amount: 20, threshold: 199, days: 30 },
	DIY30: { title: 'DIY设计券', desc: '完成手串设计后可抵扣', amount: 30, threshold: 299, days: 45 },
};

const visibleCoupons = computed(() => coupons.value.filter((coupon) => coupon.status === active.value));
const couponCounts = computed(() =>
	tabs.reduce(
		(acc, tab) => ({
			...acc,
			[tab.id]: coupons.value.filter((coupon) => coupon.status === tab.id).length,
		}),
		{} as Record<CouponStatus, number>,
	),
);
const redeemCodes = computed(() => Object.keys(redeemTemplates));
const emptyTitle = computed(() => {
	if (active.value === 'used') return '暂无已使用优惠券';
	if (active.value === 'expired') return '暂无已失效优惠券';
	return '暂无可用优惠券';
});

onShow(loadCoupons);

function loadCoupons() {
	try {
		const raw = uni.getStorageSync(COUPON_STORAGE_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		coupons.value = Array.isArray(cached) ? refreshExpiry(cached) : [];
		saveCoupons();
	} catch {
		coupons.value = [];
	}
}

function saveCoupons() {
	uni.setStorageSync(COUPON_STORAGE_KEY, JSON.stringify(coupons.value));
}

function refreshExpiry(list: CouponRecord[]) {
	const now = Date.now();
	return list.map((coupon) => {
		if (coupon.status !== 'unused') return coupon;
		return new Date(coupon.expireAt).getTime() < now ? { ...coupon, status: 'expired' as const } : coupon;
	});
}

function formatAmount(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}.${month}.${day}`;
}

function tabLabel(tab: { id: CouponStatus; label: string }) {
	const count = couponCounts.value[tab.id];
	return count ? `${tab.label} ${count}` : tab.label;
}

function redeemCoupon() {
	redeemCode.value = '';
	redeemOpen.value = true;
}

function closeRedeem() {
	redeemOpen.value = false;
}

function goBack() {
	if (redeemOpen.value) {
		closeRedeem();
		return;
	}
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
}

function onRedeemInput(e: { detail: { value: string } }) {
	redeemCode.value = e.detail.value || '';
}

function normalizeRedeemCode(value: string) {
	return String(value || '').trim().toUpperCase();
}

function extractRedeemCode(value: string) {
	const normalized = normalizeRedeemCode(value);
	if (!normalized) return '';
	const knownCode = redeemCodes.value.find((code) => normalized.includes(code));
	if (knownCode) return knownCode;
	if (typeof URL === 'undefined') return normalized.match(/[A-Z0-9]{3,24}/)?.[0] || '';
	try {
		const url = new URL(value);
		const fromQuery =
			url.searchParams.get('code') ||
			url.searchParams.get('coupon') ||
			url.searchParams.get('redeem');
		if (fromQuery) return normalizeRedeemCode(fromQuery).slice(0, 24);
	} catch {}
	return normalized.match(/[A-Z0-9]{3,24}/)?.[0] || '';
}

function applyRedeemCodeFromText(value: string, emptyMessage = '未识别到口令') {
	const code = extractRedeemCode(value);
	if (!code) {
		uni.showToast({ title: emptyMessage, icon: 'none' });
		return;
	}
	redeemCode.value = code;
	uni.showToast({ title: '已填入口令', icon: 'none' });
}

function scanRedeemCode() {
	// #ifdef MP-WEIXIN
	uni.scanCode({
		onlyFromCamera: false,
		scanType: ['qrCode', 'barCode'],
		success: (res) => applyRedeemCodeFromText(res.result || ''),
		fail: () => {
			uni.showToast({ title: '未识别到口令', icon: 'none' });
		},
	});
	// #endif
	// #ifndef MP-WEIXIN
	uni.getClipboardData({
		success: (res) => applyRedeemCodeFromText(res.data || '', '剪贴板暂无口令'),
		fail: () => {
			uni.showToast({ title: '无法读取剪贴板', icon: 'none' });
		},
	});
	// #endif
}

function confirmRedeem() {
	const raw = normalizeRedeemCode(redeemCode.value);
	if (!raw) {
		uni.showToast({ title: '请输入口令', icon: 'none' });
		return;
	}
	const template = redeemTemplates[raw];
	if (!template) {
		uni.showToast({ title: '暂无匹配优惠券', icon: 'none' });
		return;
	}
	if (coupons.value.some((coupon) => coupon.code === raw)) {
		uni.showToast({ title: '该口令已兑换', icon: 'none' });
		return;
	}
	const now = new Date();
	const expireAt = new Date(now.getTime() + template.days * 24 * 60 * 60 * 1000);
	coupons.value = [
		{
			id: `coupon-${raw}-${Date.now()}`,
			code: raw,
			title: template.title,
			desc: template.desc,
			amount: template.amount,
			threshold: template.threshold,
			status: 'unused',
			expireAt: expireAt.toISOString(),
			createdAt: now.toISOString(),
		},
		...coupons.value,
	];
	active.value = 'unused';
	saveCoupons();
	closeRedeem();
	uni.showToast({ title: '兑换成功', icon: 'success' });
}

function useCoupon(coupon: CouponRecord) {
	if (coupon.status !== 'unused') return;
	uni.showActionSheet({
		itemList: ['去设计手串', '去找好物'],
		success: (res) => {
			if (res.tapIndex === 0) openDesignStudio('bracelet');
			if (res.tapIndex === 1) uni.switchTab({ url: '/pages/goods/goods' });
		},
	});
}
</script>

<template>
	<view class="page app-subpage coupons-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="coupons-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">优惠券与口令兑换</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view class="tabs">
			<view
				v-for="tab in tabs"
				:key="tab.id"
				class="tab"
				:class="{ active: active === tab.id }"
				@tap="active = tab.id"
			>
				<text>{{ tabLabel(tab) }}</text>
			</view>
		</view>

		<view class="notice">
			<view class="notice-icon">
				<view class="notice-speaker" />
				<view class="notice-wave notice-wave--top" />
				<view class="notice-wave notice-wave--bottom" />
			</view>
			<view class="notice-text">在下单时会自动为您选择最优优惠券。</view>
		</view>

		<view v-if="visibleCoupons.length" class="coupon-list">
			<view
				v-for="coupon in visibleCoupons"
				:key="coupon.id"
				class="coupon-card"
				:class="`coupon-card--${coupon.status}`"
			>
				<view class="coupon-value">
					<view class="amount">
						<text class="amount-symbol">¥</text>
						<text>{{ formatAmount(coupon.amount) }}</text>
					</view>
					<view class="condition">满 {{ coupon.threshold }} 可用</view>
				</view>
				<view class="coupon-body">
					<view class="coupon-title">{{ coupon.title }}</view>
					<view class="coupon-desc">{{ coupon.desc }}</view>
					<view class="coupon-code">口令 {{ coupon.code }}</view>
					<view class="coupon-date">有效期至 {{ formatDate(coupon.expireAt) }}</view>
				</view>
				<button class="coupon-action" :disabled="coupon.status !== 'unused'" @tap="useCoupon(coupon)">
					{{ coupon.status === 'unused' ? '去使用' : coupon.status === 'used' ? '已使用' : '已失效' }}
				</button>
			</view>
		</view>

		<view v-else class="empty">
			<view class="empty-coupon-art">
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
		</view>

		<view class="redeem-wrap">
			<button class="redeem-btn" @tap="redeemCoupon">
				<view class="redeem-icon">
					<view class="ticket-notch ticket-notch--left" />
					<view class="ticket-notch ticket-notch--right" />
					<view class="ticket-mark ticket-mark--left" />
					<view class="ticket-mark ticket-mark--right" />
				</view>
				<text>口令兑换优惠券</text>
			</button>
		</view>

		<view v-if="redeemOpen" class="modal-mask" @tap="closeRedeem">
			<view class="redeem-modal" @tap.stop>
				<view class="modal-title">口令兑换优惠券</view>
				<view class="modal-row">
					<text class="modal-label">口令</text>
					<input
						class="modal-input"
						:value="redeemCode"
						maxlength="24"
						placeholder="请输入口令"
						confirm-type="done"
						@input="onRedeemInput"
						@confirm="confirmRedeem"
					/>
					<view class="scan-icon" @tap.stop="scanRedeemCode">
						<view class="scan-corner scan-corner-a" />
						<view class="scan-corner scan-corner-b" />
						<view class="scan-corner scan-corner-c" />
						<view class="scan-corner scan-corner-d" />
					</view>
				</view>
				<button class="modal-confirm" @tap="confirmRedeem">确认</button>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f7f7fb;
	padding: calc(118rpx + env(safe-area-inset-top)) 30rpx 158rpx;
	box-sizing: border-box;
}

.coupons-nav {
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
	max-width: 360rpx;
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
	height: 92rpx;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	align-items: center;
	background: #fff;
	margin: 0 -30rpx;
	border-bottom: 1rpx solid #eeeeef;
}

.tab {
	position: relative;
	height: 92rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	font-size: 29rpx;
	font-weight: 900;
	color: #9b9da6;
}

.tab.active {
	color: #d92733;
}

.tab.active::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: 0;
	width: 58rpx;
	height: 5rpx;
	border-radius: 999rpx;
	background: #d92733;
	transform: translateX(-50%);
}

.notice {
	height: 78rpx;
	margin: 18rpx 0 0;
	padding: 0 24rpx;
	border-radius: 8rpx;
	background: #fff;
	display: flex;
	align-items: center;
	gap: 14rpx;
	box-sizing: border-box;
}

.notice-icon {
	position: relative;
	flex-shrink: 0;
	width: 34rpx;
	height: 34rpx;
}

.notice-speaker {
	position: absolute;
	left: 4rpx;
	top: 12rpx;
	width: 13rpx;
	height: 10rpx;
	border-radius: 3rpx 0 0 3rpx;
	background: #2a2d34;
}

.notice-speaker::after {
	content: '';
	position: absolute;
	right: -11rpx;
	top: -5rpx;
	width: 0;
	height: 0;
	border-top: 10rpx solid transparent;
	border-bottom: 10rpx solid transparent;
	border-left: 13rpx solid #2a2d34;
}

.notice-wave {
	position: absolute;
	right: 0;
	width: 9rpx;
	height: 9rpx;
	border-right: 3rpx solid #2a2d34;
	border-radius: 50%;
}

.notice-wave--top {
	top: 7rpx;
	transform: rotate(-24deg);
}

.notice-wave--bottom {
	bottom: 7rpx;
	transform: rotate(24deg);
}

.notice-text {
	color: #555963;
	font-size: 24rpx;
	font-weight: 800;
}

.coupon-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
	padding: 24rpx 0 0;
}

.coupon-card {
	position: relative;
	min-height: 168rpx;
	display: flex;
	align-items: stretch;
	border-radius: 14rpx;
	background: #fff8f8;
	border: 1rpx solid #f4d7da;
	box-shadow: 0 10rpx 22rpx rgba(217, 39, 51, 0.06);
	overflow: hidden;
}

.coupon-card::before,
.coupon-card::after {
	content: '';
	position: absolute;
	left: 174rpx;
	width: 30rpx;
	height: 30rpx;
	border-radius: 50%;
	background: #fff;
	z-index: 2;
}

.coupon-card::before {
	top: -15rpx;
}

.coupon-card::after {
	bottom: -15rpx;
}

.coupon-card--used,
.coupon-card--expired {
	filter: grayscale(0.85);
	opacity: 0.72;
}

.coupon-value {
	width: 190rpx;
	padding: 28rpx 12rpx 22rpx;
	background: #d92733;
	color: #fff;
	text-align: center;
	box-sizing: border-box;
	flex-shrink: 0;
}

.amount {
	display: flex;
	align-items: baseline;
	justify-content: center;
	font-size: 54rpx;
	font-weight: 900;
	line-height: 1;
}

.amount-symbol {
	margin-right: 4rpx;
	font-size: 25rpx;
}

.condition {
	margin-top: 16rpx;
	font-size: 22rpx;
	font-weight: 800;
	opacity: 0.92;
}

.coupon-body {
	flex: 1;
	min-width: 0;
	padding: 26rpx 20rpx;
	box-sizing: border-box;
}

.coupon-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #202229;
	font-size: 28rpx;
	font-weight: 900;
}

.coupon-desc,
.coupon-code,
.coupon-date {
	margin-top: 12rpx;
	color: #7d8088;
	font-size: 22rpx;
	font-weight: 700;
}

.coupon-code {
	display: inline-flex;
	align-items: center;
	max-width: 100%;
	height: 34rpx;
	padding: 0 12rpx;
	border-radius: 999rpx;
	background: rgba(217, 39, 51, 0.08);
	color: #d92733;
	font-size: 20rpx;
	font-weight: 900;
	box-sizing: border-box;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.coupon-date {
	color: #a0a3aa;
}

.coupon-action {
	align-self: center;
	flex-shrink: 0;
	width: 104rpx;
	height: 52rpx;
	line-height: 52rpx;
	margin: 0 18rpx 0 0;
	padding: 0;
	border-radius: 999rpx;
	background: #fff;
	color: #d92733;
	border: 1rpx solid #f0c3c6;
	font-size: 22rpx;
	font-weight: 900;
}

.coupon-action[disabled] {
	color: #a2a4aa;
	border-color: #e4e4e6;
	background: #f8f8f8;
}

.empty {
	padding-top: 294rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.empty-coupon-art {
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

.empty-title {
	margin-top: 70rpx;
	color: #aaa3a2;
	font-size: 28rpx;
	font-weight: 800;
}

.redeem-wrap {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 22rpx 98rpx calc(22rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(247, 247, 251, 0) 0%, #f7f7fb 34%, #f7f7fb 100%);
	z-index: 20;
}

.redeem-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
	border-radius: 999rpx;
	background: #fff;
	color: #d92733;
	font-size: 28rpx;
	font-weight: 900;
	box-shadow: 0 10rpx 28rpx rgba(37, 39, 48, 0.07);
}

.redeem-btn::after,
.coupon-action::after,
.modal-confirm::after {
	border: 0;
}

.redeem-icon {
	position: relative;
	width: 32rpx;
	height: 24rpx;
	border: 4rpx solid #d92733;
	border-radius: 5rpx;
	box-sizing: border-box;
}

.ticket-notch {
	position: absolute;
	top: 50%;
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #fff;
	transform: translateY(-50%);
}

.ticket-notch--left {
	left: -6rpx;
}

.ticket-notch--right {
	right: -6rpx;
}

.ticket-mark {
	position: absolute;
	top: 50%;
	width: 12rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: #d92733;
	transform: translateY(-50%) rotate(-45deg);
}

.ticket-mark--left {
	left: 3rpx;
}

.ticket-mark--right {
	right: 3rpx;
	transform: translateY(-50%) rotate(45deg);
}

.modal-mask {
	position: fixed;
	inset: 0;
	z-index: 50;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 28rpx;
	background: rgba(0, 0, 0, 0.56);
	box-sizing: border-box;
}

.redeem-modal {
	width: 100%;
	max-width: 650rpx;
	padding: 44rpx 48rpx 46rpx;
	border-radius: 18rpx;
	background: #fff;
	box-sizing: border-box;
}

.modal-title {
	color: #111318;
	font-size: 33rpx;
	font-weight: 900;
	text-align: center;
}

.modal-row {
	display: flex;
	align-items: center;
	gap: 18rpx;
	margin-top: 34rpx;
	min-height: 58rpx;
}

.modal-label {
	flex-shrink: 0;
	color: #1d2028;
	font-size: 29rpx;
	font-weight: 900;
}

.modal-input {
	flex: 1;
	min-width: 0;
	height: 58rpx;
	color: #20232b;
	font-size: 27rpx;
}

.scan-icon {
	position: relative;
	flex-shrink: 0;
	width: 50rpx;
	height: 50rpx;
}

.scan-corner {
	position: absolute;
	width: 16rpx;
	height: 16rpx;
	border-color: #e5a5aa;
}

.scan-corner-a {
	left: 0;
	top: 0;
	border-left: 4rpx solid #e5a5aa;
	border-top: 4rpx solid #e5a5aa;
}

.scan-corner-b {
	right: 0;
	top: 0;
	border-right: 4rpx solid #e5a5aa;
	border-top: 4rpx solid #e5a5aa;
}

.scan-corner-c {
	left: 0;
	bottom: 0;
	border-left: 4rpx solid #e5a5aa;
	border-bottom: 4rpx solid #e5a5aa;
}

.scan-corner-d {
	right: 0;
	bottom: 0;
	border-right: 4rpx solid #e5a5aa;
	border-bottom: 4rpx solid #e5a5aa;
}

.modal-confirm {
	width: 310rpx;
	height: 74rpx;
	line-height: 74rpx;
	margin: 34rpx auto 0;
	padding: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 28rpx;
	font-weight: 900;
}
</style>
