<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';

interface AddressRecord {
	id: string;
	name: string;
	phone: string;
	region: string;
	detail: string;
	isDefault: boolean;
}

const ADDRESS_KEY = 'diy-bracelets-addresses';
const addresses = ref<AddressRecord[]>([]);
const editingId = ref('');
const showForm = ref(false);
const selectMode = ref(false);
const returnToCheckout = ref(false);
const form = ref({
	name: '',
	phone: '',
	region: '',
	detail: '',
	isDefault: false,
});

const editing = computed(() => !!editingId.value);
const listTitle = computed(() => (selectMode.value ? '选择收货地址' : '我的收货地址'));
const formTitle = computed(() => (editing.value ? '编辑地址' : '新增地址'));
const pageTitle = computed(() => (showForm.value ? formTitle.value : listTitle.value));
const selectHintText = computed(() =>
	returnToCheckout.value ? '选择后将返回确认订单页，用于本次收货。' : '选择一条地址用于当前操作。',
);
const defaultRowChecked = computed(() => selectMode.value || form.value.isDefault);
const defaultRowTitle = computed(() => (selectMode.value ? '用于本次订单' : '设为默认地址'));
const defaultRowSubText = computed(() =>
	selectMode.value ? '保存后会自动带回确认订单页' : '提醒：每次下单会默认推荐该地址',
);

onLoad((query: Record<string, string | undefined>) => {
	syncFromQuery(query);
});

onShow(() => {
	// #ifdef H5
	syncFromQuery(readH5RouteQuery());
	// #endif
	// #ifndef H5
	syncFromQuery({
		select: selectMode.value ? '1' : undefined,
		returnTo: returnToCheckout.value ? 'checkout' : undefined,
		form: showForm.value ? '1' : undefined,
		id: editingId.value || undefined,
	});
	// #endif
});

onMounted(() => {
	// #ifdef H5
	window.addEventListener('hashchange', syncFromH5Route);
	syncFromH5Route();
	// #endif
});

onBeforeUnmount(() => {
	// #ifdef H5
	window.removeEventListener('hashchange', syncFromH5Route);
	// #endif
});

function emptyAddressForm() {
	return {
		name: '',
		phone: '',
		region: '',
		detail: '',
		isDefault: false,
	};
}

function syncFromQuery(query: Record<string, string | undefined>) {
	const nextShowForm = query.form === '1';
	const nextEditingId = query.id || '';
	const enteringCreateForm = nextShowForm && !nextEditingId && (!showForm.value || editingId.value);
	selectMode.value = query.select === '1';
	returnToCheckout.value = query.returnTo === 'checkout' || query.checkout === '1';
	showForm.value = nextShowForm;
	editingId.value = nextEditingId;
	loadAddresses();
	if (nextShowForm && nextEditingId) {
		fillFormFromAddress(nextEditingId);
	} else if (enteringCreateForm) {
		form.value = emptyAddressForm();
	}
	uni.setNavigationBarTitle({ title: pageTitle.value });
}

function readH5RouteQuery(): Record<string, string | undefined> {
	if (typeof window === 'undefined') return {};
	const hashQuery = window.location.hash.split('?')[1] || '';
	return Object.fromEntries(new URLSearchParams(hashQuery).entries());
}

function syncFromH5Route() {
	syncFromQuery(readH5RouteQuery());
}

