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
const USER_TOKEN_STORAGE_KEY = 'diy-bracelets-user-token';
const USER_TOKEN_EXPIRY_STORAGE_KEY = 'diy-bracelets-user-token-expires-at';
const USER_ID_STORAGE_KEY = 'diy-bracelets-user-id';
const USER_CACHE_OWNER_STORAGE_KEY = 'diy-bracelets-user-cache-owner';
const USER_SCOPED_CACHE_KEYS = [
  'diy-bracelets-address-migrated-user',
  'diy-bracelets-addresses',
  'diy-bracelets-cart',
  'diy-bracelets-cart-migrated-user',
  'diy-bracelets-cart-sync-pending',
  'diy-bracelets-checkout-draft',
  'diy-bracelets-coupons',
  'diy-bracelets-editing-cart-item-id',
  'diy-bracelets-editing-saved-design-id',
  'diy-bracelets-favorite-plaza',
  'diy-bracelets-favorite-plaza-records',
  'diy-bracelets-orders',
  'diy-bracelets-profile-details',
  'diy-bracelets-saved-list',
  'diy-bracelets-test-cart',
];
let wxCloudInited = false;
let loginPromise: Promise<void> | null = null;

declare const wx: any;

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type UniRequestMethod = 'GET' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PUT' | 'TRACE' | 'CONNECT';

export class MockApiFallbackError extends Error {
  readonly isMockApiFallback = true;

  constructor(path: string) {
    super(`Mock API fallback for ${path}`);
    this.name = 'MockApiFallbackError';
  }
}

export class ApiRequestError extends Error {
  constructor(
    path: string,
    readonly statusCode: number,
  ) {
    super(`API ${path} ${statusCode}`);
    this.name = 'ApiRequestError';
  }
}

export function isMockApiFallbackError(err: unknown): err is MockApiFallbackError {
  return !!err && typeof err === 'object' && (err as MockApiFallbackError).isMockApiFallback === true;
}

function normalizeResponseData<T>(data: unknown): T {
  return (typeof data === 'string' ? JSON.parse(data) : data) as T;
}

function getAuthHeader(): Record<string, string> {
  const token = uni.getStorageSync(USER_TOKEN_STORAGE_KEY);

  if (!token) return {};
  const tokenText = String(token);
  return {
    Authorization: tokenText.startsWith('Bearer ') ? tokenText : `Bearer ${tokenText}`,
  };
}

function hasValidStoredSession(): boolean {
  const token = uni.getStorageSync(USER_TOKEN_STORAGE_KEY);
  const expiresAt = uni.getStorageSync(USER_TOKEN_EXPIRY_STORAGE_KEY);
  return Boolean(token) && new Date(String(expiresAt)).getTime() > Date.now() + 60_000;
}

function clearStoredSession() {
  uni.removeStorageSync(USER_TOKEN_STORAGE_KEY);
  uni.removeStorageSync(USER_TOKEN_EXPIRY_STORAGE_KEY);
  uni.removeStorageSync(USER_ID_STORAGE_KEY);
}

export function getStoredUserId(): string {
  return String(uni.getStorageSync(USER_ID_STORAGE_KEY) || '');
}

function bindUserScopedCache(userId: string) {
  const previousOwner = String(uni.getStorageSync(USER_CACHE_OWNER_STORAGE_KEY) || '');
  if (previousOwner && previousOwner !== userId) {
    for (const key of USER_SCOPED_CACHE_KEYS) uni.removeStorageSync(key);
  }
  uni.setStorageSync(USER_CACHE_OWNER_STORAGE_KEY, userId);
}

