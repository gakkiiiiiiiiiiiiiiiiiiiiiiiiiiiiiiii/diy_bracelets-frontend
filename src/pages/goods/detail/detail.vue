<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import MiniProgramCapsule from '@/components/MiniProgramCapsule.vue';
import { api, type DesignDetail } from '@/api';
import { useDesignStore } from '@/stores/design';
import { useMaterialsStore } from '@/stores/materials';
import { useSavedDesignsStore } from '@/stores/savedDesigns';
import { useContentStore } from '@/stores/content';
import { mockDesignDetails } from '@/data/mock';
import { getShopProductById, type ShopGoodsProduct } from '@/data/shopGoods';
import {
	addLocalCartItems,
	defaultCheckoutAddress,
	loadCheckoutAddresses,
	saveCheckoutDraft,
	type CheckoutAddress,
} from '@/utils/checkout';
import { cloneComposition, compositionBeadCount } from '@/utils/designComposition';
import { openDesignStudio } from '@/utils/designNavigation';
import { isFavoriteDesign, loadFavoriteDesignIds, loadFavoriteDesigns, removeFavoriteDesign, saveFavoriteDesign } from '@/utils/favorites';
import type { CartItem } from '@/api';

const designId = ref('');
const fromInspiration = ref(false);
const detail = ref<DesignDetail | null>(null);
const product = ref<ShopGoodsProduct | null>(null);
const loading = ref(false);
const favoriteIds = ref<string[]>([]);
const designStore = useDesignStore();
const materialsStore = useMaterialsStore();
const savedStore = useSavedDesignsStore();
const contentStore = useContentStore();
const selectedSize = ref('');
const buyQty = ref(1);
const productNote = ref('');
const checkoutAddresses = ref<CheckoutAddress[]>([]);
const supportOpen = ref(false);
const serviceId = computed(() => contentStore.brand.supportId);

const selectedSpecLabel = computed(() => selectedSize.value || product.value?.sizes[0] || '默认规格');
const productHeroImages = computed(() => {
	if (!product.value) return [];
	const sourceImages = product.value.images?.length
		? product.value.images
		: [product.value.detailImage, product.value.image];
	return Array.from(new Set(sourceImages.filter((image): image is string => !!image)));
});
const productHeroImage = computed(() => productHeroImages.value[0] || '');
const productTotalPrice = computed(() => Number(((product.value?.price || 0) * buyQty.value).toFixed(1)));
const productTotalPriceText = computed(() => productTotalPrice.value.toFixed(1));
const selectedAddress = computed(() => defaultCheckoutAddress(checkoutAddresses.value));
const freightText = computed(() => (selectedAddress.value ? '(包邮) 0.0' : '(包邮) 0.0'));
const productBuySubText = computed(() => (selectedAddress.value ? '立即结算' : '请先选择地址'));
const productNoteCount = computed(() => productNote.value.length);
const addressSummaryText = computed(() =>
	selectedAddress.value ? `${selectedAddress.value.region} ${selectedAddress.value.detail}` : '',
);
const isServiceProduct = computed(() => product.value?.categoryId === 'services');
const serviceContactContent = computed(() =>
	isServiceProduct.value
			? `客服时间：${contentStore.brand.supportHours}，可咨询检测证书、差价补齐、订单备注和处理进度。`
			: `客服时间：${contentStore.brand.supportHours}，可咨询尺寸、库存和定制搭配。`,
);
const supportContextText = computed(() => {
	const targetName = product.value?.name || detail.value?.title || '当前商品';
	return isServiceProduct.value
		? `发送「${targetName}」和订单备注，客服会协助确认服务金额与处理方式。`
		: `发送「${targetName}」和规格 ${selectedSpecLabel.value}，客服会协助核对库存、色差和实物图。`;
});
const favoriteLabel = computed(() => (isFavorite() ? '已收藏' : '收藏'));
const detailHasComposition = computed(() => !!detail.value?.composition?.length);
const designUseButtonLabel = computed(() => (detailHasComposition.value ? '使用该设计' : '暂无可套用'));
const detailPageTitle = computed(() => (product.value ? '商品详情' : fromInspiration.value ? '灵感详情' : '设计详情'));
const detailAuthorText = computed(() => {
	const author = detail.value?.author || '岛民';
	return author.startsWith('@') ? author : `@${author}`;
});

const beadCount = computed(() =>
	(detail.value?.composition || []).reduce((sum, row) => sum + row.quantity, 0),
);

const totalPrice = computed(() =>
	(detail.value?.composition || []).reduce((sum, row) => sum + row.price * row.quantity, 0),
);

onLoad((query: Record<string, string | undefined>) => {
	syncDetailIdFromQuery(query);
	loadFavorites();
	refreshCheckoutAddresses();
});

onShow(() => {
	void contentStore.fetchContent();
	refreshCheckoutAddresses();
	// #ifdef H5
	syncDetailIdFromQuery(h5QueryFromHash());
	// #endif
});

onMounted(() => {
	// #ifdef H5
	window.addEventListener('hashchange', syncDetailIdFromHash);
	syncDetailIdFromQuery(h5QueryFromHash());
	// #endif
});

onBeforeUnmount(() => {
	// #ifdef H5
	window.removeEventListener('hashchange', syncDetailIdFromHash);
	// #endif
});

