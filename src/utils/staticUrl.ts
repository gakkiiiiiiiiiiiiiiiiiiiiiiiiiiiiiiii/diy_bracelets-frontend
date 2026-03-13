import { API_BASE } from '@/config'

/**
 * 静态资源 URL：优先使用后端 API 基地址拼接相对路径；否则 H5 下 / 开头转为同源绝对 URL。
 */
export function resolveStaticUrl(path: string): string {
  if (!path?.trim()) return ''
  if (path.startsWith('http')) return path
  if (API_BASE && path.startsWith('/')) {
    const base = API_BASE.replace(/\/$/, '')
    return base + path
  }
  if (typeof window !== 'undefined' && path.startsWith('/')) {
    return window.location.origin + path
  }
  return path
}
