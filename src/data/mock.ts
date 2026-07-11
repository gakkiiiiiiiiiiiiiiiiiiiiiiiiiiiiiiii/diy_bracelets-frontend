import type { Material, MaterialCategory } from '@/types'
import type {
  CartData,
  DesignDetail,
  GoodsData,
  HomeData,
  MyDesignFromApi,
  ProfileData,
} from '@/api'
import { referenceCrystalCategories, referenceCrystalMaterials } from '@/data/crystalMaterials'

function getReferenceMaterial(id: string): Material {
  const material = referenceCrystalMaterials.find((item) => item.id === id)
  if (!material) throw new Error(`Missing reference crystal material: ${id}`)
  return material
}

function compositionRow(materialId: string, specIndex: number, quantity: number) {
  const material = getReferenceMaterial(materialId)
  const spec = material.specs[specIndex] ?? material.specs[0]
  return {
    materialId: material.id,
    name: material.name,
    image: material.image,
    size: spec.size,
    price: spec.price,
    quantity,
  }
}

function customCompositionRow(materialId: string, name: string, size: number, price: number, quantity: number) {
  const material = getReferenceMaterial(materialId)
  return {
    materialId: material.id,
    name,
    image: material.image,
    size,
    price,
    quantity,
  }
}

const yellowCrystalMaterial = getReferenceMaterial('ref-yellow-crystal')
const moonCrystalMaterial = getReferenceMaterial('ref-blue-moonstone')
const greenPhantomMaterial = getReferenceMaterial('ref-green-phantom')
const lavenderMaterial = getReferenceMaterial('ref-lavender-amethyst')
const strawberryMaterial = getReferenceMaterial('ref-strawberry-crystal')
const aquamarineMaterial = getReferenceMaterial('ref-aquamarine-ice')
const roseStoneMaterial = getReferenceMaterial('ref-rose-stone')
const tigerEyeMaterial = getReferenceMaterial('ref-yellow-tiger-eye')
const uruguayMaterial = getReferenceMaterial('ref-uruguay-amethyst')
const starryMaterial = getReferenceMaterial('ref-starry-quartz')
const yellowCrystal = yellowCrystalMaterial.image
const moonCrystal = moonCrystalMaterial.image
const greenCrystal = greenPhantomMaterial.image
const lavenderCrystal = lavenderMaterial.image
const strawberryCrystal = strawberryMaterial.image
const aquamarineCrystal = aquamarineMaterial.image
const roseCrystal = roseStoneMaterial.image
const tigerEyeCrystal = tigerEyeMaterial.image
const uruguayCrystal = uruguayMaterial.image
const starryCrystal = starryMaterial.image

/** 最小可戴手围(cm)，用于判断是否显示「手围过小」 */
export const MIN_HAND_CIRCUMFERENCE_CM = 14

/** Mock 分类 */
export const mockCategories: MaterialCategory[] = referenceCrystalCategories

/** Mock 材料（按分类，image 由后端接口或自行配置） */
export const mockMaterials: Material[] = referenceCrystalMaterials

const compositionA = [
  compositionRow('ref-blue-moonstone', 1, 6),
  compositionRow('ref-pink-crystal', 2, 2),
  compositionRow('ref-starry-quartz', 0, 4),
]

const compositionB = [
  compositionRow('ref-yellow-crystal', 1, 8),
  compositionRow('ref-golden-rutile', 0, 4),
]

const compositionC = [
  compositionRow('ref-lavender-amethyst', 2, 5),
  compositionRow('ref-uruguay-amethyst', 1, 5),
  compositionRow('ref-green-phantom', 0, 4),
]

const compositionD = [
  customCompositionRow('ref-pink-crystal', '蜜桃粉晶', 8, 4, 10),
  customCompositionRow('ref-starry-quartz', '满镶星', 8, 4, 1),
  customCompositionRow('ref-blue-moonstone', '奶白晶', 8, 4, 10),
  customCompositionRow('ref-golden-rutile', '镂空福球', 8, 2.5, 1),
  customCompositionRow('ref-rhodochrosite', '玫瑰花环', 8, 3, 3),
]

const compositionE = [
  compositionRow('ref-aquamarine-ice', 1, 7),
  compositionRow('ref-blue-moonstone', 0, 4),
  compositionRow('ref-larimar', 0, 2),
]

const compositionF = [
  compositionRow('ref-yellow-tiger-eye', 1, 6),
  compositionRow('ref-golden-rutile', 0, 3),
  compositionRow('ref-yellow-crystal', 0, 3),
]

