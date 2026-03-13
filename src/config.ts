/**
 * 后端 API 基础地址。未配置时前端使用 Mock 数据；配置后材料/分类从接口拉取，图片相对路径会拼接到该 base。
 * __API_BASE__ 由 Vite define 在构建时注入（H5/小程序通用，避免小程序端 import.meta 触发 Node url 报错）。
 */
declare const __API_BASE__: string | undefined
export const API_BASE =
  (typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : '') ||
  (typeof globalThis !== 'undefined' && (globalThis as any).__VITE_API_BASE__ != null
    ? (globalThis as any).__VITE_API_BASE__
    : '') ||
  ''
