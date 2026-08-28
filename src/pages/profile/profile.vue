<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api, type ProfileData, type ProfileEntry } from '@/api';
import { mockProfileData } from '@/data/mock';
import { loadProfileDetails } from '@/utils/profileDetails';
import { useSavedDesignsStore } from '@/stores/savedDesigns';
import { loadCheckoutAddresses, usesRemoteCommerce } from '@/utils/checkout';
import { loadLocalOrders } from '@/utils/orders';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';

const data = ref<ProfileData>(mockProfileData);
const savedDesignsStore = useSavedDesignsStore();
const COUPON_STORAGE_KEY = 'diy-bracelets-coupons';
const QR_SIZE = 29;
const QR_FINDER_SIZE = 7;

const stats = ref({
	designs: 0,
	orders: 0,
	coupons: 0,
	addresses: 0,
});
const supportQrOpen = ref(false);

const designEntry = computed(() => data.value.entries.find((item) => item.id === 'design'));
const visibleEntries = computed(() => data.value.entries.filter((item) =>
	item.id !== 'design' && (!usesRemoteCommerce || item.id !== 'coupon'),
));
const qrCells = computed(() =>
	Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => {
		const row = Math.floor(index / QR_SIZE);
		const col = index % QR_SIZE;
		return {
			id: `${row}-${col}`,
			dark: qrCellDark(row, col),
		};
	}),
);

onMounted(async () => {
	try {
		const res = await api.getProfile();
		if (res) data.value = res as ProfileData;
	} catch (_e) {
		data.value = mockProfileData;
	}
	applySavedProfile();
	ensureEntryPaths();
	await refreshLocalSummary();
});

onShow(() => {
	applySavedProfile();
	ensureEntryPaths();
	refreshLocalSummary();
});

function applySavedProfile() {
	const profile = loadProfileDetails();
	data.value = {
		...data.value,
		name: profile.name,
	};
}

function ensureEntryPaths() {
	const paths: Record<string, string> = {
		design: '/pages/designs/list',
		coupon: '/pages/profile/coupons',
		orders: '/pages/orders/list',
		address: '/pages/profile/address',
		help: '/pages/profile/help',
		terms: '/pages/profile/terms',
	};
	const defaults: ProfileEntry[] = [
		{ id: 'design', label: '我的设计', sub: '查看已保存的设计记录', icon: 'D' },
		{ id: 'coupon', label: '优惠券与口令兑换', sub: '我的优惠券，口令兑换优惠券', icon: '¥' },
		{ id: 'orders', label: '我的订单', sub: '定制记录，购买记录', icon: 'C' },
		{ id: 'address', label: '收货地址', sub: '完善地址，方便下单', icon: 'L' },
		{ id: 'help', label: '帮助中心', sub: '有什么问题请联系客服处理', icon: 'S' },
		{ id: 'terms', label: '条款和条件', sub: '我们的服务', icon: 'T' },
	];
	const currentById = new Map(data.value.entries.map((entry) => [entry.id, entry]));
	data.value.entries = defaults.map((entry) => {
		const current = currentById.get(entry.id);
		return {
			...entry,
			...current,
			path: current?.path ?? paths[entry.id],
		};
	});
}