export const mockHomeData: HomeData = {
  logoText: '珠岛',
  tiles: [
    { id: 'diy', label: 'DIY-CUSTOM', sub: '设计手串', image: strawberryCrystal, path: '/pages/design/design' },
    { id: 'goods', label: 'MUST-HAVE', sub: '好物', image: starryCrystal, path: '/pages/goods/goods' },
  ],
  banners: [
    {
      id: 'purchase-notes',
      image: starryCrystal,
      link: '/pages/profile/purchase-notes',
      title: '水晶购买须知',
      subtitle: 'NOTES OF PURCHASE',
      variant: 'notice',
      badge: '买前必看',
      bullets: ['天然纹理', '色差说明', '规格确认'],
    },
    {
      id: 'support-design-photo',
      image: '',
      link: '',
      title: '添加客服',
      subtitle: '查看设计实物图！',
      variant: 'service',
    },
    {
      id: 'rabbit-hair',
      image: '/static/shop-goods/rabbit-category-thumb.png',
      link: '/pages/goods/search/search?categoryId=rabbit-hair',
      title: '兔毛水晶',
      subtitle: '好物 → 兔毛水晶',
      variant: 'rabbit',
      badge: 'NEW',
    },
  ],
  designs: [
    { id: 'plaza-star-watch', title: '星·守望', author: '@LY', image: moonCrystal, cta: '查看实物' },
    { id: 'plaza-pink-mist', title: '粉色迷眸', author: '@-2enbor', image: strawberryCrystal, cta: '查看实物' },
    { id: 'plaza-green-haze', title: '森雾回响', author: '@ZHUDAO', image: greenCrystal, cta: '查看实物' },
  ],
}

export const mockGoodsByTab: Record<'designer' | 'user', GoodsData> = {
  designer: {
    items: [
      { id: 'plaza-pink-mist', title: '粉色迷眸', author: '@-2enbor', image: strawberryCrystal, cta: '查看实物', usageCount: 1608 },
      { id: 'plaza-star-watch', title: '星·守望', author: '@LY', image: moonCrystal, cta: '查看实物', usageCount: 703 },
      { id: 'plaza-pink-ink', title: '粉研', author: '@yarina', image: roseCrystal, cta: '查看实物', usageCount: 753 },
      { id: 'plaza-silver-tide', title: '银色潮汐', author: '@Pomelo.Y', image: aquamarineCrystal, cta: '查看实物', usageCount: 499 },
      { id: 'plaza-green-haze', title: '森雾回响', author: '@ZHUDAO', image: greenCrystal, cta: '查看实物', usageCount: 226 },
      { id: 'plaza-aurora-white', title: '月白极光', author: '@Mia', image: moonCrystal, cta: '查看实物', usageCount: 10718 },
    ],
  },
  user: {
    items: [
      { id: 'plaza-user-rose-dream', title: '玫瑰泡泡', author: '@吴烦恼', image: strawberryCrystal, cta: '查看实物', usageCount: 318 },
      { id: 'plaza-user-sea-breath', title: '海盐呼吸', author: '@Oo', image: aquamarineCrystal, cta: '查看实物', usageCount: 286 },
      { id: 'plaza-user-tiger-sun', title: '午后虎眼', author: '@山与石', image: tigerEyeCrystal, cta: '查看实物', usageCount: 251 },
      { id: 'plaza-user-purple-rain', title: '紫雨黄昏', author: '@Luna', image: lavenderCrystal, cta: '查看实物', usageCount: 217 },
      { id: 'plaza-user-green-hour', title: '绿幽小时', author: '@青野', image: greenCrystal, cta: '查看实物', usageCount: 184 },
      { id: 'plaza-user-clear-day', title: '净白日常', author: '@Yuki', image: moonCrystal, cta: '查看实物', usageCount: 166 },
    ],
  },
}

function designDetail(
  id: string,
  source: 'designer' | 'user',
  title: string,
  author: string,
  image: string,
  usageCount: number,
  composition: DesignDetail['composition'],
  options: Pick<DesignDetail, 'handCircumferenceCm' | 'hasUnavailableParts'> = {},
): DesignDetail {
  return {
    id,
    source,
    title,
    author,
    image,
    images: [image],
    usageCount,
    composition,
    ...options,
  }
}

