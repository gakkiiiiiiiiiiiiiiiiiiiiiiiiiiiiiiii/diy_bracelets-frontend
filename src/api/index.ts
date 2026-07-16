import type { Material, MaterialCategory } from '@/types';
import {
  API_BASE,
  DEV_API_BASE,
  IS_DEV,
  IS_MP_WEIXIN,
  RESOLVED_API_BASE,
  USE_MOCK_API,
  USE_WXCLOUD_CONTAINER,
  WXCLOUD_CONTAINER_ENV,
  WXCLOUD_CONTAINER_SERVICE,
} from '@/config';

const base = (RESOLVED_API_BASE || '').replace(/\/$/, '');
let wxCloudInited = false;

declare const wx: any;

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type UniRequestMethod = 'GET' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PUT' | 'TRACE' | 'CONNECT';

export class MockApiFallbackError extends Error {
  readonly isMockApiFallback = true;

  constructor(path: string) {
    super(`Mock API fallback for ${path}`);
    this.name = 'MockApiFallbackError';
  }
}

export function isMockApiFallbackError(err: unknown): err is MockApiFallbackError {
  return !!err && typeof err === 'object' && (err as MockApiFallbackError).isMockApiFallback === true;
}

function normalizeResponseData<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T;
}

function getAuthHeader(): Record<string, string> {
  const token =
    uni.getStorageSync('token') ||
    uni.getStorageSync('accessToken') ||
    uni.getStorageSync('Authorization');

  if (!token) return {};
  const tokenText = String(token);
  return {
    Authorization: tokenText.startsWith('Bearer ') ? tokenText : `Bearer ${tokenText}`,
  };
}

function ensureWxCloudInit() {
  if (wxCloudInited) return;
  const wxApi = typeof wx !== 'undefined' ? wx : undefined;
  if (!wxApi?.cloud?.init) return;
  wxApi.cloud.init({
    env: WXCLOUD_CONTAINER_ENV,
  });
  wxCloudInited = true;
}

function requestByWxCloudContainer<T>(
  path: string,
  method: ApiMethod,
  body?: object,
): Promise<T> {
  ensureWxCloudInit();

  return new Promise((resolve, reject) => {
    const wxApi = typeof wx !== 'undefined' ? wx : undefined;
    if (!wxApi?.cloud?.callContainer) {
      reject(new Error('当前微信小程序环境不支持 wx.cloud.callContainer'));
      return;
    }

    wxApi.cloud.callContainer({
      config: {
        env: WXCLOUD_CONTAINER_ENV,
      },
      path,
      method,
      data: method === 'GET' ? '' : body ?? {},
      header: {
        'X-WX-SERVICE': WXCLOUD_CONTAINER_SERVICE,
        'content-type': 'application/json',
        ...getAuthHeader(),
      },
      success: (res: any) => {
        const statusCode = res?.statusCode ?? 200;
        if (statusCode >= 200 && statusCode < 300) {
          try {
            resolve(normalizeResponseData<T>(res.data));
          } catch (e) {
            reject(new Error('接口返回非 JSON'));
          }
        } else {
          console.warn('[api] wx.cloud.callContainer failed with non-2xx status', {
            path,
            statusCode,
            data: res?.data,
          });
          reject(new Error(`API ${path} ${statusCode}`));
        }
      },
      fail: (err: unknown) => {
        console.warn('[api] wx.cloud.callContainer transport failed', {
          path,
          env: WXCLOUD_CONTAINER_ENV,
          service: WXCLOUD_CONTAINER_SERVICE,
          err,
        });
        reject(err);
      },
    });
  });
}