function loadUsableCouponCount() {
	try {
		const raw = uni.getStorageSync(COUPON_STORAGE_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (!Array.isArray(cached)) return 0;
		const now = Date.now();
		return cached.filter((coupon) => {
			if (coupon?.status !== 'unused') return false;
			return new Date(coupon.expireAt).getTime() >= now;
		}).length;
	} catch {
		return 0;
	}
}

async function refreshLocalSummary() {
	if (!savedDesignsStore.loaded) {
		await savedDesignsStore.fetchList();
	}
	const orders = loadLocalOrders();
	stats.value = {
		designs: savedDesignsStore.list.length,
		orders: orders.length,
		coupons: usesRemoteCommerce ? 0 : loadUsableCouponCount(),
		addresses: loadCheckoutAddresses().length,
	};
}

function entryBadge(entryId: string) {
	if (entryId === 'orders' && stats.value.orders) return String(stats.value.orders);
	if (entryId === 'coupon' && stats.value.coupons) return String(stats.value.coupons);
	if (entryId === 'address' && stats.value.addresses) return String(stats.value.addresses);
	return '';
}

function designSubText() {
	return '查看已保存的设计记录';
}

function go(entry: ProfileEntry) {
	if (entry.id === 'help') {
		openSupportQr();
		return;
	}
	if (entry.path) {
		uni.navigateTo({ url: entry.path });
	}
}

function editProfile() {
	uni.navigateTo({ url: '/pages/profile/details' });
}

function openSupportQr() {
	supportQrOpen.value = true;
}

function closeSupportQr() {
	supportQrOpen.value = false;
}

function finderModule(row: number, col: number, originRow: number, originCol: number) {
	const localRow = row - originRow;
	const localCol = col - originCol;
	if (localRow < 0 || localCol < 0 || localRow >= QR_FINDER_SIZE || localCol >= QR_FINDER_SIZE) {
		return null;
	}
	const edge = localRow === 0 || localRow === QR_FINDER_SIZE - 1 || localCol === 0 || localCol === QR_FINDER_SIZE - 1;
	const core = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
	return edge || core;
}

function qrCellDark(row: number, col: number) {
	const finder =
		finderModule(row, col, 0, 0) ??
		finderModule(row, col, 0, QR_SIZE - QR_FINDER_SIZE) ??
		finderModule(row, col, QR_SIZE - QR_FINDER_SIZE, 0);
	if (finder !== null) return finder;
	if (row >= 11 && row <= 17 && col >= 11 && col <= 17) return false;
	if (row === 6 || col === 6) return (row + col) % 2 === 0;
	const mixed = ((row + 1) * 73856093) ^ ((col + 3) * 19349663) ^ ((row + col + 7) * 83492791);
	const hashed = (mixed ^ (mixed >>> 13)) * 1274126177;
	return (hashed >>> 0) % 100 < 42;
}
</script>

<template>
	<view class="page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="header">
			<view class="header-copy">
				<view class="name">{{ data.name }}</view>
				<view class="greeting">{{ data.greeting }}</view>
			</view>
			<view class="edit-btn" @tap="editProfile">
				<view class="edit-pencil" />
			</view>
		</view>

		<view v-if="designEntry" class="design-card" @tap="go(designEntry)">
			<view>
				<view class="design-title">{{ designEntry.label }}</view>
				<view class="design-sub">{{ designSubText() }}</view>
			</view>
			<view class="design-arrow">›</view>
		</view>

		<view class="entry-panel">
			<view
				v-for="entry in visibleEntries"
				:key="entry.id"
				class="entry"
				@tap="go(entry)"
			>
				<view class="entry-icon" :class="`entry-icon--${entry.id}`">{{ entry.icon }}</view>
				<view class="entry-body">
					<view class="entry-label-row">
						<view class="entry-label">{{ entry.label }}</view>
						<view v-if="entryBadge(entry.id)" class="entry-badge">{{ entryBadge(entry.id) }}</view>
					</view>
					<view class="entry-sub">{{ entry.sub }}</view>
				</view>
				<view class="entry-arrow">›</view>
			</view>
		</view>

		<view v-if="supportQrOpen" class="support-qr-mask" @tap="closeSupportQr">
			<view class="support-qr-title">长按识别</view>
			<view class="support-qr-card" @tap.stop>
				<view class="support-qr-grid" aria-hidden="true">
					<view
						v-for="cell in qrCells"
						:key="cell.id"
						class="support-qr-cell"
						:class="{ dark: cell.dark }"
					/>
				</view>
				<view class="support-qr-logo">
					<view class="support-logo-stone">
						<view class="support-logo-eye eye-left" />
						<view class="support-logo-eye eye-right" />
						<view class="support-logo-crystal" />
					</view>
				</view>
			</view>
			<view class="support-qr-close" @tap.stop="closeSupportQr">×</view>
		</view>

	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(138rpx + env(safe-area-inset-top)) 44rpx 128rpx;
	box-sizing: border-box;
}