function syncDetailIdFromQuery(query: Record<string, string | undefined>) {
	fromInspiration.value = query.from === 'inspiration';
	const nextId = query.id || query.designId || '';
	if (!nextId) return;
	if (nextId !== designId.value) {
		designId.value = nextId;
		return;
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

function syncDetailIdFromHash() {
	syncDetailIdFromQuery(h5QueryFromHash());
}

async function fetchDetail() {
	if (!designId.value) return;
	product.value = null;
	detail.value = null;
	const localProduct = getShopProductById(designId.value);
	if (localProduct) {
		product.value = localProduct;
		detail.value = null;
		selectedSize.value = localProduct.sizes[0] ?? '';
		buyQty.value = 1;
		productNote.value = '';
		return;
	}
	loading.value = true;
	try {
		detail.value = fromInspiration.value
			? await api.getInspiration(designId.value)
			: await api.getGoodsDetail(designId.value);
	} catch (_e) {
		detail.value = mockDesignDetails[designId.value] ?? loadFavoriteDesigns().find((item) => item.id === designId.value) ?? null;
	} finally {
		loading.value = false;
	}
}

watch([designId, fromInspiration], ([id]) => {
	if (id) fetchDetail();
}, { immediate: true });

async function useDesign() {
	if (!detail.value) return;
	if (!detailHasComposition.value) {
		uni.showToast({ title: '暂无可套用设计', icon: 'none' });
		return;
	}
	const current = detail.value;
	const applyCurrentDesign = async () => {
		let exactApplied = false;
		if (current.braceletCode) {
			try {
				const resolved = await api.resolveBraceletCode(current.braceletCode);
				if (resolved.valid) {
					designStore.applyOrderedBeads(resolved.beads.filter(Boolean) as NonNullable<(typeof resolved.beads)[number]>[], {
						source: 'plaza', handCircumferenceCm: resolved.payload.wristCm, hasUnavailableParts: false,
					});
					exactApplied = true;
				}
			} catch {}
		}
		if (!exactApplied) designStore.applyDesignFromPlaza(current.composition, {
			source: 'plaza', handCircumferenceCm: current.handCircumferenceCm ?? current.wristCm,
			hasUnavailableParts: current.hasUnavailableParts,
		});
		materialsStore.setCategory('in-use');
		uni.showToast({ title: '使用设计成功', icon: 'none' });
		setTimeout(() => {
			openDesignStudio('bracelet');
		}, 420);
	};
	try {
		if (fromInspiration.value) await api.useInspiration(current.id);
		else await api.useDesign(current.id);
		await applyCurrentDesign();
	} catch (_e) {
		// 仍可套用本地数据
		await applyCurrentDesign();
	}
}

function loadFavorites() {
	favoriteIds.value = loadFavoriteDesignIds();
}

function isFavorite() {
	return !!detail.value && (favoriteIds.value.includes(detail.value.id) || isFavoriteDesign(detail.value.id));
}

function toggleFavorite() {
	if (!detail.value) return;
	const wasFavorite = isFavorite();
	if (wasFavorite) {
		removeFavoriteDesign(detail.value.id);
	} else {
		saveFavoriteDesign(detail.value);
	}
	loadFavorites();
	uni.showToast({ title: wasFavorite ? '已取消收藏' : '已收藏', icon: 'none' });
}

async function saveToMyDesign() {
	if (!detail.value) return;
	if (!detailHasComposition.value) {
		uni.showToast({ title: '暂无可保存设计', icon: 'none' });
		return;
	}
	if (!savedStore.loaded) {
		await savedStore.fetchList();
	}
	designStore.applyDesignFromPlaza(detail.value.composition);
	const saved = savedStore.add(`${detail.value.title} · 可编辑`, designStore.braceletDesign);
	if (!saved) {
		uni.showToast({ title: '设计槽位已满', icon: 'none' });
		return;
	}
	uni.showToast({ title: '已保存到我的设计', icon: 'success' });
}

function designEstimatedCircumference(current: DesignDetail) {
	if (current.handCircumferenceCm) return current.handCircumferenceCm;
	return Number(current.composition.reduce((sum, row) => sum + (row.size / 10) * Math.max(1, row.quantity), 0).toFixed(1));
}

function designCartItem(): CartItem | null {
	if (!detail.value?.composition?.length) return null;
	const current = detail.value;
	const composition = cloneComposition(current.composition);
	const count = compositionBeadCount(composition);
	return {
		id: `cart-design-${current.id}-${Date.now()}`,
		kind: 'custom',
		name: `${current.title} · ${count}颗珠`,
		image: current.image || composition.find((row) => row.image)?.image || '',
		price: Number(totalPrice.value.toFixed(1)),
		qty: 1,
		type: '广场设计',
		handCircumferenceCm: current.handCircumferenceCm,
		estimatedCircumferenceCm: designEstimatedCircumference(current),
		composition,
	};
}

function addDesignToCart() {
	const item = designCartItem();
	if (!item) {
		uni.showToast({ title: '暂无可购买设计', icon: 'none' });
		return;
	}
	addLocalCartItems([item]);
	uni.showToast({ title: '已加入购物车', icon: 'success' });
}

function checkoutDesignDetail() {
	const item = designCartItem();
	if (!item) {
		uni.showToast({ title: '暂无可结算设计', icon: 'none' });
		return;
	}
	saveCheckoutDraft('buy-now', [item], [item.id]);
	uni.navigateTo({ url: '/pages/checkout/checkout' });
}

function changeBuyQty(delta: number) {
	buyQty.value = Math.max(1, buyQty.value + delta);
}

function selectProductSize(size: string) {
	selectedSize.value = size;
}

function refreshCheckoutAddresses() {
	checkoutAddresses.value = loadCheckoutAddresses();
}

function openAddressSelect(options?: { returnToCheckout?: boolean }) {
	const returnToCheckout = options?.returnToCheckout === true;
	const query = returnToCheckout ? '&returnTo=checkout' : '';
	uni.navigateTo({ url: `/pages/profile/address?select=1${query}` });
}

function productCartItem(): CartItem | null {
	if (!product.value) return null;
	const specText = selectedSize.value || product.value.sizes[0] || '';
	return {
		id: `cart-product-${product.value.id}-${specText || 'default'}`,
		kind: 'product',
		productId: product.value.id,
		name: product.value.name,
		image: product.value.listImage || product.value.image,
		price: product.value.price,
		qty: buyQty.value,
		type: product.value.type,
		spec: specText,
	};
}

function addProductToCart() {
	const item = productCartItem();
	if (!item) return;
	addLocalCartItems([item]);
	uni.showToast({ title: '已加入购物车', icon: 'success' });
}

function buyNow() {
	const item = productCartItem();
	if (!item) return;
	saveCheckoutDraft('buy-now', [item], [item.id], productNote.value);
	if (!selectedAddress.value) {
		uni.showToast({ title: '请先添加收货地址', icon: 'none' });
		setTimeout(() => {
			openAddressSelect({ returnToCheckout: true });
		}, 180);
		return;
	}
	uni.navigateTo({ url: '/pages/checkout/checkout' });
}

function detailPreviewBeadStyle(index: number, total: number) {
	const count = Math.max(total, 1);
	const angle = index * (360 / count);
	return {
		transform: `rotate(${angle}deg) translateX(54rpx) rotate(${-angle}deg)`,
	};
}

function contactService() {
	supportOpen.value = true;
}

function closeSupport() {
	supportOpen.value = false;
}

function copyServiceId() {
	uni.setClipboardData({
		data: serviceId.value,
		success: () => {
			uni.showToast({ title: '已复制客服号', icon: 'none' });
		},
	});
}

function goHelpCenter() {
	closeSupport();
	const currentId = product.value?.id || detail.value?.id || '';
	const query = currentId ? `?support=1&order=${encodeURIComponent(currentId)}` : '?support=1';
	uni.navigateTo({ url: `/pages/profile/help${query}` });
}

function goBack() {
	uni.navigateBack({
		fail: () => {
			if (product.value) {
				uni.navigateTo({ url: '/pages/goods/search/search' });
				return;
			}
			uni.navigateTo({ url: '/pages/plaza/plaza' });
		},
	});
}
</script>

<template>
	<view class="page app-subpage goods-detail-page">
		<!-- #ifdef H5 -->
		<MiniProgramCapsule />
		<!-- #endif -->
		<view class="goods-detail-nav">
			<view class="nav-side">
				<view class="nav-back" @tap="goBack">‹</view>
			</view>
			<view class="nav-title">{{ detailPageTitle }}</view>
			<view class="nav-side nav-side--right" />
		</view>

		<view v-if="loading" class="loading">加载中...</view>
			<template v-else-if="product">
				<view class="shop-hero">
					<swiper
						v-if="productHeroImages.length > 1"
						class="shop-hero-swiper"
						:circular="true"
						:indicator-dots="true"
						indicator-color="rgba(255, 255, 255, 0.42)"
						indicator-active-color="#fff"
					>
						<swiper-item v-for="img in productHeroImages" :key="img">
							<image class="shop-hero-img" :src="img" mode="aspectFill" />
						</swiper-item>
					</swiper>
					<image v-else class="shop-hero-img" :src="productHeroImage" mode="aspectFill" />
				</view>
			<view class="shop-section shop-title-section">
				<view class="shop-title-row">
					<view class="shop-title">{{ product.name }}</view>
					<view class="shop-type">{{ product.type }}</view>
				</view>
			</view>
			<view class="shop-section shop-size-section">
				<view class="shop-field-title">珠子大小</view>
				<view class="size-row">
					<view
						v-for="size in product.sizes"
						:key="size"
						class="size-chip"
						:class="{ active: selectedSize === size }"
						@tap="selectProductSize(size)"
					>
						{{ size }}
					</view>
				</view>
			</view>
			<view class="shop-section qty-section">
				<view>
					<view class="shop-field-title">购买数量</view>
					<view class="selected-size">已选：{{ selectedSpecLabel }}</view>
				</view>
				<view class="qty-control">
					<view class="qty-btn" :class="{ 'qty-btn--disabled': buyQty <= 1 }" @tap="changeBuyQty(-1)">−</view>
					<view class="qty-value">{{ buyQty }}</view>
					<view class="qty-btn qty-btn--plus" @tap="changeBuyQty(1)">＋</view>
				</view>
			</view>
			<view class="shop-detail-card">
				<view class="shop-detail-heading">商品详情</view>
				<view class="shop-detail-name">{{ product.name }}</view>
				<view class="shop-detail-text">{{ product.description }}</view>
			</view>
			<view class="shop-fee-card">
				<view class="shop-detail-heading">费用明细</view>
				<view class="fee-row">
					<text>商品小计</text>
					<text>{{ productTotalPriceText }}</text>
				</view>
				<view class="fee-row">
					<view class="fee-label">
						<text>运费</text>
						<view class="fee-help" aria-hidden="true" />
					</view>
					<text>{{ freightText }}</text>
				</view>
				<view class="fee-total">
					<text>合计：</text>
					<text>{{ productTotalPriceText }}元</text>
				</view>
			</view>
			<view class="shop-address-card" @tap="openAddressSelect">
				<view class="address-pin" />
				<view v-if="selectedAddress" class="address-copy">
					<view class="address-title">{{ selectedAddress.name }} {{ selectedAddress.phone }}</view>
					<view class="address-sub">{{ addressSummaryText }}</view>
				</view>
				<view v-else class="address-copy">
					<view class="address-title">暂无收货地址</view>
					<view class="address-sub">立即添加收货地址</view>
				</view>
				<view class="address-arrow">›</view>
			</view>
			<view class="shop-note-section">
				<view class="shop-note-head">
					<view class="shop-note-title">备注</view>
					<view class="shop-note-count">{{ productNoteCount }}/45</view>
				</view>
				<input
					v-model="productNote"
					class="shop-note-input"
					maxlength="45"
					placeholder="选填、给商家留言"
				/>
			</view>
			<view class="shop-footer">
				<view class="footer-mini" @tap="contactService">
					<view class="footer-mini-icon footer-mini-icon--service">
						<view class="service-band" />
						<view class="service-ear service-ear--left" />
						<view class="service-ear service-ear--right" />
						<view class="service-mic" />
					</view>
					<view class="footer-mini-text">客服</view>
				</view>
				<view class="footer-mini" @tap="addProductToCart">
					<view class="footer-mini-icon footer-mini-icon--cart">
						<view class="cart-basket-mini" />
						<view class="cart-handle-mini" />
						<view class="cart-wheel-mini cart-wheel-mini--left" />
						<view class="cart-wheel-mini cart-wheel-mini--right" />
					</view>
					<view class="footer-mini-text">加购物车</view>
				</view>
				<button class="buy-btn" @tap="buyNow">
					<text>¥ {{ productTotalPrice }} 立即购买</text>
					<text class="buy-sub">{{ productBuySubText }}</text>
				</button>
			</view>
		</template>
		<template v-else-if="detail">
			<view class="main-img-wrap design-detail-hero">
				<swiper
					v-if="detail.images?.length"
					class="main-swiper"
					:circular="true"
					:indicator-dots="detail.images.length > 1"
					indicator-color="rgba(30,35,44,0.18)"
					indicator-active-color="#fff"
				>
					<swiper-item v-for="img in detail.images" :key="img">
						<image class="main-img" :src="img" mode="aspectFill" />
					</swiper-item>
				</swiper>
				<image v-else class="main-img" :src="detail.image" mode="aspectFill" />
			</view>
			<view class="section design-title-section">
				<view class="title-row">
					<view class="title-copy">
						<view class="title">{{ detail.title }}</view>
						<view class="author">作者{{ detailAuthorText }}</view>
						<view class="usage">{{ detail.usageCount }}人使用过</view>
					</view>
					<view class="detail-bracelet-preview">
						<view class="detail-bracelet-ring">
							<image
								v-for="(row, index) in detail.composition"
								:key="`${row.materialId}-${index}`"
								class="detail-bracelet-bead"
								:src="row.image"
								mode="aspectFill"
								:style="detailPreviewBeadStyle(index, detail.composition.length)"
							/>
							<view class="detail-bracelet-logo">珠岛</view>
						</view>
					</view>
				</view>
			</view>
			<view class="section design-table-section">
				<view class="table-title">设计构成</view>
				<view class="table">
					<view v-if="detailHasComposition" class="table-head">
						<text class="col name">材料名称</text>
						<text class="col price">单价</text>
						<text class="col qty">数量</text>
						<text class="col amount">金额</text>
					</view>
					<view
						v-for="(row, i) in detail.composition"
						:key="i"
						class="table-row"
					>
						<text class="col name">{{ row.name }}</text>
						<text class="col price">{{ row.price }}</text>
						<text class="col qty">{{ row.quantity }}</text>
						<text class="col amount">{{ (row.price * row.quantity).toFixed(1) }}</text>
					</view>
					<view v-if="detailHasComposition" class="table-total">
						<text>合计：{{ totalPrice.toFixed(1) }}</text>
					</view>
					<view v-else class="table-empty">
						<view class="table-empty-title">暂无材质清单</view>
						<view class="table-empty-sub">这条收藏仅保留实物图和灵感信息，可联系客服确认具体搭配。</view>
					</view>
				</view>
				<view class="detail-hint">
					{{ detailHasComposition ? '点击右下角“使用该设计”，基于此设计开始创作！' : '当前灵感暂不可直接套用，可继续收藏或返回广场选择完整设计。' }}
				</view>
			</view>
			<view v-if="fromInspiration" class="footer inspiration-footer">
				<button class="btn-inspiration-use" :class="{ 'btn-inspiration-use--disabled': !detailHasComposition }" @tap="useDesign">使用该设计</button>
			</view>
			<view v-else class="footer design-footer">
				<view class="design-actions">
					<view class="design-action" :class="{ active: isFavorite() }" @tap="toggleFavorite">
						<view class="design-action-icon design-action-icon--favorite" />
						<text>{{ favoriteLabel }}</text>
					</view>
					<view class="design-action" @tap="saveToMyDesign">
						<view class="design-action-icon design-action-icon--save" />
						<text>保存</text>
					</view>
					<view class="design-action" :class="{ 'design-action--disabled': !detailHasComposition }" @tap="useDesign">
						<view class="design-action-icon design-action-icon--use" />
						<text>使用</text>
					</view>
				</view>
				<view v-if="detailHasComposition" class="design-purchase-actions">
					<button class="btn-design-cart" @tap="addDesignToCart">加入购物车</button>
					<button class="btn-design-buy" @tap="checkoutDesignDetail">
						<text>¥{{ totalPrice.toFixed(1) }}</text>
						<text>立即结算</text>
					</button>
				</view>
				<button v-else class="btn-use btn-use--disabled" @tap="useDesign">
					{{ designUseButtonLabel }}
				</button>
			</view>
		</template>
		<view v-else class="empty">未找到该设计</view>

		<view v-if="supportOpen" class="support-mask" @tap="closeSupport">
			<view class="support-sheet" @tap.stop>
				<view class="support-handle" />
				<view class="support-head">
					<view>
						<view class="support-title">联系客服</view>
						<view class="support-sub">{{ serviceContactContent }}</view>
					</view>
					<view class="support-close" @tap="closeSupport">×</view>
				</view>
				<view class="support-body">
					<view class="support-card">
						<view class="support-card__icon">石</view>
						<view class="support-card__copy">
							<view class="support-label">客服号</view>
							<view class="support-id">{{ serviceId }}</view>
							<view class="support-tip">{{ supportContextText }}</view>
						</view>
					</view>
					<view class="support-actions">
						<button class="support-action primary" @tap="copyServiceId">复制客服号</button>
						<button class="support-action ghost" @tap="goHelpCenter">帮助中心</button>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	background: #fff;
	padding: calc(118rpx + env(safe-area-inset-top)) 0 210rpx;
}

.goods-detail-nav {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 20;
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
:global(uni-app:has(.goods-detail-page) uni-tabbar),
:global(uni-app:has(.goods-detail-page) .uni-tabbar-bottom) {
	display: none;
}

:global(uni-page-body:has(> .goods-detail-page)) {
	min-height: 100%;
	padding-bottom: 0 !important;
}
/* #endif */

.loading,
.empty {
	text-align: center;
	padding: 48rpx;
	color: #999;
}

.shop-hero {
	position: relative;
	width: 100%;
	aspect-ratio: 1;
	background: #f3f3f4;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.shop-hero-img {
	width: 100%;
	height: 100%;
}

.shop-hero-swiper {
	width: 100%;
	height: 100%;
}

.shop-section {
	background: #fff;
	padding: 22rpx 32rpx;
}

.shop-title-section {
	border-top: 1rpx solid #f0f0f2;
	padding-top: 30rpx;
	padding-bottom: 34rpx;
}

.shop-title-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
}

.shop-title {
	flex: 1;
	min-width: 0;
	font-size: 39rpx;
	line-height: 1.25;
	font-weight: 900;
	color: #101216;
}

.shop-type {
	height: 38rpx;
	line-height: 38rpx;
	margin-top: 4rpx;
	padding: 0;
	border-radius: 4rpx;
	color: #90939b;
	font-size: 28rpx;
	font-weight: 900;
	box-sizing: border-box;
	flex-shrink: 0;
}

.shop-size-section {
	padding-top: 18rpx;
	padding-bottom: 36rpx;
	border-top: 0;
}

.shop-field-title {
	font-size: 30rpx;
	font-weight: 900;
	color: #32353d;
}

.size-row {
	display: flex;
	flex-wrap: wrap;
	gap: 18rpx;
	margin-top: 22rpx;
}

.size-chip {
	min-width: 116rpx;
	height: 66rpx;
	line-height: 66rpx;
	padding: 0 24rpx;
	border-radius: 8rpx;
	background: #f4f4f5;
	color: #5f636d;
	font-size: 28rpx;
	font-weight: 800;
	text-align: center;
	box-sizing: border-box;
}

.size-chip.active {
	background: #d92733;
	color: #fff;
	box-shadow: 0 8rpx 18rpx rgba(217, 39, 51, 0.22);
}

.qty-section {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding-top: 28rpx;
	padding-bottom: 236rpx;
}

.selected-size {
	margin-top: 14rpx;
	color: #8b8e97;
	font-size: 24rpx;
	font-weight: 700;
}

.shop-choice-section {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	border-top: 14rpx solid #f6f6f8;
	cursor: pointer;
}

.choice-arrow {
	color: #b0b2b8;
	font-size: 42rpx;
	font-weight: 700;
	line-height: 1;
}

.qty-control {
	display: flex;
	align-items: center;
	gap: 26rpx;
}

.qty-btn {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	border: 4rpx solid #b8b8bd;
	color: #9b9da4;
	font-size: 36rpx;
	font-weight: 900;
	line-height: 48rpx;
	text-align: center;
	box-sizing: border-box;
}

.qty-btn--plus {
	border-color: #d92733;
	background: #d92733;
	color: #fff;
}

.qty-btn--disabled {
	opacity: 0.48;
}

.qty-value {
	min-width: 38rpx;
	text-align: center;
	font-size: 32rpx;
	font-weight: 900;
	color: #111318;
}

.shop-fee-card {
	margin: 18rpx 32rpx 0;
	padding: 30rpx 30rpx 26rpx;
	border-radius: 28rpx;
	background: #f6f6f7;
	box-sizing: border-box;
}

.fee-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	margin-top: 26rpx;
	color: #8b8e97;
	font-size: 26rpx;
	font-weight: 800;
	line-height: 1.25;
}

