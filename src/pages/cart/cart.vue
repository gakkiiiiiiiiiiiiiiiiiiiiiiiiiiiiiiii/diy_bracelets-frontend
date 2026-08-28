<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api, getStoredUserId, isMockApiFallbackError, type CartItem } from '@/api';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { useDesignStore } from '@/stores/design';
import {
	cacheLocalCartItems,
	flushPendingRemoteCart,
	loadLocalCartItems,
	saveCheckoutDraft,
	saveLocalCartItems,
	usesRemoteCommerce,
} from '@/utils/checkout';
import { designEntrySourceForCartItem, openDesignStudio } from '@/utils/designNavigation';
import { cartItemSummaryText } from '@/utils/orderDisplay';

const items = ref<CartItem[]>([]);
const selectedIds = ref<string[]>([]);
const designStore = useDesignStore();
const CART_MIGRATION_USER_KEY = 'diy-bracelets-cart-migrated-user';

const selectedItems = computed(() => items.value.filter((item) => selectedIds.value.includes(item.id)));
const selectedTotal = computed(() => selectedItems.value.reduce((sum, item) => sum + item.price * item.qty, 0));
const selectedQty = computed(() => selectedItems.value.reduce((sum, item) => sum + item.qty, 0));
const totalQty = computed(() => items.value.reduce((sum, item) => sum + Number(item.qty || 1), 0));
const hasSelection = computed(() => selectedItems.value.length > 0);
const checkoutButtonLabel = computed(() => `去结算（${selectedQty.value}件）`);
const totalText = computed(() => {
	const total = selectedTotal.value;
	return Number.isInteger(total) ? String(total) : total.toFixed(1);
});
const allSelected = computed(() => items.value.length > 0 && selectedIds.value.length === items.value.length);

async function refreshCart() {
	try {
		await flushPendingRemoteCart();
		const res = await api.getCart();
		const apiItems = (res?.items || []) as CartItem[];
		const localItems = loadLocalCart();
		if (usesRemoteCommerce) {
			items.value = await resolveRemoteCart(apiItems, localItems);
		} else {
			items.value = mergeCartItems(apiItems, localItems);
		}
		cacheLocalCartItems(items.value);
		selectedIds.value = items.value.map((item) => item.id);
	} catch (e) {
		if (!isMockApiFallbackError(e)) console.warn('[cart] API getCart failed:', e);
		items.value = loadLocalCart();
		selectedIds.value = items.value.map((item) => item.id);
	}
}

async function resolveRemoteCart(remoteItems: CartItem[], localItems: CartItem[]) {
	const userId = getStoredUserId();
	const migratedUser = String(uni.getStorageSync(CART_MIGRATION_USER_KEY) || '');
	let resolved = remoteItems;
	if (!remoteItems.length && localItems.length && userId && !migratedUser) {
		const migrated = await api.replaceCart(localItems);
		resolved = (migrated?.items || []) as CartItem[];
	}
	if (userId) uni.setStorageSync(CART_MIGRATION_USER_KEY, userId);
	return resolved;
}

function showCartPage() {
	uni.setNavigationBarTitle({ title: '购物车' });
	refreshCart();
}

onMounted(showCartPage);
onShow(showCartPage);

function loadLocalCart(): CartItem[] {
	return loadLocalCartItems();
}

function mergeCartItems(primary: CartItem[], secondary: CartItem[]) {
	const seen = new Set<string>();
	return [...primary, ...secondary].filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}

function saveLocalCart(next = items.value) {
	saveLocalCartItems(next);
}

function syncSelectionAfterCartChange() {
	const ids = new Set(items.value.map((item) => item.id));
	selectedIds.value = selectedIds.value.filter((id) => ids.has(id));
}

function changeQty(id: string, delta: number) {
	items.value = items.value.map((item) =>
		item.id === id ? { ...item, qty: Math.min(99, Math.max(1, Number(item.qty || 1) + delta)) } : item,
	);
	saveLocalCart();
}

function removeCartItems(ids: string[]) {
	const selected = new Set(ids);
	const removedCount = items.value
		.filter((item) => selected.has(item.id))
		.reduce((sum, item) => sum + Number(item.qty || 1), 0);
	items.value = items.value.filter((item) => !selected.has(item.id));
	syncSelectionAfterCartChange();
	saveLocalCart();
	uni.showToast({ title: removedCount > 1 ? `已移除 ${removedCount} 件` : '已移除', icon: 'none' });
}

