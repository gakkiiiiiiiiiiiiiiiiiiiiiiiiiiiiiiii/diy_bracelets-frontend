/** 画布上单颗珠子 */
export interface BraceletBead {
  id: string
  materialId: string
  name: string
  image: string
  size: number
  price: number
  quantity: number
  orderIndex: number
}

/** 画布状态：当前手串珠子列表，顺序即串珠顺序 */
export type BraceletDesign = BraceletBead[]

/** 材料规格：尺寸(mm) + 单价 */
export interface MaterialSpec {
  size: number
  price: number
}

/** 材料 */
export interface Material {
  id: string
  name: string
  image: string
  categoryId: string
  specs: MaterialSpec[]
}

/** 材料规格卡：真实小程序的卡片粒度是“材料 + 单个规格” */
export interface MaterialSpecCard {
  id: string
  material: Material
  spec: MaterialSpec
  usedCount?: number
}

/** 分类 */
export interface MaterialCategory {
  id: string
  name: string
}
