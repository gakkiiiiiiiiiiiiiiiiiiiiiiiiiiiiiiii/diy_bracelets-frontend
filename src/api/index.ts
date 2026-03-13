import type { Material, MaterialCategory } from '@/types';
import { API_BASE } from '@/config';

const base = (API_BASE || '').replace(/\/$/, '');

/** 请求 URL：base 为空时用相对路径 path（H5 开发时代理转发）；base 有值时拼完整地址（小程序需配置完整域名） */
function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: object,
): Promise<T> {
  const url = path.startsWith('http') ? path : base ? `${base}${path}` : path;
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data: body,
      header:
        method !== 'GET' && body != null
          ? { 'Content-Type': 'application/json' }
          : undefined,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data =
              typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            resolve(data as T);
          } catch (e) {
            reject(new Error('接口返回非 JSON'));
          }
        } else {
          reject(new Error(`API ${path} ${res.statusCode}`));
        }
      },
      fail: (err) => reject(err),
    });
  });
}

export const api = {
  getCategories: () => request<MaterialCategory[]>(`/api/categories`),
  getMaterials: () => request<Material[]>(`/api/materials`),
  getHome: () => request<HomeData>(`/api/home`),
  /** 设计广场列表，tab=designer|user */
  getGoods: (tab?: 'designer' | 'user') =>
    request<GoodsData>(`/api/goods${tab ? `?tab=${tab}` : ''}`),
  getGoodsDetail: (id: string) => request<DesignDetail>(`/api/goods/${id}`),
  /** 使用该设计：usageCount+1，返回设计详情 */
  useDesign: (id: string) =>
    request<DesignDetail>(`/api/goods/${id}/use`, 'POST'),
  getCart: () => request<CartData>(`/api/cart`),
  getProfile: () => request<ProfileData>(`/api/profile`),
  /** 我的设计：列表、新增、更新、删除 */
  getMyDesigns: () => request<MyDesignFromApi[]>(`/api/my-designs`),
  getMyDesign: (id: string) =>
    request<MyDesignFromApi>(`/api/my-designs/${id}`),
  createMyDesign: (body: { title: string; composition: DesignCompositionRow[] }) =>
    request<MyDesignFromApi>(`/api/my-designs`, 'POST', body),
  updateMyDesign: (
    id: string,
    body: { title?: string; composition?: DesignCompositionRow[] },
  ) => request<MyDesignFromApi>(`/api/my-designs/${id}`, 'PATCH', body),
  deleteMyDesign: (id: string) =>
    request<void>(`/api/my-designs/${id}`, 'DELETE'),
};

export interface HomeTile {
  id: string;
  label: string;
  sub: string;
  image: string;
  path: string;
}

export interface HomeBanner {
  id: string;
  image: string;
  link: string;
  title?: string;
}

export interface HomeDesign {
  id: string;
  title: string;
  author: string;
  image: string;
  cta: string;
}

export interface HomeData {
  logoText: string;
  tiles: HomeTile[];
  banners: HomeBanner[];
  designs: HomeDesign[];
}

export interface PlazaItem {
  id: string;
  title: string;
  author: string;
  image: string;
  cta: string;
  usageCount: number;
}

export interface GoodsData {
  items: PlazaItem[];
}

/** 设计构成一行（与 DIY 珠子对应） */
export interface DesignCompositionRow {
  materialId: string;
  name: string;
  image: string;
  size: number;
  price: number;
  quantity: number;
  amount?: number;
}

export interface DesignDetail {
  id: string;
  source: 'designer' | 'user';
  title: string;
  author: string;
  image: string;
  images: string[] | null;
  usageCount: number;
  composition: DesignCompositionRow[];
}

export interface CartItem {
  id: string;
  name: string;
  image: string;
  price: number;
  qty: number;
}

export interface CartData {
  items: CartItem[];
}

export interface ProfileEntry {
  id: string;
  label: string;
  sub: string;
  icon: string;
  path?: string;
}

export interface ProfileData {
  name: string;
  greeting: string;
  entries: ProfileEntry[];
}

/** 我的设计：后端返回结构 */
export interface MyDesignFromApi {
  id: string;
  title: string;
  composition: DesignCompositionRow[];
  createdAt: string;
  updatedAt: string;
}