.fee-label {
	display: inline-flex;
	align-items: center;
	gap: 8rpx;
}

.fee-help {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22rpx;
	height: 22rpx;
	border: 2rpx solid #b7bac1;
	border-radius: 50%;
	color: #a1a4ac;
	font-size: 16rpx;
	font-weight: 900;
	line-height: 18rpx;
	text-align: center;
	box-sizing: border-box;
}

.fee-help::before {
	content: '?';
}

.fee-total {
	display: flex;
	align-items: baseline;
	justify-content: flex-end;
	gap: 2rpx;
	margin-top: 28rpx;
	color: #1b1d23;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1.2;
}

.shop-address-card {
	position: relative;
	display: flex;
	align-items: center;
	gap: 20rpx;
	margin: 22rpx 32rpx 0;
	min-height: 112rpx;
	padding: 20rpx 0;
	box-sizing: border-box;
}

.shop-address-card::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	bottom: -2rpx;
	height: 5rpx;
	background: repeating-linear-gradient(135deg, #df6a70 0 5rpx, transparent 5rpx 10rpx);
	opacity: 0.72;
}

.shop-address-card:active {
	opacity: 0.72;
}

.address-pin {
	position: relative;
	width: 44rpx;
	height: 54rpx;
	flex-shrink: 0;
}