function requiresUserSession(path: string, method: ApiMethod): boolean {
  return path.startsWith('/api/my-designs') ||
    path.startsWith('/api/cart') ||
    path.startsWith('/api/profile') ||
    path.startsWith('/api/addresses') ||
    path.startsWith('/api/orders') ||
    path.startsWith('/api/design-process-videos') ||
    (path === '/api/inspirations' && method === 'POST');
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
  extraHeaders: Record<string, string> = {},
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
        ...extraHeaders,
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
          reject(new ApiRequestError(path, statusCode));
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
function requestTransport<T>(
  path: string,
  method: ApiMethod = 'GET',
  body?: object,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  if (USE_WXCLOUD_CONTAINER && !path.startsWith('http')) {
    return requestByWxCloudContainer<T>(path, method, body, extraHeaders);
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
      ? { 'Content-Type': 'application/json', ...getAuthHeader(), ...extraHeaders }
      : { ...getAuthHeader(), ...extraHeaders };
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
          const err = new ApiRequestError(path, res.statusCode);
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

export function ensureUserSession(): Promise<void> {
  if (!IS_MP_WEIXIN || USE_MOCK_API) return Promise.resolve();
  if (hasValidStoredSession()) return Promise.resolve();
  if (loginPromise) return loginPromise;

  clearStoredSession();
  loginPromise = new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (result) => result.code ? resolve(result.code) : reject(new Error('微信登录未返回 code')),
      fail: reject,
    });
  })
    .then((code) => requestTransport<WechatLoginResponse>('/api/auth/wechat', 'POST', { code }))
    .then((session) => {
      bindUserScopedCache(session.user.id);
      uni.setStorageSync(USER_TOKEN_STORAGE_KEY, session.accessToken);
      uni.setStorageSync(USER_TOKEN_EXPIRY_STORAGE_KEY, session.expiresAt);
      uni.setStorageSync(USER_ID_STORAGE_KEY, session.user.id);
    })
    .finally(() => {
      loginPromise = null;
    });
  return loginPromise;
}

function request<T>(
  path: string,
  method: ApiMethod = 'GET',
  body?: object,
  canRetryAuth = true,
): Promise<T> {
  const execute = () => requestTransport<T>(path, method, body);
  if (!requiresUserSession(path, method)) return execute();

  return ensureUserSession()
    .then(execute)
    .catch((error) => {
      if (
        canRetryAuth &&
        IS_MP_WEIXIN &&
        error instanceof ApiRequestError &&
        error.statusCode === 401
      ) {
        clearStoredSession();
        return ensureUserSession().then(() => request<T>(path, method, body, false));
      }
      throw error;
    });
}

function publishedContent<T extends object>(config: PageConfigResponse<T>): Partial<T> | null {
  return config.isPublished && config.publishedContent ? config.publishedContent : null;
}

export interface DesignProcessVideoJob {
  id: string;
  status: 'queued' | 'rendering' | 'encoding' | 'complete' | 'failed';
  progress: number;
  videoUrl: string | null;
  durationMs: number | null;
  width: number;
  height: number;
  error: string | null;
  steps: DesignProcessVideoStepPayload[];
}

