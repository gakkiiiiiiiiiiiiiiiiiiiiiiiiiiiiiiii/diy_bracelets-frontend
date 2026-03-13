import { defineStore } from 'pinia'
import { ref } from 'vue'

export type CanvasMode = 'normal' | 'order'

export const useUIStore = defineStore('ui', () => {
  const canvasMode = ref<CanvasMode>('normal')
  const selectedBeadId = ref<string | null>(null)

  function setCanvasMode(mode: CanvasMode) {
    canvasMode.value = mode
  }

  function setSelectedBeadId(id: string | null) {
    selectedBeadId.value = id
  }

  return {
    canvasMode,
    selectedBeadId,
    setCanvasMode,
    setSelectedBeadId,
  }
})
