import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, type ShopProductAuthority } from '@/api';
import { USE_MOCK_API } from '@/config';
import { shopGoodsProducts, type ShopGoodsProduct } from '@/data/shopGoods';

const CACHE_KEY = 'diy-bracelets-shop-product-authority-v1';

function cloneLocalProducts(): ShopGoodsProduct[] {
	return shopGoodsProducts.map((product) => ({
		...product,
		sizes: [...product.sizes],
		images: product.images ? [...product.images] : undefined,
	}));
}

function readCache(): ShopProductAuthority[] | null {
	if (USE_MOCK_API) return null;
	try {
		const value = uni.getStorageSync(CACHE_KEY);
		if (!Array.isArray(value)) return null;
		return value as ShopProductAuthority[];
	} catch {
		return null;
	}
}

function writeCache(items: ShopProductAuthority[]) {
	try {
		uni.setStorageSync(CACHE_KEY, items);
	} catch {}
}

function mergeAuthority(items: ShopProductAuthority[]): ShopGoodsProduct[] {
	const authority = new Map(items.map((item) => [item.id, item]));
	return cloneLocalProducts()
		.filter((product) => authority.has(product.id))
		.map((product) => {
			const remote = authority.get(product.id)!;
			return {
				...product,
				categoryId: remote.categoryId,
				type: remote.type,
				name: remote.name,
				listImage: remote.image || product.listImage,
				price: remote.price,
				sizes: [...remote.sizes],
			};
		});
}

export const useShopCatalogStore = defineStore('shopCatalog', () => {
	const cached = readCache();
	const cachedProducts = cached?.length ? mergeAuthority(cached) : [];
	const products = ref<ShopGoodsProduct[]>(USE_MOCK_API ? cloneLocalProducts() : cachedProducts);
	const source = ref<'mock' | 'api' | 'cache' | 'unavailable'>(
		USE_MOCK_API ? 'mock' : cachedProducts.length ? 'cache' : 'unavailable',
	);
	const loaded = ref(USE_MOCK_API);
	const loading = ref(false);
	const loadError = ref('');
	let request: Promise<void> | null = null;

	function fetchFromApi(force = false): Promise<void> {
		if (USE_MOCK_API || (loaded.value && !force)) return Promise.resolve();
		if (request) return request;
		loading.value = true;
		loadError.value = '';
		request = api.getShopProducts()
			.then((response) => {
				if (!Array.isArray(response.items) || !response.items.length) throw new Error('商品目录为空');
				const merged = mergeAuthority(response.items);
				if (!merged.length) throw new Error('服务端商品目录与当前客户端不兼容');
				products.value = merged;
				source.value = 'api';
				writeCache(response.items);
			})
			.catch((error) => {
				const hasAuthoritativeData = source.value === 'api' || source.value === 'cache';
				source.value = hasAuthoritativeData ? 'cache' : 'unavailable';
				loadError.value = hasAuthoritativeData
					? '商品目录同步失败，正在使用上次成功数据'
					: '商品目录暂时无法同步，请检查网络后重试';
				console.warn('[shop-catalog] sync failed', error);
			})
			.finally(() => {
				loading.value = false;
				loaded.value = true;
				request = null;
			});
		return request;
	}

	function getById(id: string) {
		return products.value.find((product) => product.id === id) ?? null;
	}

	function getByCategory(categoryId: string) {
		return products.value.filter((product) => product.categoryId === categoryId);
	}

	return {
		products: computed(() => products.value),
		source: computed(() => source.value),
		loaded: computed(() => loaded.value),
		loading: computed(() => loading.value),
		loadError: computed(() => loadError.value),
		fetchFromApi,
		getById,
		getByCategory,
	};
});