function confirmRemove(options: { content: string; onConfirm: () => void }) {
	uni.showModal({
		title: '移除商品',
		content: options.content,
		confirmText: '移除',
		confirmColor: '#D92733',
		cancelText: '取消',
		success: (res) => {
			if (res.confirm) options.onConfirm();
		},
	});
}

function itemCompositionText(item: CartItem) {
	if (!item.composition?.length) return '';
	return cartItemSummaryText(item);
}

function moneyText(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

function continueEdit(item: CartItem) {
	if (!item.composition?.length) return;
	designStore.applyDesignFromPlaza(item.composition, {
		source: 'cart',
		handCircumferenceCm: item.handCircumferenceCm ?? null,
	});
	openDesignStudio(designEntrySourceForCartItem(item), { editingCartItemId: item.id });
}

function checkout() {
	if (!selectedItems.value.length) {
		uni.showToast({ title: '请选择商品', icon: 'none' });
		return;
	}
	saveCheckoutDraft('cart', selectedItems.value, selectedIds.value);
	uni.navigateTo({ url: '/pages/checkout/checkout' });
}

function toggleSelect(id: string) {
	selectedIds.value = selectedIds.value.includes(id)
		? selectedIds.value.filter((itemId) => itemId !== id)
		: [...selectedIds.value, id];
}

function toggleAll() {
	selectedIds.value = allSelected.value ? [] : items.value.map((item) => item.id);
}

function removeSelectedItems() {
	if (!selectedIds.value.length) {
		uni.showToast({ title: '请选择商品', icon: 'none' });
		return;
	}
	const count = selectedQty.value;
	const visibleNames = selectedItems.value.slice(0, 2).map((item) => itemDisplayName(item));
	const suffix = selectedItems.value.length > 2 ? '等' : '';
	const idsToRemove = [...selectedIds.value];
	confirmRemove({
		content: `确定移除${visibleNames.join('、')}${suffix} ${count} 件商品吗？`,
		onConfirm: () => removeCartItems(idsToRemove),
	});
}

function goDesign() {
	openDesignStudio('bracelet');
}

function goGoods() {
	uni.navigateTo({ url: '/pages/goods/search/search' });
}

</script>

<template>
	<view class="page cart-page" :class="{ 'page--empty': items.length === 0 }">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="cart-nav">
			<view class="cart-nav-title">购物车</view>
		</view>

		<view v-if="items.length === 0" class="empty">
			<view class="empty-cart-art">
				<image class="empty-cart-img" src="/static/images/cart-empty-source.png" mode="aspectFit" />
			</view>
			<view class="empty-text">购物车没有订单哟</view>
			<view class="empty-actions">
				<button class="btn" @tap="goDesign">去定制</button>
				<button class="btn btn-outline" @tap="goGoods">找好物</button>
			</view>
		</view>

		<view v-else class="list">
			<view class="cart-tools">
				<view class="select-all" @tap="toggleAll">
					<view class="check" :class="{ active: allSelected }" />
					<text>全选</text>
					<text v-if="totalQty" class="select-all-count">共 {{ totalQty }} 件</text>
				</view>
				<view class="cart-delete" @tap="removeSelectedItems">
					<view class="cart-delete__lid" />
					<view class="cart-delete__bin" />
				</view>
			</view>
			<view
				v-for="item in items"
				:key="item.id"
				class="item"
				:class="{ 'item--unselected': !selectedIds.includes(item.id) }"
			>
				<view class="check item-check" :class="{ active: selectedIds.includes(item.id) }" @tap="toggleSelect(item.id)" />
				<image class="item-img" :src="item.image" mode="aspectFill" />
				<view class="item-info">
					<view class="item-name">{{ itemDisplayName(item) }}</view>
					<view v-if="itemSpecText(item) && !item.composition?.length" class="item-spec">规格：{{ itemSpecText(item) }}</view>
					<view v-if="item.composition?.length" class="item-design">
						<view class="item-beads">
							<view v-for="row in item.composition.slice(0, 5)" :key="`${item.id}-${row.materialId}-${row.size}`" class="item-bead">
								<image v-if="row.image" class="item-bead-img" :src="row.image" mode="aspectFill" />
								<text v-if="row.quantity > 1" class="item-bead-count">×{{ row.quantity }}</text>
							</view>
						</view>
						<view class="item-summary">{{ itemCompositionText(item) }}</view>
					</view>
					<view class="item-price">¥{{ moneyText(item.price) }}</view>
				</view>
				<view class="item-side">
					<view class="item-actions">
						<view class="qty-control">
							<view class="qty-step" :class="{ 'qty-step--disabled': item.qty <= 1 }" @tap="changeQty(item.id, -1)">−</view>
							<view class="qty-value">{{ item.qty }}</view>
							<view class="qty-step qty-step--plus" @tap="changeQty(item.id, 1)">＋</view>
						</view>
					</view>
					<view class="item-links">
						<view v-if="item.composition?.length" class="item-link" @tap="continueEdit(item)">继续编辑</view>
					</view>
				</view>
			</view>
		</view>

		<view class="footer">
			<view class="footer-copy">
				<view class="footer-total">合计: ￥{{ totalText }}</view>
				<view v-if="items.length > 0" class="footer-count">{{ hasSelection ? `已选 ${selectedQty} 件` : `共 ${totalQty} 件` }}</view>
			</view>
			<button class="footer-btn" @tap="checkout">{{ checkoutButtonLabel }}</button>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(120rpx + env(safe-area-inset-top)) 28rpx 158rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
:global(uni-page-body:has(> .cart-page)) {
	height: 100%;
	padding-bottom: 0 !important;
}

.cart-page {
	min-height: 100%;
}

.cart-page:not(.page--empty) {
	padding-bottom: 276rpx;
}

.cart-page .footer {
	bottom: calc(126rpx + env(safe-area-inset-bottom));
}

.cart-page.page--empty .empty {
	min-height: calc(100vh - 94px - 260rpx);
}
/* #endif */

.page--empty {
	background: #fff;
	padding: 0 24rpx 158rpx;
	padding-top: calc(120rpx + env(safe-area-inset-top));
}

.cart-nav {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 80;
	height: calc(102rpx + env(safe-area-inset-top));
	padding-top: calc(22rpx + env(safe-area-inset-top));
	background: rgba(255, 255, 255, 0.96);
	backdrop-filter: blur(18rpx);
	box-sizing: border-box;
}

.cart-nav-title {
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

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 20rpx;
	min-height: calc(100vh - 260rpx);
	margin-top: 88rpx;
}

.empty-cart-art {
	position: relative;
	width: 348rpx;
	height: 298rpx;
	margin-bottom: 0;
}

.empty-cart-img {
	width: 100%;
	height: 100%;
	display: block;
}

.empty-text {
	color: #a7a3a5;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.2;
}

.empty-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 20rpx;
	margin-top: 4rpx;
}