/** 请求 URL：base 为空时用相对路径 path（H5 开发时代理转发）；base 有值时拼完整地址（小程序需配置完整域名） */
function request<T>(
  path: string,
  method: ApiMethod = 'GET',
  body?: object,
): Promise<T> {
  if (USE_WXCLOUD_CONTAINER && !path.startsWith('http')) {
    return requestByWxCloudContainer<T>(path, method, body);
  }

  if (USE_MOCK_API && path.startsWith('/api/')) {
    return Promise.reject(new MockApiFallbackError(path));
  }

  if (!base && !IS_MP_WEIXIN && !IS_DEV && path.startsWith('/api/')) {
    console.warn('[api] request skipped: missing API base in H5 build, using mock fallback', {
      path,
      apiBase: API_BASE,
    });
    return Promise.reject(new Error(`API base is not configured for ${path}`));
  }

  if (!base && IS_MP_WEIXIN && path.startsWith('/')) {
    const err = new Error(
      '微信小程序端不能请求相对路径 /api。请配置 VITE_WXCLOUD_CONTAINER_ENV/VITE_WXCLOUD_CONTAINER_SERVICE 使用云托管，或配置 VITE_API_BASE。',
    );
    console.warn('[api] request skipped: missing absolute API base for mp-weixin', {
      path,
      apiBase: API_BASE,
      devApiBase: DEV_API_BASE,
    });
    return Promise.reject(err);
  }

  const url = path.startsWith('http') ? path : base ? `${base}${path}` : path;
  const uniMethod: UniRequestMethod = method === 'PATCH' ? 'POST' : method;
  const header =
    method !== 'GET' && body != null
      ? { 'Content-Type': 'application/json', ...getAuthHeader() }
      : getAuthHeader();
  if (method === 'PATCH') header['X-HTTP-Method-Override'] = 'PATCH';

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: uniMethod,
      data: body,
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(normalizeResponseData<T>(res.data));
          } catch (e) {
            reject(new Error('接口返回非 JSON'));
          }
        } else {
          const err = new Error(`API ${path} ${res.statusCode}`);
          console.warn('[api] request failed with non-2xx status', {
            path,
            url,
            statusCode: res.statusCode,
            data: res.data,
          });
          reject(err);
        }
      },
      fail: (err) => {
        console.warn('[api] request transport failed', {
          path,
          url,
          err,
          hint: IS_MP_WEIXIN
            ? '请检查微信开发者工具是否关闭“校验合法域名”，或 VITE_API_BASE 是否为已配置的 https 合法域名。'
            : '请检查后端地址与本地代理配置。',
        });
        reject(err);
      },
    });
  });
}

function publishedContent<T extends object>(config: PageConfigResponse<T>): Partial<T> | null {
  return config.isPublished && config.publishedContent ? config.publishedContent : null;
}

