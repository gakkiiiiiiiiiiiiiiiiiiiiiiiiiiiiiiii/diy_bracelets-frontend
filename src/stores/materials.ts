import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Material, MaterialSpec, MaterialSpecCard } from '@/types'
import { mockCategories, mockMaterials } from '@/data/mock'
import {
  mergeReferenceCategories,
  mergeReferenceMaterials,
  referenceCategorySearchAliases,
  referenceMaterialSearchAliases,
} from '@/data/crystalMaterials'
import { useDesignStore } from './design'
import { api, isMockApiFallbackError } from '@/api'

const DEFAULT_CATEGORY_ID = 'green-white-series'
const ACTIVE_CATEGORY_STORAGE_KEY = 'yangge-design-active-material-category'

function readPersistedCategoryId() {
  try {
    const value = uni.getStorageSync(ACTIVE_CATEGORY_STORAGE_KEY)
    return typeof value === 'string' && value.trim() ? value : null
  } catch {
    return null
  }
}

function writePersistedCategoryId(id: string) {
  try {
    uni.setStorageSync(ACTIVE_CATEGORY_STORAGE_KEY, id)
  } catch {}
}

function resolveInitialCategoryId() {
  const persisted = readPersistedCategoryId()
  if (persisted && mockCategories.some((category) => category.id === persisted)) return persisted
  return DEFAULT_CATEGORY_ID
}

// 材料相关的 Pinia 状态管理：优先从后端拉取分类与材料，失败或演示模式时使用 Mock
export const useMaterialsStore = defineStore('materials', () => {
  const categories = ref(mockCategories)
  const materials = ref<Material[]>(mockMaterials)
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchFromApi() {
    loading.value = true
    try {
      const [cats, mats] = await Promise.all([api.getCategories(), api.getMaterials()])
      categories.value = mergeReferenceCategories(cats)
      materials.value = mergeReferenceMaterials(mats)
      // 若当前选中分类不在接口返回中，则选中第一个分类（避免列表为空）
      if (categories.value.length > 0 && !categories.value.some((c) => c.id === currentCategoryId.value)) {
        currentCategoryId.value = categories.value[0].id
        writePersistedCategoryId(currentCategoryId.value)
      }
    } catch (e) {
      if (!isMockApiFallbackError(e)) console.warn('Materials API failed, using mock:', e)
    } finally {
      loading.value = false
      loaded.value = true
    }
  }
  // 当前选中的分类 id，默认贴近源小程序先展示白水晶入口
  const currentCategoryId = ref(resolveInitialCategoryId())
  // 当前的搜索关键字
  const searchKeyword = ref('')

  // 引入设计（bracelet）相关的 store
  const designStore = useDesignStore()

  /**
   * 当前选中分类下的所有材料（未经过搜索过滤）
   * 如果分类为 'in-use'，表示只显示已被设计里使用过的材料
   */
  const materialsByCategory = computed(() => {
    if (currentCategoryId.value === 'in-use') {
      // 获取当前手链设计中已用的材料id集合
      const ids = new Set(designStore.braceletDesign.map((b) => b.materialId))
      // 过滤出已使用的材料
      return materials.value.filter((m) => ids.has(m.id))
    }
    // 返回选中分类下的所有材料
    return materials.value.filter((m) => m.categoryId === currentCategoryId.value)
  })

  function cardId(material: Material, spec: MaterialSpec, index: number) {
    return `${material.id}-${spec.size}-${spec.price}-${index}`
  }

  function expandMaterialSpecCards(list: Material[]): MaterialSpecCard[] {
    return list.flatMap((material) =>
      material.specs.map((spec, index) => ({
        id: cardId(material, spec, index),
        material,
        spec,
      })),
    )
  }

  const materialSpecCardsByCategory = computed<MaterialSpecCard[]>(() => {
    if (currentCategoryId.value !== 'in-use') {
      return expandMaterialSpecCards(materialsByCategory.value)
    }
    const seen = new Set<string>()
    const usedCards: MaterialSpecCard[] = []
    for (const bead of designStore.braceletDesign) {
      const material = materials.value.find((m) => m.id === bead.materialId)
      if (!material) continue
      const spec = material.specs.find((s) => s.size === bead.size && s.price === bead.price) ?? {
        size: bead.size,
        price: bead.price,
      }
      const key = `${material.id}-${spec.size}-${spec.price}`
      if (seen.has(key)) {
        const card = usedCards.find((item) => `${item.material.id}-${item.spec.size}-${item.spec.price}` === key)
        if (card) card.usedCount = (card.usedCount ?? 1) + 1
        continue
      }
      seen.add(key)
      usedCards.push({
        id: cardId(material, spec, usedCards.length),
        material,
        spec,
        usedCount: 1,
      })
    }
    return usedCards
  })

  const categoryNameById = computed(() => {
    const map = new Map<string, string>()
    categories.value.forEach((category) => {
      map.set(category.id, category.name)
    })
    return map
  })

  function materialSearchText(material: Material, spec?: MaterialSpec, usedCount?: number) {
    const categoryName = categoryNameById.value.get(material.categoryId) ?? ''
    const categoryAliases = referenceCategorySearchAliases[material.categoryId]?.join(' ') ?? ''
    const materialAliases = referenceMaterialSearchAliases[material.id]?.join(' ') ?? ''
    const specText = spec ? `${spec.size}mm ${spec.price} ${spec.size}毫米` : ''
    const countText = typeof usedCount === 'number' ? `已用${usedCount}颗 ${usedCount}颗` : ''
    return `${material.name} ${categoryName} ${categoryAliases} ${materialAliases} ${specText} ${countText}`.toLowerCase()
  }

  /**
   * 搜索关键字过滤后的材料列表
   * 只有名称包含关键字的材料会被返回
   */
  const filteredMaterials = computed(() => {
    // 处理搜索关键字，转小写后比较
    const kw = searchKeyword.value.trim().toLowerCase()
    const list = kw && currentCategoryId.value !== 'in-use' ? materials.value : materialsByCategory.value
    if (!kw) return list
    // 名称模糊搜索
    return list.filter((m) => materialSearchText(m).includes(kw))
  })

  const filteredMaterialSpecCards = computed(() => {
    const kw = searchKeyword.value.trim().toLowerCase()
    const list = kw && currentCategoryId.value !== 'in-use' ? expandMaterialSpecCards(materials.value) : materialSpecCardsByCategory.value
    if (!kw) return list
    return list.filter(({ material, spec, usedCount }) => materialSearchText(material, spec, usedCount).includes(kw))
  })

  /**
   * 设置当前选中的分类
   * @param id 分类 id
   */
  function setCategory(id: string) {
    currentCategoryId.value = id
    writePersistedCategoryId(id)
  }

  /**
   * 设置搜索关键字
   * @param keyword 搜索内容
   */
  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword
  }

  return {
    categories,
    materials,
    currentCategoryId,
    searchKeyword,
    materialsByCategory,
    filteredMaterials,
    materialSpecCardsByCategory,
    filteredMaterialSpecCards,
    loading,
    loaded,
    setCategory,
    setSearchKeyword,
    fetchFromApi,
  }
})
