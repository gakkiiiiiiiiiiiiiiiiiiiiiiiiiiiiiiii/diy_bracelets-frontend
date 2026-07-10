import type { CartItem } from '@/api';

export type DesignEntrySource = 'bracelet' | 'single';

export const DESIGN_ENTRY_SOURCE_STORAGE_KEY = 'diy-bracelets-design-entry-source';
export const EDITING_SAVED_DESIGN_STORAGE_KEY = 'diy-bracelets-editing-saved-design-id';
export const EDITING_CART_ITEM_STORAGE_KEY = 'diy-bracelets-editing-cart-item-id';
const DESIGN_STUDIO_PATH = '/pages/design/design';

export function rememberDesignEntrySource(source: DesignEntrySource) {
	try {
		uni.setStorageSync(DESIGN_ENTRY_SOURCE_STORAGE_KEY, source);
	} catch {}
}

export function designEntrySourceForCartItem(item?: Pick<CartItem, 'type' | 'name'> | null): DesignEntrySource {
	const label = `${item?.type ?? ''} ${item?.name ?? ''}`;
	return label.includes('单珠') ? 'single' : 'bracelet';
}

export function rememberEditingSavedDesign(id: string) {
	try {
		if (id) uni.setStorageSync(EDITING_SAVED_DESIGN_STORAGE_KEY, id);
	} catch {}
}

export function clearEditingSavedDesign() {
	try {
		uni.removeStorageSync(EDITING_SAVED_DESIGN_STORAGE_KEY);
	} catch {}
}

export function rememberEditingCartItem(id: string) {
	try {
		if (id) uni.setStorageSync(EDITING_CART_ITEM_STORAGE_KEY, id);
	} catch {}
}

export function clearEditingCartItem() {
	try {
		uni.removeStorageSync(EDITING_CART_ITEM_STORAGE_KEY);
	} catch {}
}

export function readEditingSavedDesignId() {
	try {
		return String(uni.getStorageSync(EDITING_SAVED_DESIGN_STORAGE_KEY) || '');
	} catch {
		return '';
	}
}

export function readEditingCartItemId() {
	try {
		return String(uni.getStorageSync(EDITING_CART_ITEM_STORAGE_KEY) || '');
	} catch {
		return '';
	}
}

export function openDesignStudio(
	source: DesignEntrySource = 'bracelet',
	options: { editingSavedDesignId?: string | null; editingCartItemId?: string | null } = {},
) {
	rememberDesignEntrySource(source);
	if (source === 'bracelet' && options.editingSavedDesignId) {
		rememberEditingSavedDesign(options.editingSavedDesignId);
	} else {
		clearEditingSavedDesign();
	}
	if (options.editingCartItemId) {
		rememberEditingCartItem(options.editingCartItemId);
	} else {
		clearEditingCartItem();
	}
	const tabUrl = DESIGN_STUDIO_PATH;
	const fallbackUrl = `${DESIGN_STUDIO_PATH}?source=${source}`;
	uni.switchTab({
		url: tabUrl,
		fail: () => {
			uni.reLaunch({
				url: fallbackUrl,
			});
		},
	});
}
