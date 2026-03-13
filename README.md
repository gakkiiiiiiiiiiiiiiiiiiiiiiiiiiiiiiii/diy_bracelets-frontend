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

## 纹理图（未纳入 Git）

项目需在 `static/textures/` 下放置水晶纹理 PNG（如 `crystal-pink.png`、`crystal-milky.png` 等），用于首页、材料与 3D 珠子展示。因体积较大未提交到仓库，请从设计资源获取或自备后放入该目录。

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
