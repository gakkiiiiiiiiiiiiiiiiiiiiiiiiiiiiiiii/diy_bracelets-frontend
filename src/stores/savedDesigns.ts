import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BraceletBead } from '@/types';
import type { DesignCompositionRow, MyDesignFromApi } from '@/api';
import { api } from '@/api';
import { mockMyDesigns } from '@/data/mock';
import { beadsToComposition } from '@/utils/designComposition';
import { usesRemoteCommerce } from '@/utils/checkout';

const STORAGE_KEY = 'diy-bracelets-saved-list';
export const MAX_SAVED_DESIGN_SLOTS = 10;

export interface SavedDesign {
	id: string;
	title: string;
	beads: BraceletBead[];
	updatedAt: string;
}

function beadFromComposition(row: DesignCompositionRow, orderIndex: number): BraceletBead {
	return {
		id: `bead-${orderIndex}`,
		materialId: row.materialId,
		name: row.name,
		image: row.image,
		size: row.size,
		price: row.price,
		specId: row.specId,
		quantity: 1,
		orderIndex,
	};
}

function compositionToBeads(
	composition: DesignCompositionRow[],
	orderedBeads?: Array<{ materialId: string; specId: string }> | null,
): BraceletBead[] {
	if (orderedBeads?.length) {
		const exact = new Map(composition
			.filter((row) => row.specId)
			.map((row) => [`${row.materialId}\u0000${row.specId}`, row]));
		const restored = orderedBeads.map((bead, orderIndex) => {
			const row = exact.get(`${bead.materialId}\u0000${bead.specId}`);
			return row ? beadFromComposition(row, orderIndex) : null;
		});
		if (restored.every((bead) => bead !== null)) return restored as BraceletBead[];
	}
	const beads: BraceletBead[] = [];
	let orderIndex = 0;
	for (const row of composition || []) {
		for (let i = 0; i < (row.quantity || 1); i++) {
			beads.push(beadFromComposition(row, orderIndex));
			orderIndex += 1;
		}
	}
	return beads;
}

function fromApi(item: MyDesignFromApi): SavedDesign {
	return {
		id: item.id,
		title: item.title,
		beads: compositionToBeads(item.composition, item.orderedBeads),
		updatedAt: item.updatedAt,
	};
}

function exactOrder(beads: BraceletBead[]): Array<{ materialId: string; specId: string }> | null {
	const ordered = beads.map((bead) => bead.specId
		? { materialId: bead.materialId, specId: bead.specId }
		: null);
	return ordered.every((bead) => bead !== null)
		? ordered as Array<{ materialId: string; specId: string }>
		: null;
}

function loadListFromStorage(): SavedDesign[] | null {
	try {
		const raw = uni.getStorageSync(STORAGE_KEY);
		if (raw === '' || raw == null) return null;
		const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(list) ? list : null;
	} catch {
		return null;
	}
}

export const useSavedDesignsStore = defineStore('savedDesigns', () => {
	const list = ref<SavedDesign[]>([]);
	const loaded = ref(false);

	const hasItems = computed(() => list.value.length > 0);
	const isFull = computed(() => list.value.length >= MAX_SAVED_DESIGN_SLOTS);

	/** 生产模式以后端为准；断网时只展示当前用户最近一次成功同步的缓存。 */
	async function fetchList() {
		try {
			const data = await api.getMyDesigns();
			list.value = (Array.isArray(data) ? data : []).map(fromApi);
			loaded.value = true;
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			return true;
		} catch (_e) {
			const stored = loadListFromStorage();
			list.value = stored ?? (usesRemoteCommerce ? [] : mockMyDesigns.map(fromApi));
			loaded.value = true;
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			return false;
		}
	}

	async function add(title: string, beads: BraceletBead[]): Promise<SavedDesign | null> {
		if (isFull.value) return null;
		const composition = beadsToComposition(beads);
		if (usesRemoteCommerce) {
			const orderedBeads = exactOrder(beads);
			const saved = fromApi(await api.createMyDesign({ title, composition, ...(orderedBeads ? { orderedBeads } : {}) }));
			list.value = [saved, ...list.value];
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			return saved;
		}
		const item: SavedDesign = {
			id: `local-${Date.now()}`,
			title,
			beads: JSON.parse(JSON.stringify(beads)),
			updatedAt: new Date().toISOString(),
		};
		list.value = [item, ...list.value];
		uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
		return item;
	}

	async function update(id: string, beads: BraceletBead[], title?: string): Promise<SavedDesign | null> {
		const index = list.value.findIndex((d) => d.id === id);
		if (index < 0) return null;
		const current = list.value[index];
		if (usesRemoteCommerce) {
			const orderedBeads = exactOrder(beads);
			const updated = fromApi(await api.updateMyDesign(id, {
				title: title ?? current.title,
				composition: beadsToComposition(beads),
				...(orderedBeads ? { orderedBeads } : {}),
			}));
			list.value = list.value.map((item) => (item.id === id ? updated : item));
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			return updated;
		}
		const next: SavedDesign = {
			...current,
			title: title ?? current.title,
			beads: JSON.parse(JSON.stringify(beads)),
			updatedAt: new Date().toISOString(),
		};
		list.value = [
			next,
			...list.value.slice(0, index),
			...list.value.slice(index + 1),
		];
		uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
		return next;
	}

	async function remove(id: string) {
		if (usesRemoteCommerce) await api.deleteMyDesign(id);
		list.value = list.value.filter((d) => d.id !== id);
		uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
	}

	function get(id: string): SavedDesign | undefined {
		return list.value.find((d) => d.id === id);
	}

	/** 返回该设计的珠子列表（复制并生成新 id，供 designStore 使用） */
	function getBeadsForDesign(id: string): BraceletBead[] {
		const item = get(id);
		if (!item || !item.beads.length) return [];
		return item.beads.map((b, i) => ({
			...b,
			id: `bead-saved-${Date.now()}-${i}`,
			orderIndex: i,
		}));
	}

	return {
		list: computed(() => list.value),
		hasItems,
		isFull,
		loaded: computed(() => loaded.value),
		fetchList,
		add,
		update,
		remove,
		get,
		getBeadsForDesign,
	};
});