function loadAddresses() {
	try {
		const raw = uni.getStorageSync(ADDRESS_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		addresses.value = normalizeAddresses(Array.isArray(cached) ? cached : []);
	} catch {
		addresses.value = [];
	}
}

function saveAddresses() {
	addresses.value = normalizeAddresses(addresses.value);
	uni.setStorageSync(ADDRESS_KEY, JSON.stringify(addresses.value));
}

function normalizeAddresses(list: AddressRecord[]) {
	if (!list.length) return [];
	let defaultSeen = false;
	const normalized = list.map((item, index) => {
		const isDefault = item.isDefault && !defaultSeen;
		if (isDefault) defaultSeen = true;
		return {
			...item,
			isDefault,
			id: item.id || `address-${Date.now()}-${index}`,
		};
	});
	if (!defaultSeen) {
		normalized[0] = { ...normalized[0], isDefault: true };
	}
	return normalized;
}

function resetForm() {
	editingId.value = '';
	showForm.value = false;
	form.value = emptyAddressForm();
	uni.setNavigationBarTitle({ title: listTitle.value });
}

function fillFormFromAddress(id: string) {
	const address = addresses.value.find((item) => item.id === id);
	if (!address) return;
	form.value = {
		name: address.name,
		phone: address.phone,
		region: address.region,
		detail: address.detail,
		isDefault: address.isDefault,
	};
}

function selectionQuery() {
	const params: string[] = [];
	if (selectMode.value) params.push('select=1');
	if (returnToCheckout.value) params.push('returnTo=checkout');
	return params.length ? `&${params.join('&')}` : '';
}

function openAddressEditor(url: string) {
	if (selectMode.value && returnToCheckout.value) {
		uni.redirectTo({ url });
		return;
	}
	uni.navigateTo({ url });
}

function editAddress(address: AddressRecord) {
	openAddressEditor(`/pages/profile/address?form=1&id=${encodeURIComponent(address.id)}${selectionQuery()}`);
}

function startCreate() {
	openAddressEditor(`/pages/profile/address?form=1${selectionQuery()}`);
}

function goBack() {
	const pages = getCurrentPages();
	if (showForm.value && pages.length <= 1) {
		resetForm();
		return;
	}
	if (pages.length > 1) {
		uni.navigateBack();
		return;
	}
	if (returnToCheckout.value) {
		uni.redirectTo({ url: '/pages/checkout/checkout' });
		return;
	}
	uni.switchTab({ url: '/pages/profile/profile' });
}

function validateForm() {
	if (!form.value.name.trim()) return '请填写收件人';
	if (!form.value.phone.trim()) return '请填写联系电话';
	if (!/^1\d{10}$/.test(form.value.phone.trim())) return '请填写11位手机号';
	if (!form.value.region.trim()) return '请填写所在地区';
	if (!form.value.detail.trim()) return '请填写详细地址';
	return '';
}

function submitAddress() {
	const error = validateForm();
	if (error) {
		uni.showToast({ title: error, icon: 'none' });
		return;
	}
	const record: AddressRecord = {
		id: editingId.value || `address-${Date.now()}`,
		name: form.value.name.trim(),
		phone: form.value.phone.trim(),
		region: form.value.region.trim(),
		detail: form.value.detail.trim(),
		isDefault: selectMode.value || form.value.isDefault || addresses.value.length === 0,
	};
	if (editing.value) {
		addresses.value = addresses.value.map((item) => {
			const next = item.id === editingId.value ? record : item;
			return {
				...next,
				isDefault: record.isDefault ? item.id === editingId.value : next.isDefault,
			};
		});
	} else {
		addresses.value = [record, ...addresses.value.map((item) => ({ ...item, isDefault: record.isDefault ? false : item.isDefault }))];
	}
	addresses.value = normalizeAddresses(addresses.value);
	saveAddresses();
	uni.showToast({ title: '已保存地址', icon: 'success' });
	setTimeout(() => {
		if (selectMode.value && returnToCheckout.value) {
			uni.redirectTo({ url: '/pages/checkout/checkout' });
			return;
		}
		const pages = getCurrentPages();
		if (pages.length <= 1) {
			resetForm();
			return;
		}
		uni.navigateBack({ delta: selectMode.value && pages.length > 2 ? 2 : 1 });
	}, 260);
}

function setDefault(id: string, options: { silent?: boolean } = {}) {
	if (addresses.value.find((item) => item.id === id)?.isDefault) return;
	addresses.value = addresses.value.map((item) => ({ ...item, isDefault: item.id === id }));
	saveAddresses();
	if (!options.silent) {
		uni.showToast({ title: '已设为默认地址', icon: 'none' });
	}
}

function selectAddress(id: string) {
	if (!selectMode.value) return;
	setDefault(id, { silent: true });
	if (returnToCheckout.value) {
		uni.redirectTo({ url: '/pages/checkout/checkout' });
		return;
	}
	uni.navigateBack();
}

function removeAddress(id: string) {
	uni.showModal({
		title: '删除地址',
		content: '确定删除这条收货地址？',
		success: (res) => {
			if (!res.confirm) return;
			addresses.value = addresses.value.filter((item) => item.id !== id);
			if (addresses.value.length && !addresses.value.some((item) => item.isDefault)) {
				addresses.value[0].isDefault = true;
			}
			saveAddresses();
		},
	});
}

function toggleDefault() {
	if (selectMode.value) {
		form.value.isDefault = true;
		return;
	}
	form.value.isDefault = !form.value.isDefault;
}

function onRegionChange(e: { detail: { value: string[] } }) {
	form.value.region = e.detail.value.filter(Boolean).join(' ');
}
</script>

<template>
	<view class="page app-subpage address-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="address-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">{{ pageTitle }}</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view v-if="showForm" class="form-panel">
			<view class="group-title">联系人</view>
			<view class="form-group">
				<view class="field-row">
					<view class="label">姓名</view>
					<input v-model="form.name" class="input" placeholder="请填写收货人姓名" />
				</view>
				<view class="field-row">
					<view class="label">手机号码</view>
					<input v-model="form.phone" class="input" type="number" maxlength="11" placeholder="请填写收货人手机号" />
				</view>
			</view>

			<view class="group-title">收货地址</view>
			<view class="form-group">
				<view class="field-row">
					<view class="label">所在区域</view>
					<!-- #ifdef MP-WEIXIN -->
					<picker class="region-picker" mode="region" @change="onRegionChange">
						<view class="region-value" :class="{ placeholder: !form.region }">
							{{ form.region || '选择收货地址 >' }}
						</view>
					</picker>
					<!-- #endif -->
					<!-- #ifndef MP-WEIXIN -->
					<input v-model="form.region" class="input" placeholder="选择收货地址 >" />
					<!-- #endif -->
				</view>
				<view class="field-row">
					<view class="label">详细地址</view>
					<input v-model="form.detail" class="input" placeholder="详细地址，如1号楼101室" />
				</view>
			</view>

			<view class="default-row" :class="{ locked: selectMode }" @tap="toggleDefault">
				<view class="default-body">
					<view class="default-title">{{ defaultRowTitle }}</view>
					<view class="default-sub">{{ defaultRowSubText }}</view>
				</view>
				<view class="default-check" :class="{ checked: defaultRowChecked }">
					<view class="default-check-dot" />
				</view>
			</view>

			<view class="form-bottom-action">
				<button class="save-btn" @tap="submitAddress">保存</button>
			</view>
		</view>

		<view v-else-if="addresses.length" class="address-list">
			<view v-if="selectMode" class="select-hint">
				<view class="select-hint-dot" />
				<view class="select-hint-text">{{ selectHintText }}</view>
			</view>
			<view
				v-for="address in addresses"
				:key="address.id"
				class="address-card"
				:class="{ selecting: selectMode, selected: selectMode && address.isDefault }"
				@tap="selectAddress(address.id)"
			>
				<view class="address-main">
					<view class="address-top">
						<text class="address-name">{{ address.name }}</text>
						<text class="address-phone">{{ address.phone }}</text>
						<text v-if="address.isDefault" class="default-badge">默认</text>
					</view>
					<view class="address-text">{{ address.region }} {{ address.detail }}</view>
				</view>
				<view class="address-actions">
					<view v-if="selectMode" class="select-btn" @tap.stop="selectAddress(address.id)">选择</view>
					<view
						v-else
						class="link"
						:class="{ muted: address.isDefault }"
						@tap="setDefault(address.id)"
					>
						{{ address.isDefault ? '默认地址' : '设为默认' }}
					</view>
					<view class="link" @tap.stop="editAddress(address)">编辑</view>
					<view v-if="!selectMode" class="link danger" @tap.stop="removeAddress(address.id)">删除</view>
				</view>
			</view>
		</view>

		<view v-else class="empty">
			<view class="empty-figure">
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
			<view class="empty-title">暂无收货地址~</view>
			<view class="empty-sub">
				{{ selectMode ? '添加后会自动带回确认订单页' : '添加地址后，下单时会默认推荐使用' }}
			</view>
		</view>

		<view v-if="!showForm" class="bottom-action">
			<button class="add-btn" @tap="startCreate">添加新地址</button>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #f6f6f6;
	padding: calc(118rpx + env(safe-area-inset-top)) 0 160rpx;
	box-sizing: border-box;
}

