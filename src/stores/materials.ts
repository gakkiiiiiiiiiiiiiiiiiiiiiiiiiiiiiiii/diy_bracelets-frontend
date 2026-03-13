import { defineStore } from 'pinia'
import { ref, computed, onMounted } from 'vue'
import type { Material } from '@/types'
import { mockCategories, mockMaterials } from '@/data/mock'
import { useDesignStore } from './design'
import { API_BASE } from '@/config'
import { api } from '@/api'

// 材料相关的 Pinia 状态管理：若配置了 API_BASE 则从后端拉取，否则使用 Mock
export const useMaterialsStore = defineStore('materials', () => {
  const categories = ref(mockCategories)
  const materials = ref<Material[]>(mockMaterials)
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchFromApi() {
    if (!API_BASE) return
    loading.value = true
    try {
      const [cats, mats] = await Promise.all([api.getCategories(), api.getMaterials()])
      categories.value = cats
      materials.value = mats
      // 若当前选中分类不在接口返回中，则选中第一个分类（避免列表为空）
      if (cats.length > 0 && !cats.some((c) => c.id === currentCategoryId.value)) {
        currentCategoryId.value = cats[0].id
      }
    } catch (e) {
      console.warn('Materials API failed, using mock:', e)
    } finally {
      loading.value = false
      loaded.value = true
    }
  }
  // 当前选中的分类 id，默认为 'white'
  const currentCategoryId = ref('white')
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

  /**
   * 搜索关键字过滤后的材料列表
   * 只有名称包含关键字的材料会被返回
   */
  const filteredMaterials = computed(() => {
    const list = materialsByCategory.value
    // 处理搜索关键字，转小写后比较
    const kw = searchKeyword.value.trim().toLowerCase()
    if (!kw) return list
    // 名称模糊搜索
    return list.filter((m) => m.name.toLowerCase().includes(kw))
  })

  /**
   * 设置当前选中的分类
   * @param id 分类 id
   */
  function setCategory(id: string) {
    currentCategoryId.value = id
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
    loading,
    loaded,
    setCategory,
    setSearchKeyword,
    fetchFromApi,
  }
})