.btn {
	min-width: 126rpx;
	height: 68rpx;
	padding: 0 26rpx;
	border-radius: 8rpx;
	background: #fff;
	border: 2rpx solid rgba(216, 41, 52, 0.48);
	color: #d82934;
	font-size: 28rpx;
	font-weight: 800;
	line-height: 64rpx;
	box-sizing: border-box;
}

.btn-outline {
	background: #fff;
	color: #d92733;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 34rpx;
}

.cart-tools {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18rpx;
	padding: 8rpx 0 0;
	color: #17191f;
	font-size: 29rpx;
	font-weight: 900;
}

.select-all {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.select-all-count {
	color: #8f929b;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

.cart-delete {
	position: relative;
	width: 42rpx;
	height: 42rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.cart-delete__lid,
.cart-delete__bin {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	box-sizing: border-box;
}

.cart-delete__lid {
	top: 6rpx;
	width: 28rpx;
	height: 7rpx;
	border-radius: 999rpx;
	background: #17191f;
}

.cart-delete__lid::before {
	content: '';
	position: absolute;
	left: 8rpx;
	top: -5rpx;
	width: 12rpx;
	height: 6rpx;
	border: 3rpx solid #17191f;
	border-bottom: 0;
	border-radius: 8rpx 8rpx 0 0;
	box-sizing: border-box;
}

.cart-delete__bin {
	top: 15rpx;
	width: 24rpx;
	height: 24rpx;
	border: 4rpx solid #17191f;
	border-top: 0;
	border-radius: 0 0 4rpx 4rpx;
}

.check {
	width: 34rpx;
	height: 34rpx;
	border-radius: 2rpx;
	border: 3rpx solid #17191f;
	box-sizing: border-box;
	flex-shrink: 0;
	position: relative;
}

.check.active {
	background: #17191f;
	border-color: #17191f;
}

.check.active::after {
	content: '';
	position: absolute;
	left: 8rpx;
	top: 3rpx;
	width: 9rpx;
	height: 17rpx;
	border-right: 4rpx solid #fff;
	border-bottom: 4rpx solid #fff;
	transform: rotate(42deg);
}

.item {
	background: #fff;
	border: 0;
	border-radius: 0;
	padding: 0;
	display: flex;
	gap: 18rpx;
	align-items: center;
	box-shadow: none;
}

.item--unselected {
	opacity: 0.62;
}

.item-img {
	width: 176rpx;
	height: 176rpx;
	border-radius: 8rpx;
	background: #f1f1f2;
	flex-shrink: 0;
}

.item-info {
	flex: 1;
	min-width: 0;
}

.item-price {
	margin-top: 10rpx;
	color: #dc2934;
	font-size: 29rpx;
	font-weight: 900;
	white-space: nowrap;
}

.item-name {
	margin-top: 0;
	color: #111318;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.28;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.item-spec {
	margin-top: 8rpx;
	color: #8f929b;
	font-size: 26rpx;
	font-weight: 800;
}

.item-design {
	margin-top: 12rpx;
	display: flex;
	align-items: center;
	gap: 12rpx;
	min-width: 0;
}

.item-beads {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.item-bead {
	position: relative;
	width: 38rpx;
	height: 38rpx;
	margin-left: -8rpx;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 0 0 2rpx #fff, 0 4rpx 10rpx rgba(42, 48, 68, 0.12);
	overflow: hidden;
}

.item-bead:first-child {
	margin-left: 0;
}

.item-bead-img {
	width: 100%;
	height: 100%;
}

.item-bead-count {
	position: absolute;
	right: -1rpx;
	bottom: -1rpx;
	padding: 0 4rpx;
	border-radius: 999rpx;
	background: rgba(38, 49, 79, 0.86);
	color: #fff;
	font-size: 14rpx;
	line-height: 20rpx;
}

.item-summary {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #7f879a;
	font-size: 20rpx;
}

.item-side {
	flex-shrink: 0;
	align-self: center;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 18rpx;
}

.item-actions {
	display: flex;
	align-items: center;
	gap: 0;
	margin-top: 0;
	flex-wrap: nowrap;
}

.qty-control {
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.qty-step {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	border: 4rpx solid #b8b8bd;
	color: #9b9da4;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 34rpx;
	font-weight: 900;
	box-sizing: border-box;
	line-height: 1;
}

.qty-step--disabled {
	border-color: #e0e1e5;
	color: #c4c6cc;
	background: #fff;
}

.qty-step--plus {
	background: #050506;
	border-color: #050506;
	color: #fff;
}

.qty-value {
	min-width: 32rpx;
	text-align: center;
	color: #111318;
	font-size: 31rpx;
	font-weight: 900;
}

.qty-step:active,
.cart-delete:active,
.item-link:active {
	opacity: 0.72;
}

.item-links {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 10rpx;
}

.item-link {
	font-size: 22rpx;
	color: #26314f;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

.footer {
	position: fixed;
	left: 24rpx;
	right: 24rpx;
	bottom: calc(26rpx + env(safe-area-inset-bottom));
	height: 88rpx;
	background: #dc2934;
	border-radius: 999rpx;
	padding: 0 28rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	color: #fff;
	box-shadow: 0 12rpx 24rpx rgba(217, 39, 51, 0.18);
	box-sizing: border-box;
	z-index: 20;
}

.footer-copy {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6rpx;
	min-width: 0;
}

.footer-total {
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1;
	white-space: nowrap;
}

.footer-count {
	color: rgba(255, 255, 255, 0.88);
	font-size: 20rpx;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

.footer-btn {
	background: transparent;
	color: #fff;
	font-size: 28rpx;
	font-weight: 900;
	border: none;
	padding: 0;
	margin: 0;
	line-height: 1;
}

.footer-btn[disabled] {
	color: rgba(255, 255, 255, 0.92);
	background: transparent;
	opacity: 1;
}
</style>