export const mockDesignDetails: Record<string, DesignDetail> = {
  'plaza-pink-mist': designDetail('plaza-pink-mist', 'designer', '粉色迷眸', '@-2enbor', strawberryCrystal, 1608, compositionD, {
    handCircumferenceCm: 15.5,
    hasUnavailableParts: true,
  }),
  'plaza-star-watch': designDetail('plaza-star-watch', 'designer', '星·守望', '@LY', moonCrystal, 703, compositionA),
  'plaza-pink-ink': designDetail('plaza-pink-ink', 'designer', '粉研', '@yarina', roseCrystal, 753, compositionD),
  'plaza-silver-tide': designDetail('plaza-silver-tide', 'designer', '银色潮汐', '@Pomelo.Y', aquamarineCrystal, 499, compositionE),
  'plaza-green-haze': designDetail('plaza-green-haze', 'designer', '森雾回响', '@ZHUDAO', greenCrystal, 226, compositionC),
  'plaza-aurora-white': designDetail('plaza-aurora-white', 'designer', '月白极光', '@Mia', moonCrystal, 10718, compositionA),
  'plaza-user-rose-dream': designDetail('plaza-user-rose-dream', 'user', '玫瑰泡泡', '@吴烦恼', strawberryCrystal, 318, compositionD),
  'plaza-user-sea-breath': designDetail('plaza-user-sea-breath', 'user', '海盐呼吸', '@Oo', aquamarineCrystal, 286, compositionE),
  'plaza-user-tiger-sun': designDetail('plaza-user-tiger-sun', 'user', '午后虎眼', '@山与石', tigerEyeCrystal, 251, compositionF),
  'plaza-user-purple-rain': designDetail('plaza-user-purple-rain', 'user', '紫雨黄昏', '@Luna', lavenderCrystal, 217, compositionC),
  'plaza-user-green-hour': designDetail('plaza-user-green-hour', 'user', '绿幽小时', '@青野', greenCrystal, 184, compositionC),
  'plaza-user-clear-day': designDetail('plaza-user-clear-day', 'user', '净白日常', '@Yuki', moonCrystal, 166, compositionA),
  'plaza-contest-lake-light': designDetail('plaza-contest-lake-light', 'designer', '湖光入梦', '@设计大赛', aquamarineCrystal, 1260, compositionE),
  'plaza-contest-sun-orbit': designDetail('plaza-contest-sun-orbit', 'designer', '日晕轨道', '@设计大赛', tigerEyeCrystal, 1198, compositionF),
  'plaza-contest-violet-cloud': designDetail('plaza-contest-violet-cloud', 'designer', '紫云纪念', '@设计大赛', uruguayCrystal, 1092, compositionC),
  'plaza-contest-spring-mist': designDetail('plaza-contest-spring-mist', 'designer', '春雾碎光', '@设计大赛', greenCrystal, 964, compositionC),
}

export const mockCartData: CartData = {
  items: [
    {
      id: 'cart-white-bubble',
      name: '天然双A白水超净体泡泡串',
      image: '/static/shop-goods/white-bubble-list.jpg',
      price: 280,
      qty: 2,
      spec: '12mm',
      type: '成品手串',
    },
  ],
}

export const mockProfileData: ProfileData = {
  name: 'Gakiiiiiiiiiiiiii',
  greeting: '您好！欢迎来到珠岛',
  entries: [
    { id: 'design', label: '我的设计', sub: '查看已保存的设计记录', icon: 'D', path: '/pages/designs/list' },
    { id: 'coupon', label: '优惠券与口令兑换', sub: '我的优惠券，口令兑换优惠券', icon: '¥', path: '/pages/profile/coupons' },
    { id: 'orders', label: '我的订单', sub: '定制记录，购买记录', icon: 'C', path: '/pages/orders/list' },
    { id: 'address', label: '收货地址', sub: '完善地址，方便下单', icon: 'L', path: '/pages/profile/address' },
    { id: 'help', label: '帮助中心', sub: '有什么问题请联系客服处理', icon: 'S', path: '/pages/profile/help' },
    { id: 'terms', label: '条款和条件', sub: '我们的服务', icon: 'T', path: '/pages/profile/terms' },
  ],
}

export const mockMyDesigns: MyDesignFromApi[] = [
  {
    id: 'my-design-1',
    title: '月白小憩',
    composition: compositionA,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-04T14:20:00.000Z',
  },
  {
    id: 'my-design-2',
    title: '晴窗黄水晶',
    composition: compositionB,
    createdAt: '2026-05-30T08:30:00.000Z',
    updatedAt: '2026-06-03T09:10:00.000Z',
  },
  {
    id: 'my-design-3',
    title: '午后虎眼',
    composition: compositionF,
    createdAt: '2026-02-26T17:51:00.000Z',
    updatedAt: '2026-02-26T17:51:00.000Z',
  },
]