export interface WechatLoginResponse {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface DesignProcessVideoStepPayload {
  id: string;
  action: 'start' | 'add' | 'move' | 'remove' | 'replace' | 'clear' | 'apply';
  at: number;
  beads: Array<{
    id?: string;
    materialId: string;
    specId: string;
    name: string;
    image: string;
    size: number;
    price: number;
    orderIndex: number;
  }>;
  fromIndex?: number;
  toIndex?: number;
}

export interface DesignProcessVideoPaletteItem {
  materialId: string;
  specId?: string;
  name: string;
  image: string;
  size: number;
  price: number;
}

function cartItemInput(item: CartItem) {
  return {
    clientItemId: item.clientItemId || item.id,
    kind: item.kind || (item.composition?.length ? 'custom' : 'product'),
    productId: item.productId,
    name: item.name,
    image: item.image,
    spec: item.spec,
    qty: Number(item.qty || 1),
    handCircumferenceCm: item.handCircumferenceCm,
    estimatedCircumferenceCm: item.estimatedCircumferenceCm,
    composition: item.composition?.map((row) => ({
      materialId: row.materialId,
      specId: row.specId,
      size: row.size,
      quantity: row.quantity,
    })),
  };
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
  /** 设计广场列表，tab=designer|user|contest */
  getGoods: (tab?: 'designer' | 'user' | 'contest') =>
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
  createDesignProcessVideo: (body: {
    steps: DesignProcessVideoStepPayload[];
    palette: DesignProcessVideoPaletteItem[];
    wristCm: number;
  }) =>
    request<DesignProcessVideoJob>(`/api/design-process-videos`, 'POST', body),
  getDesignProcessVideo: (id: string) =>
    request<DesignProcessVideoJob>(`/api/design-process-videos/${id}`),
  getDesignProcessVideoForRender: (id: string, token: string) =>
    requestTransport<DesignProcessVideoJob>(`/api/design-process-videos/${id}/render`, 'GET', undefined, {
      'X-Video-Render-Token': token,
    }),
  getCart: () => request<CartData>(`/api/cart`),
  replaceCart: (items: CartItem[]) =>
    request<CartData>(`/api/cart`, 'PUT', { items: items.map(cartItemInput) }),
  getAddresses: () => request<AddressRecord[]>(`/api/addresses`),
  createAddress: (body: Omit<AddressRecord, 'id'>) =>
    request<AddressRecord>(`/api/addresses`, 'POST', body),
  updateAddress: (id: string, body: Partial<Omit<AddressRecord, 'id'>>) =>
    request<AddressRecord>(`/api/addresses/${id}`, 'PATCH', body),
  deleteAddress: (id: string) => request<void>(`/api/addresses/${id}`, 'DELETE'),
  getOrders: () => request<OrderRecordFromApi[]>(`/api/orders`),
  getOrder: (id: string) => request<OrderRecordFromApi>(`/api/orders/${id}`),
  createOrder: (body: {
    addressId: string;
    idempotencyKey: string;
    items: CartItem[];
    cartItemIds?: string[];
    note?: string;
  }) => request<OrderRecordFromApi>(`/api/orders`, 'POST', {
    ...body,
    items: body.items.map(cartItemInput),
  }),
  remindOrder: (id: string) => request<OrderRecordFromApi>(`/api/orders/${id}/remind`, 'POST'),
  confirmOrderReceipt: (id: string) =>
    request<OrderRecordFromApi>(`/api/orders/${id}/confirm-receipt`, 'POST'),
  requestOrderAfterSale: (id: string, note: string) =>
    request<OrderRecordFromApi>(`/api/orders/${id}/after-sale`, 'POST', { note }),
  getProfile: () => request<ProfileData>(`/api/profile`),
  updateProfile: (displayName: string) =>
    request<ProfileData>(`/api/profile`, 'PATCH', { displayName }),
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

export interface HomeInspirationCarouselContent {
  designIds: string[];
}

export interface HomeContent {
  hero: HomeHeroContent;
  inspirationCarousel: HomeInspirationCarouselContent;
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
  inspirationCarousel?: Partial<HomeInspirationCarouselContent>;
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
  composition?: DesignCompositionRow[];
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
  specId?: string;
}

export interface DesignDetail {
  id: string;
  source: 'designer' | 'user' | 'contest';
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
  clientItemId?: string;
  kind?: 'product' | 'custom';
  productId?: string;
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

export interface AddressRecord {
  id: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

export interface OrderRecordFromApi {
  id: string;
  orderNo: string;
  title: string;
  status: string;
  statusCode: string;
  total: number;
  itemTotal: number;
  freight: number;
  discount: number;
  note: string;
  address: AddressRecord;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: CartItem[];
  trackingCarrier: string | null;
  trackingNo: string | null;
  remindedAt: string | null;
  afterSaleNote: string | null;
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
  avatarUrl?: string | null;
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