.header {
	position: relative;
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 32rpx 0 0;
}

.header-copy {
	flex: 1;
	min-width: 0;
}

.name {
	max-width: 560rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 43rpx;
	font-weight: 900;
	color: #08090c;
	line-height: 1.2;
}

.greeting {
	margin-top: 28rpx;
	font-size: 31rpx;
	font-weight: 800;
	color: #111216;
	line-height: 1.25;
}

.edit-btn {
	position: relative;
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.edit-pencil {
	position: relative;
	width: 28rpx;
	height: 28rpx;
	border: 5rpx solid #777b82;
	border-radius: 4rpx;
	box-sizing: border-box;
}

.edit-pencil::before {
	content: '';
	position: absolute;
	right: -10rpx;
	top: -10rpx;
	width: 22rpx;
	height: 7rpx;
	border-radius: 999rpx;
	background: #777b82;
	transform: rotate(-45deg);
	transform-origin: center;
}

.design-card {
	min-height: 134rpx;
	margin-top: 74rpx;
	padding: 28rpx 30rpx;
	border-radius: 14rpx;
	background: #dd2b32;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.design-title {
	font-size: 33rpx;
	font-weight: 900;
	line-height: 1.2;
}

.design-sub {
	margin-top: 24rpx;
	color: rgba(255, 255, 255, 0.94);
	font-size: 25rpx;
	font-weight: 800;
	line-height: 1.2;
}

.design-arrow {
	padding-left: 20rpx;
	font-size: 56rpx;
	font-weight: 800;
	line-height: 1;
}

.entry-panel {
	margin-top: 24rpx;
	background: #f8f8fa;
	padding: 30rpx 0;
	overflow: hidden;
}

.entry {
	min-height: 132rpx;
	display: flex;
	align-items: center;
	gap: 28rpx;
	padding: 16rpx 46rpx;
	box-sizing: border-box;
}

.entry + .entry {
	border-top: 0;
}

.entry:active,
.design-card:active,
.edit-btn:active {
	opacity: 0.72;
}

.entry-icon {
	position: relative;
	width: 44rpx;
	height: 44rpx;
	border-radius: 8rpx;
	background: #ff805f;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	font-weight: 900;
	flex-shrink: 0;
}

.entry-icon--orders,
.entry-icon--address {
	font-size: 0;
	background: transparent;
}

.entry-icon--orders::before {
	content: '';
	position: absolute;
	left: 3rpx;
	top: 7rpx;
	width: 32rpx;
	height: 24rpx;
	border: 6rpx solid #ff805f;
	border-top: 0;
	border-radius: 0 0 6rpx 6rpx;
	transform: skewX(-8deg);
}

.entry-icon--orders::after {
	content: '';
	position: absolute;
	left: 8rpx;
	bottom: 3rpx;
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #ff805f;
	box-shadow: 25rpx 0 #ff805f;
}

.entry-icon--address::before {
	content: '';
	position: absolute;
	left: 5rpx;
	top: 0;
	width: 34rpx;
	height: 34rpx;
	border-radius: 50%;
	background: #ff805f;
}

.entry-icon--address::after {
	content: '';
	position: absolute;
	left: 16rpx;
	top: 28rpx;
	width: 18rpx;
	height: 18rpx;
	background: #ff805f;
	transform: rotate(45deg);
}

.entry-icon--help {
	font-size: 0;
	border-radius: 50%;
	background: transparent;
	border: 6rpx solid #ff805f;
	border-bottom-color: transparent;
	box-sizing: border-box;
}

.entry-icon--help::before {
	content: '';
	position: absolute;
	left: -7rpx;
	top: 20rpx;
	width: 12rpx;
	height: 18rpx;
	border-radius: 6rpx;
	background: #ff805f;
	box-shadow: 44rpx 0 #ff805f;
}

.entry-icon--help::after {
	content: '';
	position: absolute;
	right: -2rpx;
	bottom: 1rpx;
	width: 20rpx;
	height: 6rpx;
	border-radius: 999rpx;
	background: #ff805f;
}

.entry-icon--terms {
	font-size: 0;
	background: #ff805f;
}

.entry-icon--terms::before {
	content: '';
	position: absolute;
	left: 12rpx;
	top: 11rpx;
	width: 20rpx;
	height: 5rpx;
	border-radius: 999rpx;
	background: #fff;
	box-shadow: 0 10rpx #fff, 0 20rpx #fff;
}

.entry-body {
	flex: 1;
	min-width: 0;
}

.entry-label-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
	min-width: 0;
}