.address-pin::before {
	content: '';
	position: absolute;
	left: 6rpx;
	top: 0;
	width: 32rpx;
	height: 32rpx;
	border: 5rpx solid #1e222b;
	border-radius: 50% 50% 50% 0;
	transform: rotate(-45deg);
	box-sizing: border-box;
}

.address-pin::after {
	content: '';
	position: absolute;
	left: 18rpx;
	top: 12rpx;
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #1e222b;
}

.address-copy {
	flex: 1;
	min-width: 0;
}

.address-title {
	color: #22252d;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.25;
}

.address-sub {
	margin-top: 8rpx;
	color: #a0a3aa;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.address-arrow {
	color: #b7bac2;
	font-size: 44rpx;
	font-weight: 700;
	line-height: 1;
	flex-shrink: 0;
}

.shop-note-section {
	padding: 42rpx 32rpx 50rpx;
	background: #fff;
	box-sizing: border-box;
}

.shop-note-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.shop-note-title {
	color: #22252d;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.2;
}

.shop-note-count {
	color: #a0a3aa;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.2;
}

.shop-note-input {
	width: 100%;
	height: 60rpx;
	margin-top: 12rpx;
	padding: 0;
	color: #22252d;
	font-size: 27rpx;
	font-weight: 700;
	line-height: 60rpx;
	box-sizing: border-box;
}