.address-nav {
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
	background: #f6f6f6;
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
	color: #1d1e22;
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
:global(uni-app:has(.address-page) uni-tabbar),
:global(uni-app:has(.address-page) .uni-tabbar-bottom) {
	display: none !important;
}

:global(uni-page-body:has(> .address-page)) {
	padding-bottom: 0 !important;
}
/* #endif */

.address-card {
	background: #fff;
	border-radius: 10rpx;
	border: 1rpx solid #f0f0f2;
	box-shadow: 0 8rpx 20rpx rgba(39, 42, 54, 0.04);
}

.form-panel {
	padding-bottom: 120rpx;
}

.group-title {
	height: 74rpx;
	display: flex;
	align-items: center;
	padding: 0 30rpx;
	color: #202125;
	font-size: 26rpx;
	font-weight: 900;
	box-sizing: border-box;
}

.form-group {
	background: #fff;
}

.field-row {
	display: flex;
	align-items: center;
	min-height: 88rpx;
	padding: 0 30rpx;
	border-bottom: 1rpx solid #ededee;
	box-sizing: border-box;
}

.field-row:last-child {
	border-bottom: 0;
}

.label {
	width: 162rpx;
	flex-shrink: 0;
	color: #222327;
	font-size: 26rpx;
	font-weight: 900;
}

.input {
	flex: 1;
	min-width: 0;
	height: 88rpx;
	color: #1f2025;
	font-size: 25rpx;
	font-weight: 700;
	text-align: right;
}

.region-picker {
	flex: 1;
	min-width: 0;
}

.region-value {
	height: 88rpx;
	line-height: 88rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #1f222a;
	font-size: 25rpx;
	font-weight: 700;
	text-align: right;
}

.region-value.placeholder {
	color: #9a9da4;
}

.default-row {
	min-height: 112rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	margin-top: 20rpx;
	padding: 16rpx 30rpx;
	background: #fff;
	box-sizing: border-box;
}

.default-row:active {
	opacity: 0.74;
}

.default-body {
	min-width: 0;
}

.default-title {
	color: #202126;
	font-size: 27rpx;
	font-weight: 900;
}

.default-sub {
	margin-top: 12rpx;
	color: #9a9da4;
	font-size: 24rpx;
}

.default-check {
	position: relative;
	width: 46rpx;
	height: 46rpx;
	flex-shrink: 0;
	border-radius: 50%;
	border: 5rpx solid #a8a9ae;
	background: #fff;
	box-sizing: border-box;
	transition: border-color 140ms ease, background 140ms ease;
}

.default-check.checked {
	border-color: #d92733;
	background: #d92733;
}

.default-check-dot {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: #fff;
	opacity: 0;
	transform: translate(-50%, -50%) scale(0.6);
	transition: opacity 140ms ease, transform 140ms ease;
}

.default-check.checked .default-check-dot {
	opacity: 1;
	transform: translate(-50%, -50%) scale(1);
}

.form-bottom-action {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 20;
	padding: 18rpx 22rpx calc(18rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(246, 246, 246, 0) 0%, #f6f6f6 32%, #f6f6f6 100%);
	box-sizing: border-box;
}

.save-btn {
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 30rpx;
	font-weight: 900;
	box-shadow: 0 12rpx 24rpx rgba(217, 39, 51, 0.2);
}

.save-btn::after,
.add-btn::after {
	border: 0;
}

.address-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
	padding: 22rpx 22rpx 0;
	box-sizing: border-box;
}

.select-hint {
	min-height: 82rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 18rpx 22rpx;
	border-radius: 10rpx;
	background: #fff6f6;
	border: 1rpx solid #f4d0d4;
	box-sizing: border-box;
}

.select-hint-dot {
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: #d92733;
	box-shadow: 0 0 0 8rpx rgba(217, 39, 51, 0.1);
	flex-shrink: 0;
}

.select-hint-text {
	min-width: 0;
	color: #7a3036;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.45;
}

.address-card {
	padding: 22rpx;
}

.address-card.selecting {
	border-color: #f7d6d9;
}

.address-card.selected {
	background: #fff8f8;
	border-color: #f0bfc4;
}

.address-card.selecting:active,
.link:active,
.select-btn:active {
	opacity: 0.72;
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
	color: #737780;
	font-size: 25rpx;
	font-weight: 700;
}

.default-badge {
	height: 34rpx;
	line-height: 34rpx;
	padding: 0 12rpx;
	border-radius: 999rpx;
	background: #fff0f1;
	color: #d92733;
	font-size: 21rpx;
	font-weight: 900;
}

.address-text {
	margin-top: 12rpx;
	color: #555963;
	font-size: 25rpx;
	line-height: 1.45;
}

.address-actions {
	display: flex;
	justify-content: flex-end;
	gap: 22rpx;
	margin-top: 20rpx;
}

.link {
	color: #555963;
	font-size: 24rpx;
	font-weight: 800;
}

.link.muted {
	color: #9ca0a8;
}

.link.danger {
	color: #d92733;
}

.select-btn {
	height: 44rpx;
	line-height: 44rpx;
	padding: 0 22rpx;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 22rpx;
	font-weight: 900;
}

.empty {
	margin-top: 188rpx;
	text-align: center;
	color: #999ba4;
}

.empty-figure {
	position: relative;
	width: 282rpx;
	height: 238rpx;
	margin: 0 auto 30rpx;
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
	margin-top: 58rpx;
	font-size: 28rpx;
	font-weight: 900;
	color: #9a9da4;
}

.empty-sub {
	margin-top: 14rpx;
	color: #b0b2ba;
	font-size: 24rpx;
	font-weight: 800;
}

.bottom-action {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 18rpx 32rpx calc(18rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(246, 246, 246, 0) 0%, #f6f6f6 32%, #f6f6f6 100%);
	box-sizing: border-box;
}

.add-btn {
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
	border-radius: 999rpx;
	background: #d92733;
	color: #fff;
	font-size: 30rpx;
	font-weight: 900;
	box-shadow: 0 12rpx 24rpx rgba(217, 39, 51, 0.2);
}
</style>
