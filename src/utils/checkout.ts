import { api, getStoredUserId, type AddressRecord, type CartItem } from '@/api';
import { IS_MP_WEIXIN, USE_MOCK_API } from '@/config';
import { shopGoodsProducts } from '@/data/shopGoods';
import { cloneComposition } from '@/utils/designComposition';

export type CheckoutSource = 'cart' | 'buy-now';

export type CheckoutAddress = AddressRecord;

export interface CheckoutDraft {
	id: string;
	source: CheckoutSource;
	items: CartItem[];
	selectedIds: string[];
	note?: string;
	createdAt: string;
}

export const CART_STORAGE_KEY = 'diy-bracelets-cart';
const LEGACY_CART_STORAGE_KEYS = ['diy-bracelets-test-cart'];
export const ADDRESS_STORAGE_KEY = 'diy-bracelets-addresses';
export const CHECKOUT_DRAFT_KEY = 'diy-bracelets-checkout-draft';
const ADDRESS_MIGRATION_USER_KEY = 'diy-bracelets-address-migrated-user';
const CART_SYNC_PENDING_KEY = 'diy-bracelets-cart-sync-pending';
export const usesRemoteCommerce = IS_MP_WEIXIN && !USE_MOCK_API;
let pendingRemoteCart: CartItem[] | null = null;
let remoteCartSyncPromise: Promise<void> | null = null;

export function cloneCartItem(item: CartItem): CartItem {
	return {
		...item,
		kind: item.kind || (item.composition?.length ? 'custom' : 'product'),
		composition: cloneComposition(item.composition),
	};
}