.shop-detail-card {
	margin: 22rpx 32rpx 0;
	border-radius: 28rpx;
	background: #f6f6f7;
	padding: 30rpx 30rpx 34rpx;
	box-sizing: border-box;
}

.shop-detail-heading {
	color: #d92733;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.2;
}

.shop-detail-name {
	margin-top: 30rpx;
	color: #111318;
	font-size: 29rpx;
	font-weight: 900;
	line-height: 1.35;
}

.shop-detail-text {
	margin-top: 18rpx;
	color: #25272e;
	font-size: 28rpx;
	font-weight: 800;
	line-height: 1.45;
}

.shop-footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	min-height: 118rpx;
	padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
	background: #fff;
	border-top: 1rpx solid #ededf0;
	display: flex;
	align-items: center;
	gap: 22rpx;
	box-sizing: border-box;
	z-index: 8;
}

.footer-mini {
	width: 86rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4rpx;
	color: #2b2d33;
}

.footer-mini-icon {
	position: relative;
	width: 48rpx;
	height: 42rpx;
}

.footer-mini-text {
	font-size: 24rpx;
	font-weight: 800;
	white-space: nowrap;
}

.buy-btn {
	flex: 1;
	height: 94rpx;
	margin: 0;
	border: 2rpx solid #d92733;
	border-radius: 999rpx;
	background: #fff;
	color: #d92733;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	font-size: 30rpx;
	font-weight: 900;
	line-height: 1.1;
	box-sizing: border-box;
}