.entry-label {
	min-width: 0;
	font-size: 33rpx;
	font-weight: 900;
	color: #0b0c10;
}

.entry-badge {
	min-width: 34rpx;
	height: 34rpx;
	line-height: 34rpx;
	padding: 0 10rpx;
	border-radius: 999rpx;
	background: #fff0f1;
	color: #d92733;
	font-size: 20rpx;
	font-weight: 900;
	text-align: center;
	box-sizing: border-box;
}

.entry-sub {
	margin-top: 20rpx;
	font-size: 29rpx;
	font-weight: 800;
	color: #9c9da3;
	line-height: 1.35;
}

.entry-arrow {
	color: #9c9da3;
	font-size: 48rpx;
	font-weight: 500;
}

.support-qr-mask {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-top: calc(294rpx + env(safe-area-inset-top));
	background: rgba(0, 0, 0, 0.72);
	box-sizing: border-box;
}

.support-qr-title {
	color: #fff;
	font-size: 33rpx;
	font-weight: 900;
	line-height: 1;
}

.support-qr-card {
	position: relative;
	width: 570rpx;
	height: 570rpx;
	margin-top: 20rpx;
	background: #fff;
	padding: 20rpx;
	box-sizing: border-box;
}

.support-qr-grid {
	width: 100%;
	height: 100%;
	display: grid;
	grid-template-columns: repeat(29, 1fr);
	grid-template-rows: repeat(29, 1fr);
	gap: 0;
	background: #fff;
}

.support-qr-cell {
	background: #fff;
}

.support-qr-cell.dark {
	background: #000;
}

.support-qr-logo {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 118rpx;
	height: 118rpx;
	border-radius: 50%;
	background: #f6edd7;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translate(-50%, -50%);
	box-shadow: 0 0 0 10rpx #fff;
}

.support-logo-stone {
	position: relative;
	width: 72rpx;
	height: 70rpx;
	border: 4rpx solid #6f4f38;
	border-radius: 48% 48% 44% 44%;
	background: #fffaf1;
	box-sizing: border-box;
}

.support-logo-eye {
	position: absolute;
	top: 18rpx;
	width: 5rpx;
	height: 5rpx;
	border-radius: 50%;
	background: #6f4f38;
}

.support-logo-eye.eye-left {
	left: 22rpx;
}

.support-logo-eye.eye-right {
	right: 22rpx;
}

.support-logo-crystal {
	position: absolute;
	left: 23rpx;
	top: 32rpx;
	width: 34rpx;
	height: 42rpx;
	border: 4rpx solid #6f4f38;
	background:
		linear-gradient(135deg, rgba(116, 86, 62, 0.22) 0 44%, transparent 45%),
		linear-gradient(45deg, transparent 0 44%, rgba(116, 86, 62, 0.22) 45% 68%, transparent 69%),
		#fff4df;
	clip-path: polygon(50% 0, 100% 30%, 78% 100%, 22% 100%, 0 30%);
	transform: rotate(-15deg);
	box-sizing: border-box;
}

.support-qr-close {
	width: 56rpx;
	height: 56rpx;
	line-height: 50rpx;
	margin-top: 18rpx;
	border: 6rpx solid #fff;
	border-radius: 50%;
	color: #fff;
	font-size: 44rpx;
	font-weight: 800;
	text-align: center;
	box-sizing: border-box;
}
</style>
