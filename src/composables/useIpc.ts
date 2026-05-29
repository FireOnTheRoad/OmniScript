import { computed } from 'vue'

export function useIpc() {
  const api = computed(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI
    }
    return null
  })

  async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (!api.value) {
      throw new Error('Electron API not available')
    }
    return (await api.value.invoke(channel, ...args)) as T
  }

  function on(channel: string, callback: (...args: unknown[]) => void): () => void {
    if (!api.value) {
      return () => {}
    }
    return api.value.on(channel, callback)
  }

  return { api, invoke, on }
}