.buy-btn::after {
	border: 0;
}

.buy-sub {
	margin-top: 6rpx;
	font-size: 20rpx;
	font-weight: 800;
	color: #d92733;
}

.service-band {
	position: absolute;
	left: 7rpx;
	top: 4rpx;
	width: 30rpx;
	height: 30rpx;
	border: 4rpx solid #1f2127;
	border-bottom-color: transparent;
	border-radius: 28rpx 28rpx 0 0;
	box-sizing: border-box;
}

.service-ear {
	position: absolute;
	top: 20rpx;
	width: 8rpx;
	height: 16rpx;
	border-radius: 8rpx;
	background: #1f2127;
}

.service-ear--left {
	left: 4rpx;
}

.service-ear--right {
	right: 4rpx;
}

.service-mic {
	position: absolute;
	right: 8rpx;
	bottom: 5rpx;
	width: 14rpx;
	height: 4rpx;
	border-radius: 99rpx;
	background: #1f2127;
	transform: rotate(-18deg);
}

.cart-basket-mini {
	position: absolute;
	left: 8rpx;
	bottom: 8rpx;
	width: 32rpx;
	height: 18rpx;
	border: 4rpx solid #1f2127;
	border-top: 0;
	transform: skewX(-8deg);
	box-sizing: border-box;
}

.cart-handle-mini {
	position: absolute;
	left: 5rpx;
	top: 7rpx;
	width: 16rpx;
	height: 4rpx;
	border-radius: 99rpx;
	background: #1f2127;
	transform: rotate(14deg);
}

.cart-wheel-mini {
	position: absolute;
	bottom: 2rpx;
	width: 6rpx;
	height: 6rpx;
	border-radius: 50%;
	background: #1f2127;
}

.cart-wheel-mini--left {
	left: 14rpx;
}

.cart-wheel-mini--right {
	right: 9rpx;
}

