import { useIpc } from './useIpc'
import type { StoredPrompt } from '@/types'

export function usePrompts() {
  const { invoke } = useIpc()

  async function listPrompts(): Promise<StoredPrompt[]> {
    const result = await invoke<{ success: boolean; prompts?: StoredPrompt[]; error?: string }>('prompts:list')
    if (!result.success || !result.prompts) {
      throw new Error(result.error || '获取提示词列表失败')
    }
    return result.prompts
  }

  async function savePrompt(prompt: Omit<StoredPrompt, 'id' | 'updatedAt'> & { id?: string }): Promise<StoredPrompt> {
    const result = await invoke<{ success: boolean; prompt?: StoredPrompt; error?: string }>('prompts:save', prompt)
    if (!result.success || !result.prompt) {
      throw new Error(result.error || '保存提示词失败')
    }
    return result.prompt
  }

  async function removePrompt(promptId: string): Promise<void> {
    const result = await invoke<{ success: boolean; error?: string }>('prompts:delete', promptId)
    if (!result.success) {
      throw new Error(result.error || '删除提示词失败')
    }
  }

  return { listPrompts, savePrompt, removePrompt }
}
