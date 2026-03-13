import type { Material, MaterialCategory } from '@/types'

/** 最小可戴手围(cm)，用于判断是否显示「手围过小」 */
export const MIN_HAND_CIRCUMFERENCE_CM = 14

/** Mock 分类 */
export const mockCategories: MaterialCategory[] = [
  { id: 'in-use', name: '正在使用' },
  { id: 'white', name: '白水晶' },
  { id: 'purple', name: '紫水晶' },
  { id: 'yellow', name: '黄水晶' },
  { id: 'pink', name: '粉水晶' },
  { id: 'other', name: '其他' },
]

/** Mock 材料（按分类，image 由后端接口或自行配置） */
export const mockMaterials: Material[] = [
  { id: 'm1', name: '净体白水晶', image: '', categoryId: 'white', specs: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 10 }] },
  { id: 'm2', name: '奶白晶', image: '', categoryId: 'white', specs: [{ size: 6, price: 4 }, { size: 8, price: 6 }] },
  { id: 'm3', name: '薰衣草紫水晶', image: '', categoryId: 'purple', specs: [{ size: 6, price: 5 }, { size: 10, price: 12 }] },
  { id: 'm4', name: '深紫水晶', image: '', categoryId: 'purple', specs: [{ size: 8, price: 8 }, { size: 10, price: 15 }] },
  { id: 'm5', name: '黄水晶', image: '', categoryId: 'yellow', specs: [{ size: 6, price: 4 }, { size: 8, price: 7 }] },
  { id: 'm6', name: '粉水晶', image: '', categoryId: 'pink', specs: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 9 }] },
  { id: 'm7', name: '草莓晶', image: '', categoryId: 'pink', specs: [{ size: 8, price: 6 }] },
  { id: 'm8', name: '玛瑙', image: '', categoryId: 'other', specs: [{ size: 6, price: 2 }, { size: 10, price: 8 }] },
]
