# TabBar 图标使用 iconfont

**说明：从 iconfont（阿里巴巴矢量图标库）获取图标需要先登录**：打开 https://www.iconfont.cn/ 使用支付宝/淘宝/ GitHub 登录后再按下面步骤操作。

---

## 方案一：下载 PNG 替换（推荐，所有平台通用）

适用于 H5、微信小程序、App。微信小程序 tabBar 仅支持图片，不支持字体图标，因此若要做小程序，必须用本方案。

### 1. 登录与搜索

1. 登录 https://www.iconfont.cn/
2. 在顶部搜索框按下面「推荐搜索词」搜索，每个 tab 选一个图标（可选线框风格，未选中/选中可用同图标或不同图标）。

### 2. 图标与文件对照表

| Tab     | 推荐搜索词     | 未选中文件名        | 选中文件名            |
|---------|----------------|---------------------|-----------------------|
| 首页    | 首页 home      | `home.png`          | `home-active.png`     |
| 设计广场| 设计 广场 应用 | `goods.png`         | `goods-active.png`    |
| DIY     | 编辑 工具 制作 | `diy.png`           | `diy-active.png`      |
| 购物车  | 购物车 cart   | `cart.png`          | `cart-active.png`     |
| 个人中心| 我的 个人 user | `profile.png`       | `profile-active.png`  |

### 3. 下载与尺寸

- 在 iconfont 选中图标后，点击「下载」→ 选择 **PNG**。
- 建议尺寸：**81px × 81px**（与 uni-app / 微信 tabBar 建议一致）。
- 未选中与选中可下载两次，或下载一次后在本地复制一份并改名（选中态可用不同颜色/填充样式）。

### 4. 替换到项目

将下载好的 10 张 PNG 按上表命名，放入项目目录：

```
frontend/static/tabbar/
├── home.png
├── home-active.png
├── goods.png
├── goods-active.png
├── diy.png
├── diy-active.png
├── cart.png
├── cart-active.png
├── profile.png
└── profile-active.png
```

覆盖原有文件后，重新运行或构建即可生效。

---

## 方案二：使用字体图标（仅 H5 / App）

uni-app 原生 tabBar 在 **App 3.4.4+** 和 **H5 3.5.3+** 支持 `iconfont` 配置；**微信小程序不支持** tabBar 字体图标，小程序请用方案一。

若只做 H5/App 且希望用字体图标：

1. 在 iconfont 创建项目，将上述 5 类图标加入项目。
2. 选择「Font class」方式，下载并解压。
3. 将 `iconfont.ttf` 放到 `frontend/static/iconfont/`（或项目内任意静态目录），在 `pages.json` 的 `tabBar` 中配置 `iconfontSrc` 指向该 ttf。
4. 在 `tabBar.list` 的每一项中增加 `iconfont` 对象，填写对应图标的 **Unicode**（如 `\ue001`），并保留 `iconPath` / `selectedIconPath` 作为小程序等不支持字体时的回退。

具体字段格式见 [uni-app tabBar 文档](https://uniapp.dcloud.net.cn/collocation/pages.html#tabbar) 中 `iconfont`、`iconfontSrc` 说明。

---

## 小结

- **需要登录**：使用 iconfont 前请先登录 https://www.iconfont.cn/ 。
- **做小程序**：必须用方案一（下载 PNG 替换 `static/tabbar/` 下 10 张图）。
- **仅 H5/App**：可选方案二（字体图标），或继续用方案一。
