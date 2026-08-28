import type { DesignDetail } from '@/api';
import { USE_MOCK_API } from '@/config';
import { mockDesignDetails } from '@/data/mock';

export const FAVORITE_DESIGN_IDS_KEY = 'diy-bracelets-favorite-plaza';
const FAVORITE_DESIGN_RECORDS_KEY = 'diy-bracelets-favorite-plaza-records';

type FavoriteDesignRecord = DesignDetail & {
	favoritedAt?: string;
};

function readJson<T>(key: string, fallback: T): T {
	try {
		const raw = uni.getStorageSync(key);
		if (raw === '' || raw == null) return fallback;
		return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
	} catch {
		return fallback;
	}
}

function uniqueIds(ids: unknown[]) {
	const seen = new Set<string>();
	return ids
		.map((id) => String(id || '').trim())
		.filter((id) => {
			if (!id || seen.has(id)) return false;
			seen.add(id);
			return true;
		});
}

export function loadFavoriteDesignIds() {
	const cached = readJson<unknown[]>(FAVORITE_DESIGN_IDS_KEY, []);
	return Array.isArray(cached) ? uniqueIds(cached) : [];
}

function saveFavoriteDesignIds(ids: string[]) {
	uni.setStorageSync(FAVORITE_DESIGN_IDS_KEY, JSON.stringify(uniqueIds(ids)));
}

function loadFavoriteDesignRecordMap() {
	const cached = readJson<Record<string, FavoriteDesignRecord>>(FAVORITE_DESIGN_RECORDS_KEY, {});
	return cached && typeof cached === 'object' && !Array.isArray(cached) ? cached : {};
}

function saveFavoriteDesignRecordMap(records: Record<string, FavoriteDesignRecord>) {
	uni.setStorageSync(FAVORITE_DESIGN_RECORDS_KEY, JSON.stringify(records));
}

function cloneDesign(detail: DesignDetail): FavoriteDesignRecord {
	return {
		...detail,
		images: detail.images ? [...detail.images] : null,
		composition: detail.composition.map((row) => ({ ...row })),
		favoritedAt: new Date().toISOString(),
	};
}

export function loadFavoriteDesigns() {
	const ids = loadFavoriteDesignIds();
	const records = loadFavoriteDesignRecordMap();
	return ids
		.map((id) => records[id] ?? (USE_MOCK_API ? mockDesignDetails[id] : undefined))
		.filter((item): item is FavoriteDesignRecord => !!item);
}

export function isFavoriteDesign(id: string) {
	return !!id && loadFavoriteDesignIds().includes(id);
}

export function saveFavoriteDesign(detail: DesignDetail) {
	const records = loadFavoriteDesignRecordMap();
	records[detail.id] = cloneDesign(detail);
	saveFavoriteDesignRecordMap(records);
	saveFavoriteDesignIds([detail.id, ...loadFavoriteDesignIds()]);
}

export function removeFavoriteDesign(id: string) {
	const records = loadFavoriteDesignRecordMap();
	delete records[id];
	saveFavoriteDesignRecordMap(records);
	saveFavoriteDesignIds(loadFavoriteDesignIds().filter((item) => item !== id));
}

export function favoriteDesignCount() {
	return loadFavoriteDesigns().length;
}
