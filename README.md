# DIY 手串 - 前端

基于 **uni-app (Vue 3 + Vite)** 的「养个石头」DIY 手串设计页，支持微信小程序与 H5。界面遵循 **Apple-style UI**（极光背景、毛玻璃卡片、Bento 间距、物理动效）。

## 技术栈

- Vue 3 + `<script setup>` + TypeScript
- Pinia 状态管理
- SCSS + uni.scss 变量（Apple 色值、圆角、缓动）
- 组件：NavigationBar、InfoTag、BraceletCanvas、ActionButton、MaterialSearch、MaterialCategoryList、MaterialCard

## 开发

```bash
cd frontend
pnpm install
pnpm dev:h5          # H5
pnpm dev:mp-weixin   # 微信开发者工具打开 dist/dev/mp-weixin
```

## 构建

```bash
pnpm build:h5
pnpm build:mp-weixin
```

## 微信登录与用户数据

- 小程序启动时通过 `uni.login` 获取一次性 code，并提交到后端 `POST /api/auth/wechat`。
- 前端只保存后端签发的随机会话令牌和过期时间；微信 `AppSecret`、OpenID、`session_key` 均不会进入前端源码或构建产物。
- `我的设计`、个人资料、购物车与过程视频接口会在请求前确保已有登录态；收到 401 时清除旧令牌并自动重新登录一次。
- 小程序生产模式下，购物车、收货地址和订单均以服务端数据为准；购物车写入会串行合并，订单使用幂等键并以服务端重新计价结果为准。
- 当前履约模式为“提交订单后客服确认并制作”，不代表在线支付成功。优惠券在服务端校验能力上线前不会进入生产结算，也不会在生产个人中心展示入口。
- 切换微信用户时会清理上一用户的本地业务缓存，避免地址、订单或设计缓存交叉显示。
- 小程序上线前必须在 backend 配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`，并配置合法的 HTTPS API 域名或微信云托管服务。

`usesRemoteCommerce` 当前仅对非 Mock 的微信小程序构建启用。H5 构建用于界面预览和本地演示，不具备生产登录与跨设备交易能力。

## 目录说明

- `src/pages/design/` - 设计页（画布 + 材料区）
- `src/components/` - 通用组件
- `src/stores/` - Pinia：design、materials、ui
- `src/types/` - 类型定义
- `src/data/mock.ts` - 分类与材料 Mock 数据

## 设计规范（Apple-style）

- 背景 `#F5F5F7`，固定极光光球 + `blur(80px)` 浮动动画
- 卡片：`rgba(255,255,255,0.8)` + `backdrop-filter: blur(20px)`，圆角 24rpx
- 主按钮蓝 `#0071e3`，次级灰 `#E5E5EA`，输入框 `#F2F2F7`、focus 品牌光晕
- 过渡：`cubic-bezier(0.25, 1, 0.5, 1)`，卡片 fade-in-up 入场
