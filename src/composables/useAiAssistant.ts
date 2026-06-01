import { useIpc } from './useIpc'
import type { AiConfig, AiShotField } from '@/types'

export function useAiAssistant() {
  const { invoke } = useIpc()

  async function getAiConfig(): Promise<AiConfig | null> {
    const result = await invoke<AiConfig | null>('ai:get-config')
    return result
  }

  async function saveAiConfig(config: AiConfig): Promise<boolean> {
    const result = await invoke<{ success: boolean; error?: string }>(
      'ai:save-config',
      config
    )
    return result.success
  }

  function isConfigValid(config: AiConfig | null): boolean {
    return !!(config && config.apiKey && config.apiKey.trim().length > 0)
  }

  async function generateShots(script: string): Promise<AiShotField[]> {
    const result = await invoke<{
      success: boolean
      shots?: AiShotField[]
      error?: string
    }>('ai:generate-shots', script)

    if (!result.success || !result.shots) {
      throw new Error(result.error || 'AI 分析失败')
    }

    return result.shots
  }

  return {
    getAiConfig,
    saveAiConfig,
    isConfigValid,
    generateShots
  }
}