export const api = {
  getCategories: () => request<MaterialCategory[]>(`/api/categories`),
  getMaterials: () => request<Material[]>(`/api/materials`),
  resolveBraceletCode: (code: string) =>
    request<BraceletCodeResolution>(`/api/bracelet-code/resolve`, 'POST', { code }),
  getContent: async (): Promise<PublishedContentConfig> => {
    const [brand, home, diy, support] = await Promise.all([
      request<PageConfigResponse<BrandPageContent>>(`/api/content/brand`),
      request<PageConfigResponse<HomePageContent>>(`/api/content/home`),
      request<PageConfigResponse<DiyPageContent>>(`/api/content/diy`),
      request<PageConfigResponse<SupportContent>>(`/api/content/support`),
    ]);
    return {
      brand: publishedContent(brand),
      home: publishedContent(home),
      diy: publishedContent(diy),
      support: publishedContent(support),
    };
  },
  getHome: () => request<HomeData>(`/api/home`),
  /** 设计广场列表，tab=designer|user */
  getGoods: (tab?: 'designer' | 'user') =>
    request<GoodsData>(`/api/goods${tab ? `?tab=${tab}` : ''}`),
  getGoodsDetail: (id: string) => request<DesignDetail>(`/api/goods/${id}`),
  /** 使用该设计：usageCount+1，返回设计详情 */
  useDesign: (id: string) =>
    request<DesignDetail>(`/api/goods/${id}/use`, 'POST'),
  getInspirations: () => request<DesignDetail[]>(`/api/inspirations`),
  getInspiration: (id: string) => request<DesignDetail>(`/api/inspirations/${id}`),
  useInspiration: (id: string) => request<DesignDetail>(`/api/inspirations/${id}/use`, 'POST'),
  useRandomInspiration: () => request<DesignDetail>(`/api/inspirations/random/use`, 'POST'),
  submitInspiration: (body: {
    title: string;
    author?: string;
    composition: DesignCompositionRow[];
    orderedBeads: Array<{ materialId: string; specId: string }>;
    wristCm?: number;
  }) => request<DesignDetail>(`/api/inspirations`, 'POST', body),
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

export interface BrandContent {
  name: string;
  nameEn: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  supportId: string;
  supportHours: string;
}

export interface ContentAction {
  label: string;
  path: string;
}

export interface HomeHeroContent {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  primaryAction: ContentAction;
}

export interface HomeMaterialEntry {
  id: string;
  name: string;
  caption: string;
  image: string;
  categoryId: string;
}

export interface HomeMaterialSectionContent {
  eyebrow: string;
  title: string;
  description: string;
  items: HomeMaterialEntry[];
}

export interface HomeFeaturedWork {
  id: string;
  title: string;
  caption: string;
  image: string;
  path: string;
}

export interface HomeFeaturedSectionContent {
  eyebrow: string;
  title: string;
  actionLabel: string;
  actionPath: string;
  items: HomeFeaturedWork[];
}

export interface HomeContent {
  hero: HomeHeroContent;
  materials: HomeMaterialSectionContent;
  featured: HomeFeaturedSectionContent;
}

export interface DiyMaterialPreview {
  id: string;
  name: string;
  image: string;
}

export interface DiyExperiencePoint {
  id: string;
  label: string;
}

export interface DiyContent {
  pageTitle: string;
  canvasTitle: string;
  canvasHint: string;
  noticeLabel: string;
  saveLabel: string;
  finishLabel: string;
  selectHint: string;
  stageLabel: string;
  stageHint: string;
  experiencePoints: DiyExperiencePoint[];
  materialPreviews: DiyMaterialPreview[];
}

export interface SupportHelpTopic {
  id: string;
  title: string;
  desc: string;
  items: string[];
}

export interface SupportPurchaseSection {
  id: string;
  title: string;
  subtitle: string;
  points: string[];
  tone: string;
}

export interface SupportPurchaseContent {
  heroKicker: string;
  title: string;
  subtitle: string;
  contactText: string;
  sections: SupportPurchaseSection[];
}

export interface SupportTermsSection {
  title: string;
  body: string;
}

export interface SupportTermsContent {
  intro: string;
  sections: SupportTermsSection[];
}

export interface SupportContent {
  helpTopics: SupportHelpTopic[];
  purchase: SupportPurchaseContent;
  terms: SupportTermsContent;
}

export interface ContentConfig {
  brand: BrandContent;
  home: HomeContent;
  diy: DiyContent;
  support: SupportContent;
}

export interface BrandPageContent {
  name: string;
  logoText: string;
  slogan: string;
  logoImage: string;
  serviceEmail: string;
  servicePhone: string;
  nameEn?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  supportId?: string;
  supportHours?: string;
}

export interface HomePageContent {
  tiles: HomeTile[];
  banners: HomeBanner[];
  designs: HomeDesign[];
  hero?: Partial<HomeHeroContent>;
  materials?: Partial<HomeMaterialSectionContent>;
  featured?: Partial<HomeFeaturedSectionContent>;
}

export interface DiyPageContent {
  pageTitle?: string;
  canvasTitle?: string;
  canvasHint?: string;
  noticeLabel?: string;
  saveLabel?: string;
  finishLabel?: string;
  selectHint?: string;
  title: string;
  subtitle: string;
  guideTitle: string;
  guideDescription: string;
  startButtonText: string;
  emptyHint: string;
  tips: string[];
  stageLabel?: string;
  stageHint?: string;
  experiencePoints?: DiyExperiencePoint[];
  materialPreviews?: DiyMaterialPreview[];
}

export interface PageConfigResponse<T extends object> {
  key: 'brand' | 'home' | 'diy' | 'support';
  name: string;
  draftContent: Partial<T>;
  publishedContent: Partial<T> | null;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedContentConfig {
  brand: Partial<BrandPageContent> | null;
  home: Partial<HomePageContent> | null;
  diy: Partial<DiyPageContent> | null;
  support: Partial<SupportContent> | null;
}

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
  subtitle?: string;
  variant?: 'notice' | 'rabbit' | 'image' | 'service';
  badge?: string;
  bullets?: string[];
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
  handCircumferenceCm?: number;
  hasUnavailableParts?: boolean;
  orderedBeads?: Array<{ materialId: string; specId: string }> | null;
  wristCm?: number | null;
  braceletCode?: string | null;
  isInspiration?: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewNote?: string | null;
}

export interface ResolvedBraceletBead {
  index: number;
  materialId: string;
  originalMaterialId: string;
  specId: string;
  name: string;
  image: string;
  size: number;
  price: number;
  available: boolean;
}

export interface BraceletCodeResolution {
  payload: { v: 1; wristCm: number; beads: Array<{ materialId: string; specId: string }>; styleRef?: string };
  beads: Array<ResolvedBraceletBead | null>;
  missing: Array<{ index: number; materialId: string; specId: string; reason: string }>;
  valid: boolean;
  totalPrice: number;
  substitutions: Array<{ from: string; to: string }>;
}

export interface CartItem {
  id: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  type?: string;
  spec?: string;
  /** 用户定制目标手围，单位 cm */
  handCircumferenceCm?: number;
  /** 当前珠子估算成串长度，单位 cm */
  estimatedCircumferenceCm?: number;
  composition?: DesignCompositionRow[];
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