.footer-mini:active,
.size-chip:active,
.qty-btn:active,
.buy-btn:active,
.support-action:active,
.design-action:active,
.btn-design-cart:active,
.btn-design-buy:active {
	opacity: 0.78;
}

.support-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 30;
	display: flex;
	align-items: flex-end;
	background: rgba(16, 18, 24, 0.42);
}

.support-sheet {
	width: 100%;
	padding: 16rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
	border-radius: 28rpx 28rpx 0 0;
	background: #fff;
	box-shadow: 0 -18rpx 54rpx rgba(19, 22, 29, 0.18);
	box-sizing: border-box;
}

.support-handle {
	width: 72rpx;
	height: 8rpx;
	margin: 0 auto 28rpx;
	border-radius: 999rpx;
	background: #d7d9de;
}

.support-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24rpx;
}

.support-title {
	color: #17191d;
	font-size: 34rpx;
	font-weight: 900;
	line-height: 1.2;
}

.support-sub {
	margin-top: 12rpx;
	color: #878b94;
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.45;
}

.support-close {
	width: 54rpx;
	height: 54rpx;
	border-radius: 50%;
	background: #f5f5f7;
	color: #6d717a;
	font-size: 42rpx;
	font-weight: 500;
	line-height: 48rpx;
	text-align: center;
	flex-shrink: 0;
}

.support-body {
	margin-top: 28rpx;
}

.support-card {
	display: flex;
	align-items: center;
	gap: 22rpx;
	padding: 24rpx;
	border-radius: 18rpx;
	background: #f7f7f8;
	box-sizing: border-box;
}

.support-card__icon {
	width: 76rpx;
	height: 76rpx;
	border-radius: 22rpx;
	background: #1f2128;
	color: #fff;
	font-size: 32rpx;
	font-weight: 900;
	line-height: 76rpx;
	text-align: center;
	flex-shrink: 0;
}

.support-card__copy {
	flex: 1;
	min-width: 0;
}

.support-label {
	color: #9b9fa8;
	font-size: 22rpx;
	font-weight: 800;
	line-height: 1.2;
}

.support-id {
	margin-top: 8rpx;
	color: #17191d;
	font-size: 36rpx;
	font-weight: 900;
	line-height: 1.12;
	letter-spacing: 0;
}

.support-tip {
	margin-top: 12rpx;
	color: #6f737c;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.45;
}

.support-actions {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 18rpx;
	margin-top: 24rpx;
}

.support-action {
	width: 100%;
	height: 88rpx;
	margin: 0;
	border-radius: 44rpx;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 88rpx;
	box-sizing: border-box;
}

.support-action::after {
	border: 0;
}

.support-action.primary {
	background: #d92733;
	color: #fff;
	border: 2rpx solid #d92733;
}

.support-action.ghost {
	background: #fff;
	color: #d92733;
	border: 2rpx solid #f0b9c0;
}

.main-img-wrap {
	width: 100%;
	background: #fff;
	height: 330rpx;
	overflow: hidden;
}

.design-detail-hero {
	background: #fff;
}

.main-swiper {
	width: 100%;
	height: 100%;
}

.main-img {
	width: 100%;
	height: 100%;
}

.section {
	background: #fff;
	margin-top: 0;
	padding: 28rpx 32rpx;
}

.title-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 24rpx;
}

.title-copy {
	flex: 1;
	min-width: 0;
}

.title {
	color: #17191d;
	font-size: 31rpx;
	font-weight: 900;
	line-height: 1.25;
}

.thumb {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	background: #f0f0f0;
	flex-shrink: 0;
}

.author {
	margin-top: 20rpx;
	color: #a2a5ad;
	font-size: 23rpx;
	font-weight: 700;
}

.usage {
	display: inline-block;
	margin-top: 36rpx;
	color: #31353d;
	font-size: 23rpx;
	font-weight: 800;
	text-decoration: underline;
	text-underline-offset: 8rpx;
}

