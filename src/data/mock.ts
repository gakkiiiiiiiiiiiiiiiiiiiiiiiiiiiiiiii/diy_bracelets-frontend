import type { Material, MaterialCategory } from '@/types'

/** 最小可戴手围(cm)，用于判断是否显示「手围过小」 */
export const MIN_HAND_CIRCUMFERENCE_CM = 14

/**
 * 珠子纹理：3D 画布使用 material.image 作为球体贴图。
 * 当前使用项目内生成的水晶材质纹理（frontend/static/textures/）。
 */

/** Mock 分类 */
export const mockCategories: MaterialCategory[] = [
  { id: 'in-use', name: '正在使用' },
  { id: 'white', name: '白水晶' },
  { id: 'purple', name: '紫水晶' },
  { id: 'yellow', name: '黄水晶' },
  { id: 'pink', name: '粉水晶' },
  { id: 'other', name: '其他' },
]

/** 水晶纹理路径：uni-app H5 开发时 static 目录通过 /static/ 访问，材料卡与 3D 共用此路径 */
const TEXTURES = {
  white: '/static/textures/crystal-white.png',
  milky: '/static/textures/crystal-milky.png',
  lavender: '/static/textures/crystal-lavender.png',
  deepPurple: '/static/textures/crystal-deep-purple.png',
  yellow: '/static/textures/crystal-yellow.png',
  pink: '/static/textures/crystal-pink.png',
  strawberry: '/static/textures/crystal-strawberry.png',
  agate: '/static/textures/crystal-agate.png',
}

/** Mock 材料（按分类，使用本地水晶纹理） */
export const mockMaterials: Material[] = [
  { id: 'm1', name: '净体白水晶', image: TEXTURES.white, categoryId: 'white', specs: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 10 }] },
  { id: 'm2', name: '奶白晶', image: TEXTURES.milky, categoryId: 'white', specs: [{ size: 6, price: 4 }, { size: 8, price: 6 }] },
  { id: 'm3', name: '薰衣草紫水晶', image: TEXTURES.lavender, categoryId: 'purple', specs: [{ size: 6, price: 5 }, { size: 10, price: 12 }] },
  { id: 'm4', name: '深紫水晶', image: TEXTURES.deepPurple, categoryId: 'purple', specs: [{ size: 8, price: 8 }, { size: 10, price: 15 }] },
  { id: 'm5', name: '黄水晶', image: TEXTURES.yellow, categoryId: 'yellow', specs: [{ size: 6, price: 4 }, { size: 8, price: 7 }] },
  { id: 'm6', name: '粉水晶', image: TEXTURES.pink, categoryId: 'pink', specs: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 9 }] },
  { id: 'm7', name: '草莓晶', image: TEXTURES.strawberry, categoryId: 'pink', specs: [{ size: 8, price: 6 }] },
  { id: 'm8', name: '玛瑙', image: TEXTURES.agate, categoryId: 'other', specs: [{ size: 6, price: 2 }, { size: 10, price: 8 }] },
]
