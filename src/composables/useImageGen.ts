import { useIpc } from './useIpc'
import type { ImageGenConfig } from '@/types'

export function useImageGen() {
  const { invoke } = useIpc()

  async function getImageConfig(): Promise<ImageGenConfig | null> {
    return invoke<ImageGenConfig | null>('image:get-config')
  }

  async function saveImageConfig(config: ImageGenConfig): Promise<boolean> {
    const result = await invoke<{ success: boolean; error?: string }>('image:save-config', config)
    return result.success
  }

  async function generateImage(description: string, projectPath: string, shotId: string): Promise<{ imageDataUrl: string; relPath?: string }> {
    const result = await invoke<{
      success: boolean
      imageDataUrl?: string
      relPath?: string
      error?: string
    }>('image:generate', { description, projectPath, shotId })

    if (!result.success || !result.imageDataUrl) {
      throw new Error(result.error || '图片生成失败')
    }

    return { imageDataUrl: result.imageDataUrl, relPath: result.relPath }
  }

  return {
    getImageConfig,
    saveImageConfig,
    generateImage
  }
}
