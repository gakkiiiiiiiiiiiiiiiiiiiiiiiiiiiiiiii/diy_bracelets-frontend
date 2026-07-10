/**
 * 后端 API 基础地址。未配置时前端使用 Mock 数据；配置后材料/分类从接口拉取，图片相对路径会拼接到该 base。
 * __API_BASE__ 由 Vite define 在构建时注入（H5/小程序通用，避免小程序端 import.meta 触发 Node url 报错）。
 */
declare const __API_BASE__: string | undefined
declare const __DEV_API_BASE__: string | undefined
declare const __WXCLOUD_CONTAINER_ENV__: string | undefined
declare const __WXCLOUD_CONTAINER_SERVICE__: string | undefined
declare const __USE_MOCK_API__: boolean | undefined
declare const __IS_DEV__: boolean | undefined

const injectedApiBase =
  (typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : '') ||
  (typeof globalThis !== 'undefined' && (globalThis as any).__VITE_API_BASE__ != null
    ? (globalThis as any).__VITE_API_BASE__
    : '') ||
  ''

const injectedDevApiBase = (typeof __DEV_API_BASE__ !== 'undefined' ? __DEV_API_BASE__ : '') || ''
const injectedWxCloudContainerEnv =
  (typeof __WXCLOUD_CONTAINER_ENV__ !== 'undefined' ? __WXCLOUD_CONTAINER_ENV__ : '') || ''
const injectedWxCloudContainerService =
  (typeof __WXCLOUD_CONTAINER_SERVICE__ !== 'undefined' ? __WXCLOUD_CONTAINER_SERVICE__ : '') || ''

export const IS_MP_WEIXIN =
  // #ifdef MP-WEIXIN
  true
  // #endif
  // #ifndef MP-WEIXIN
  false
  // #endif

export const API_BASE = injectedApiBase
export const DEV_API_BASE = injectedDevApiBase
export const IS_DEV = typeof __IS_DEV__ !== 'undefined' ? __IS_DEV__ : false
export const USE_MOCK_API =
  !IS_MP_WEIXIN && (typeof __USE_MOCK_API__ !== 'undefined' ? __USE_MOCK_API__ : false)
export const WXCLOUD_CONTAINER_ENV = injectedWxCloudContainerEnv
export const WXCLOUD_CONTAINER_SERVICE = injectedWxCloudContainerService
export const USE_WXCLOUD_CONTAINER =
  IS_MP_WEIXIN && !!WXCLOUD_CONTAINER_ENV && !!WXCLOUD_CONTAINER_SERVICE

/**
 * H5 可继续使用相对路径 + Vite 代理。
 * 微信小程序使用云托管时 API 请求不需要 URL base；未配置云托管时，开发环境回退到 VITE_PROXY_TARGET。
 */
export const RESOLVED_API_BASE = USE_WXCLOUD_CONTAINER
  ? API_BASE
  : API_BASE || (IS_MP_WEIXIN ? DEV_API_BASE : '')