.detail-bracelet-preview {
	width: 150rpx;
	height: 150rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.detail-bracelet-ring {
	position: relative;
	width: 126rpx;
	height: 126rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.detail-bracelet-bead {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 20rpx;
	height: 20rpx;
	margin: -10rpx 0 0 -10rpx;
	border-radius: 50%;
	box-shadow: 0 3rpx 7rpx rgba(35, 38, 45, 0.16);
}

.detail-bracelet-logo {
	width: 62rpx;
	color: #d7caca;
	font-size: 13rpx;
	font-weight: 900;
	line-height: 1.1;
	text-align: center;
}

.summary {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12rpx;
	margin-top: 20rpx;
}

.summary-item {
	background: #f7f8fc;
	border-radius: 16rpx;
	padding: 14rpx 10rpx;
	text-align: center;
}

.summary-num {
	display: block;
	font-size: 26rpx;
	font-weight: 800;
	color: #26314f;
}

.summary-label {
	display: block;
	margin-top: 4rpx;
	font-size: 20rpx;
	color: #8c93a7;
}

.table-title {
	color: #17191d;
	font-size: 30rpx;
	font-weight: 900;
	margin-bottom: 18rpx;
}

.table {
	border: 0;
	border-radius: 0;
	overflow: hidden;
	background: #f6f6f6;
}

.table-head,
.table-row {
	display: flex;
	align-items: center;
	min-height: 58rpx;
	padding: 0 24rpx;
	border-bottom: 0;
	color: #17191d;
	font-size: 25rpx;
	font-weight: 800;
	box-sizing: border-box;
}

.table-row:last-child {
	border-bottom: none;
}

.table-head {
	background: #f1f1f1;
	font-weight: 900;
	color: #333;
}

.table-empty {
	padding: 46rpx 28rpx;
	text-align: center;
	box-sizing: border-box;
}

.table-empty-title {
	color: #333743;
	font-size: 28rpx;
	font-weight: 900;
	line-height: 1.2;
}

.table-empty-sub {
	margin-top: 14rpx;
	color: #9a9da6;
	font-size: 23rpx;
	font-weight: 800;
	line-height: 1.45;
}

.col {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.col.name {
	flex: 1;
	min-width: 0;
}

.col.size {
	width: 66rpx;
	text-align: center;
}

.col.price {
	width: 92rpx;
	text-align: center;
}

.col.qty {
	width: 86rpx;
	text-align: center;
}

.col.amount {
	width: 108rpx;
	text-align: right;
}

.table-total {
	height: 70rpx;
	padding: 0 24rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	color: #17191d;
	font-size: 25rpx;
	font-weight: 900;
	box-sizing: border-box;
}

.detail-hint {
	margin-top: 22rpx;
	color: #aaadb4;
	font-size: 25rpx;
	font-weight: 800;
	text-align: center;
}

.footer {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 18rpx 24rpx;
	padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
	background: #fff;
	border-top: 0;
	display: flex;
	gap: 14rpx;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.inspiration-footer {
	justify-content: flex-end;
}

.btn-inspiration-use {
	width: 326rpx;
	height: 88rpx;
	margin: 0;
	padding: 0 32rpx;
	line-height: 84rpx;
	background: #fff;
	color: #d9485f;
	border: 2rpx solid #d9485f;
	border-radius: 44rpx;
	font-size: 30rpx;
	font-weight: 900;
	box-sizing: border-box;
}

.btn-inspiration-use--disabled {
	color: #9b9fa8;
	border-color: #d9dce2;
	background: #f7f8fa;
}

.design-actions {
	display: flex;
	align-items: center;
	gap: 8rpx;
	flex-shrink: 0;
}

.design-action {
	width: 80rpx;
	height: 88rpx;
	border-radius: 8rpx;
	background: #f7f7f9;
	color: #5f626b;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 7rpx;
	font-size: 20rpx;
	font-weight: 900;
	line-height: 1;
	box-sizing: border-box;
}

.design-action.active {
	background: #fff2f4;
	color: #d9485f;
}

.design-action--disabled {
	color: #aeb2ba;
	background: #f4f5f7;
}

.design-action-icon {
	position: relative;
	width: 32rpx;
	height: 32rpx;
	color: currentColor;
	flex-shrink: 0;
}

.design-action-icon--favorite::before,
.design-action-icon--favorite::after {
	content: '';
	position: absolute;
	left: 16rpx;
	top: 7rpx;
	width: 15rpx;
	height: 23rpx;
	border: 4rpx solid currentColor;
	border-left: 0;
	border-bottom: 0;
	border-radius: 14rpx 14rpx 0 0;
	transform: rotate(45deg);
	transform-origin: 0 100%;
	box-sizing: border-box;
}

.design-action-icon--favorite::after {
	left: 1rpx;
	transform: rotate(-45deg);
	transform-origin: 100% 100%;
}

.design-action-icon--save {
	border: 4rpx solid currentColor;
	border-radius: 4rpx;
	box-sizing: border-box;
}

.design-action-icon--save::before {
	content: '';
	position: absolute;
	left: 6rpx;
	right: 6rpx;
	top: 8rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: currentColor;
	box-shadow: 0 9rpx 0 currentColor;
}

.design-action-icon--use {
	border: 4rpx solid currentColor;
	border-radius: 50%;
	box-sizing: border-box;
}

.design-action-icon--use::before {
	content: '';
	position: absolute;
	left: 9rpx;
	top: 5rpx;
	width: 8rpx;
	height: 14rpx;
	border-right: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(45deg);
	box-sizing: border-box;
}

.design-purchase-actions {
	flex: 1;
	min-width: 0;
	display: grid;
	grid-template-columns: minmax(132rpx, 0.82fr) minmax(168rpx, 1fr);
	gap: 10rpx;
}

.btn-design-cart,
.btn-design-buy {
	width: 100%;
	height: 88rpx;
	margin: 0;
	padding: 0 8rpx;
	border-radius: 44rpx;
	font-size: 24rpx;
	font-weight: 900;
	line-height: 88rpx;
	white-space: nowrap;
	box-sizing: border-box;
}

.btn-design-cart {
	border: 2rpx solid #f1c5ce;
	background: #fff7f9;
	color: #d9485f;
}

.btn-design-buy {
	border: 2rpx solid #d9485f;
	background: #d9485f;
	color: #fff;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
	line-height: 1;
}

.btn-use {
	width: 326rpx;
	height: 88rpx;
	line-height: 84rpx;
	background: #fff;
	color: #d9485f;
	border: 2rpx solid #d9485f;
	border-radius: 44rpx;
	font-size: 30rpx;
	font-weight: 900;
	flex-shrink: 0;
}

.btn-use--disabled {
	color: #9b9fa8;
	border-color: #d9dce2;
	background: #f7f8fa;
}

.btn-secondary {
	width: 132rpx;
	height: 88rpx;
	line-height: 88rpx;
	background: #fff7f9;
	color: #d9485f;
	border: 2rpx solid #f1c5ce;
	border-radius: 44rpx;
	font-size: 26rpx;
	font-weight: 700;
}
</style>