export function saveCheckoutDraft(
	source: CheckoutSource,
	items: CartItem[],
	selectedIds: string[] = [],
	note = '',
) {
	const draft: CheckoutDraft = {
		id: `checkout-${Date.now()}`,
		source,
		items: items.map(cloneCartItem),
		selectedIds: selectedIds.length ? selectedIds : items.map((item) => item.id),
		note: note.trim(),
		createdAt: new Date().toISOString(),
	};
	uni.setStorageSync(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
	return draft;
}

export function loadCheckoutDraft(): CheckoutDraft | null {
	try {
		const raw = uni.getStorageSync(CHECKOUT_DRAFT_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (!cached || !Array.isArray(cached.items)) return null;
		return cached as CheckoutDraft;
	} catch {
		return null;
	}
}

export function clearCheckoutDraft() {
	uni.removeStorageSync(CHECKOUT_DRAFT_KEY);
}

export function loadLocalCartItems(): CartItem[] {
	try {
		const raw = readCartStorageValue();
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		const items = Array.isArray(cached) ? cached.map(cloneCartItem).map(normalizeShopCartItem) : [];
		migrateLegacyCartItems(items);
		return items;
	} catch {
		return [];
	}
}

export function cacheLocalCartItems(items: CartItem[]) {
	uni.setStorageSync(CART_STORAGE_KEY, JSON.stringify(items.map(cloneCartItem)));
	clearLegacyCartItems();
}

export function saveLocalCartItems(items: CartItem[]) {
	cacheLocalCartItems(items);
	if (usesRemoteCommerce) {
		uni.setStorageSync(CART_SYNC_PENDING_KEY, '1');
		void queueRemoteCartSync(items).catch((error) => {
			console.warn('[cart] 服务端同步失败，将在下次修改或进入购物车时重试', error);
		});
	}
}

function queueRemoteCartSync(items: CartItem[]): Promise<void> {
	pendingRemoteCart = items.map(cloneCartItem);
	if (!remoteCartSyncPromise) {
		remoteCartSyncPromise = drainRemoteCartQueue().finally(() => {
			remoteCartSyncPromise = null;
		});
	}
	return remoteCartSyncPromise;
}

async function drainRemoteCartQueue() {
	while (pendingRemoteCart) {
		const snapshot = pendingRemoteCart;
		pendingRemoteCart = null;
		try {
			await api.replaceCart(snapshot);
		} catch (error) {
			if (!pendingRemoteCart) pendingRemoteCart = snapshot;
			throw error;
		}
	}
	uni.removeStorageSync(CART_SYNC_PENDING_KEY);
}

export async function flushPendingRemoteCart() {
	if (!usesRemoteCommerce || !uni.getStorageSync(CART_SYNC_PENDING_KEY)) return;
	await queueRemoteCartSync(loadLocalCartItems());
}

export function addLocalCartItems(itemsToAdd: CartItem[]) {
	const existing = loadLocalCartItems();
	const next = [...existing];
	for (const item of itemsToAdd.map(cloneCartItem)) {
		const index = next.findIndex((row) => row.id === item.id);
		if (index >= 0) {
			next[index] = {
				...next[index],
				...item,
				qty: Number(next[index].qty || 1) + Number(item.qty || 1),
			};
		} else {
			next.unshift(item);
		}
	}
	saveLocalCartItems(next);
	return next;
}

export function removeLocalCartItems(ids: string[]) {
	const checked = new Set(ids);
	const next = loadLocalCartItems().filter((item) => !checked.has(item.id));
	saveLocalCartItems(next);
	return next;
}

function normalizeShopCartItem(item: CartItem): CartItem {
	if (!item.id.startsWith('cart-product-')) {
		return { ...item, kind: item.kind || 'custom' };
	}
	const product = shopGoodsProducts.find((entry) => item.id.startsWith(`cart-product-${entry.id}-`));
	if (!product) return item;
	return {
		...item,
		kind: 'product',
		productId: product.id,
		name: product.name,
		image: product.listImage || product.image,
		price: product.price,
		type: product.type,
		spec: item.spec || product.sizes[0] || '',
	};
}

function readCartStorageValue() {
	const current = uni.getStorageSync(CART_STORAGE_KEY);
	if (current !== '' && current != null) return current;
	for (const key of LEGACY_CART_STORAGE_KEYS) {
		const legacy = uni.getStorageSync(key);
		if (legacy !== '' && legacy != null) return legacy;
	}
	return '';
}

function migrateLegacyCartItems(items: CartItem[]) {
	if (!items.length) return;
	try {
		const current = uni.getStorageSync(CART_STORAGE_KEY);
		if (current === '' || current == null) {
			uni.setStorageSync(CART_STORAGE_KEY, JSON.stringify(items.map(cloneCartItem)));
		}
		clearLegacyCartItems();
	} catch {}
}

function clearLegacyCartItems() {
	for (const key of LEGACY_CART_STORAGE_KEYS) {
		try {
			uni.removeStorageSync(key);
		} catch {}
	}
}

export function loadCheckoutAddresses(): CheckoutAddress[] {
	try {
		const raw = uni.getStorageSync(ADDRESS_STORAGE_KEY);
		const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(cached) ? cached : [];
	} catch {
		return [];
	}
}

export function saveCheckoutAddressesCache(addresses: CheckoutAddress[]) {
	uni.setStorageSync(ADDRESS_STORAGE_KEY, JSON.stringify(addresses));
}

export async function loadCheckoutAddressesRemote(): Promise<CheckoutAddress[]> {
	const local = loadCheckoutAddresses();
	if (!usesRemoteCommerce) return local;
	try {
		let remote = await api.getAddresses();
		const userId = getStoredUserId();
		const migratedUser = String(uni.getStorageSync(ADDRESS_MIGRATION_USER_KEY) || '');
		if (!remote.length && local.length && userId && !migratedUser) {
			for (const address of local) {
				await api.createAddress({
					name: address.name,
					phone: address.phone,
					region: address.region,
					detail: address.detail,
					isDefault: address.isDefault,
				});
			}
			remote = await api.getAddresses();
		}
		if (userId) uni.setStorageSync(ADDRESS_MIGRATION_USER_KEY, userId);
		saveCheckoutAddressesCache(remote);
		return remote;
	} catch (error) {
		console.warn('[address] 服务端地址加载失败，暂时显示本机缓存', error);
		return local;
	}
}

export function defaultCheckoutAddress(addresses: CheckoutAddress[]) {
	return addresses.find((address) => address.isDefault) || addresses[0] || null;
}
