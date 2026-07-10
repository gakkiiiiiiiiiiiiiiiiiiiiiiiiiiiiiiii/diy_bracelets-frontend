import type { CartItem } from '@/api';
import { shopGoodsProducts } from '@/data/shopGoods';
import { cloneComposition } from '@/utils/designComposition';

export type CheckoutSource = 'cart' | 'buy-now';

export interface CheckoutAddress {
	id: string;
	name: string;
	phone: string;
	region: string;
	detail: string;
	isDefault: boolean;
}

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

export function cloneCartItem(item: CartItem): CartItem {
	return {
		...item,
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

export function saveLocalCartItems(items: CartItem[]) {
	uni.setStorageSync(CART_STORAGE_KEY, JSON.stringify(items.map(cloneCartItem)));
	clearLegacyCartItems();
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
	if (!item.id.startsWith('cart-product-')) return item;
	const product = shopGoodsProducts.find((entry) => item.id.startsWith(`cart-product-${entry.id}-`));
	if (!product) return item;
	return {
		...item,
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

export function defaultCheckoutAddress(addresses: CheckoutAddress[]) {
	return addresses.find((address) => address.isDefault) || addresses[0] || null;
}
