import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BraceletBead } from '@/types';
import type { DesignCompositionRow, MyDesignFromApi } from '@/api';
import { api } from '@/api';

const STORAGE_KEY = 'diy-bracelets-saved-list';

export interface SavedDesign {
	id: string;
	title: string;
	beads: BraceletBead[];
	updatedAt: string;
}

function compositionToBeads(composition: DesignCompositionRow[]): BraceletBead[] {
	const beads: BraceletBead[] = [];
	let orderIndex = 0;
	for (const row of composition || []) {
		for (let i = 0; i < (row.quantity || 1); i++) {
			beads.push({
				id: `bead-${orderIndex}`,
				materialId: row.materialId,
				name: row.name,
				image: row.image,
				size: row.size,
				price: row.price,
				quantity: 1,
				orderIndex,
			});
			orderIndex += 1;
		}
	}
	return beads;
}

function beadsToComposition(beads: BraceletBead[]): DesignCompositionRow[] {
	return beads.map((b) => ({
		materialId: b.materialId,
		name: b.name,
		image: b.image,
		size: b.size,
		price: b.price,
		quantity: 1,
	}));
}

function fromApi(item: MyDesignFromApi): SavedDesign {
	return {
		id: item.id,
		title: item.title,
		beads: compositionToBeads(item.composition),
		updatedAt: item.updatedAt,
	};
}

function loadListFromStorage(): SavedDesign[] {
	try {
		const raw = uni.getStorageSync(STORAGE_KEY);
		if (!raw) return [];
		const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

export const useSavedDesignsStore = defineStore('savedDesigns', () => {
	const list = ref<SavedDesign[]>([]);
	const loaded = ref(false);

	const hasItems = computed(() => list.value.length > 0);

	/** 从后端拉取列表；失败时回退到本地缓存 */
	async function fetchList() {
		try {
			const data = await api.getMyDesigns();
			list.value = (Array.isArray(data) ? data : []).map(fromApi);
			loaded.value = true;
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			return;
		} catch (_e) {
			// 后端未就绪或网络错误：使用本地缓存
			list.value = loadListFromStorage();
			loaded.value = true;
		}
	}

	function add(title: string, beads: BraceletBead[]): SavedDesign {
		const composition = beadsToComposition(beads);
		const item: SavedDesign = {
			id: '',
			title,
			beads: JSON.parse(JSON.stringify(beads)),
			updatedAt: new Date().toISOString(),
		};
		// 先乐观更新，再请求后端
		const tempId = `temp-${Date.now()}`;
		item.id = tempId;
		list.value = [item, ...list.value];
		api
			.createMyDesign({ title, composition })
			.then((res) => {
				list.value = list.value.map((d) =>
					d.id === tempId ? fromApi(res) : d,
				);
				uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			})
			.catch(() => {
				// 保持本地
				uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			});
		return item;
	}

	function remove(id: string) {
		const prev = [...list.value];
		list.value = list.value.filter((d) => d.id !== id);
		if (id.startsWith('temp-')) {
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
			return;
		}
		api.deleteMyDesign(id).catch(() => {
			list.value = prev;
			uni.setStorageSync(STORAGE_KEY, JSON.stringify(list.value));
		});
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
		loaded: computed(() => loaded.value),
		fetchList,
		add,
		remove,
		get,
		getBeadsForDesign,
	};
});
