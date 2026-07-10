import path from 'path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
// uni-app 插件：CJS default 在 ESM 下可能为 module 本身，需兼容调用
import uniPkg from '@dcloudio/vite-plugin-uni'
const uniPlugin = typeof uniPkg === 'function' ? uniPkg : (uniPkg as { default: () => any }).default

const staticDir = path.resolve(__dirname, 'static')
const customTabBarDir = path.resolve(__dirname, 'custom-tab-bar')
const sharedDir = path.resolve(__dirname, 'shared')

/** 递归复制目录到目标 */
function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name)
    const destPath = path.join(dest, name)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3008'
const useWxCloudContainer = process.env.VITE_USE_WXCLOUD_CONTAINER !== 'false'
const useMockApi =
  process.env.VITE_USE_MOCK_API === 'true' ||
  (!process.env.VITE_API_BASE && process.env.VITE_USE_MOCK_API !== 'false')

export default defineConfig({
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    host: '0.0.0.0',
    // 开发时代理 API，避免跨域：请求同源 /api、/uploads 由 Vite 转发到后端
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  define: {
    __IS_DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    // 构建时注入，供 H5/小程序共用，避免小程序端使用 import.meta.env 触发 Node url 模块
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || ''),
    __DEV_API_BASE__: JSON.stringify(process.env.VITE_PROXY_TARGET || apiTarget),
    __USE_MOCK_API__: JSON.stringify(useMockApi),
    __WXCLOUD_CONTAINER_ENV__: JSON.stringify(
      useWxCloudContainer
        ? process.env.VITE_WXCLOUD_CONTAINER_ENV || 'prod-4gmdxhajdbc36f11'
        : '',
    ),
    __WXCLOUD_CONTAINER_SERVICE__: JSON.stringify(
      useWxCloudContainer ? process.env.VITE_WXCLOUD_CONTAINER_SERVICE || 'diy' : '',
    ),
  },
  plugins: [
    // 优先注册，使 /static/ 请求先被处理（材料卡图片、3D 纹理）
    {
      name: 'serve-static-dir',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const reqUrl = req.url ?? ''
          const [pathname, rawQuery = ''] = reqUrl.split('?')
          if (!pathname.startsWith('/static/')) return next()

          const query = new URLSearchParams(rawQuery)
          if (query.has('import') || query.has('raw') || query.has('url')) {
            return next()
          }

          const subPath = pathname.slice('/static/'.length).replace(/^\//, '')
          const filePath = path.resolve(staticDir, subPath)
          const relative = path.relative(staticDir, filePath)
          if (relative.startsWith('..') || !fs.existsSync(filePath)) {
            return next()
          }
          const stat = fs.statSync(filePath)
          if (!stat.isFile()) return next()
          const ext = path.extname(filePath).slice(1).toLowerCase()
          const types: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            json: 'application/json',
          }
          res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
          fs.createReadStream(filePath).pipe(res)
        })
      },
    },
    uniPlugin(),
    // 构建时复制根 static 目录，保证 H5 与微信小程序都能访问 /static/* 材质贴图。
    {
      name: 'copy-runtime-static-assets',
      configureServer() {
        const devOut = path.resolve(__dirname, 'dist/dev/mp-weixin')
        if (fs.existsSync(devOut)) {
          copyDirSync(staticDir, path.join(devOut, 'static'))
          if (fs.existsSync(customTabBarDir)) copyDirSync(customTabBarDir, path.join(devOut, 'custom-tab-bar'))
          if (fs.existsSync(sharedDir)) copyDirSync(sharedDir, path.join(devOut, 'shared'))
        }
      },
      closeBundle() {
        const h5BuildOutDir = path.resolve(__dirname, 'dist/build/h5')
        const outDir = path.resolve(__dirname, 'dist/dev/mp-weixin')
        const buildOutDir = path.resolve(__dirname, 'dist/build/mp-weixin')
        for (const dir of [h5BuildOutDir, outDir, buildOutDir]) {
          if (fs.existsSync(dir)) {
            copyDirSync(staticDir, path.join(dir, 'static'))
            if (fs.existsSync(customTabBarDir)) copyDirSync(customTabBarDir, path.join(dir, 'custom-tab-bar'))
            if (fs.existsSync(sharedDir)) copyDirSync(sharedDir, path.join(dir, 'shared'))
          }
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      three: path.resolve(__dirname, 'node_modules/three'),
    },
  },
  optimizeDeps: {
    include: ['three'],
  },
})
