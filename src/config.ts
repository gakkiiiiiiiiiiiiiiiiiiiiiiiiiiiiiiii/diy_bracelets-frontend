/**
 * 后端 API 与动态媒体基础地址。H5 演示可显式使用 Mock；生产小程序必须配置 HTTPS 地址。
 * __API_BASE__ 由 Vite define 在构建时注入（H5/小程序通用，避免小程序端 import.meta 触发 Node url 报错）。
 */
declare const __API_BASE__: string | undefined
declare const __STATIC_BASE__: string | undefined
declare const __DEV_API_BASE__: string | undefined
declare const __WXCLOUD_CONTAINER_ENV__: string | undefined
declare const __WXCLOUD_CONTAINER_SERVICE__: string | undefined
declare const __USE_MOCK_API__: boolean | undefined
declare const __IS_DEV__: boolean | undefined
declare const __DESIGN_PROCESS_VIDEO_ENABLED__: boolean | undefined

const injectedApiBase =
  (typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : '') ||
  (typeof globalThis !== 'undefined' && (globalThis as any).__VITE_API_BASE__ != null
    ? (globalThis as any).__VITE_API_BASE__
    : '') ||
  ''

const injectedDevApiBase = (typeof __DEV_API_BASE__ !== 'undefined' ? __DEV_API_BASE__ : '') || ''
const injectedStaticBase = (typeof __STATIC_BASE__ !== 'undefined' ? __STATIC_BASE__ : '') || ''
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
export const STATIC_BASE = injectedStaticBase
export const DEV_API_BASE = injectedDevApiBase
export const IS_DEV = typeof __IS_DEV__ !== 'undefined' ? __IS_DEV__ : false
export const USE_MOCK_API =
  !IS_MP_WEIXIN && (typeof __USE_MOCK_API__ !== 'undefined' ? __USE_MOCK_API__ : false)
export const WXCLOUD_CONTAINER_ENV = injectedWxCloudContainerEnv
export const WXCLOUD_CONTAINER_SERVICE = injectedWxCloudContainerService
export const USE_WXCLOUD_CONTAINER =
  IS_MP_WEIXIN && !!WXCLOUD_CONTAINER_ENV && !!WXCLOUD_CONTAINER_SERVICE
export const DESIGN_PROCESS_VIDEO_ENABLED =
  typeof __DESIGN_PROCESS_VIDEO_ENABLED__ !== 'undefined' && __DESIGN_PROCESS_VIDEO_ENABLED__

/**
 * H5 可继续使用相对路径 + Vite 代理。
 * 微信小程序使用云托管时 API 请求不需要 URL base；未配置云托管时，开发环境回退到 VITE_PROXY_TARGET。
 */
export const RESOLVED_API_BASE = USE_WXCLOUD_CONTAINER
  ? API_BASE
  : API_BASE || (IS_MP_WEIXIN ? DEV_API_BASE : '')
