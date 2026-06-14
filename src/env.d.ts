/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ElectronAPI {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  getPathForFile: (file: File) => string
}

interface Window {
  electronAPI?: ElectronAPI
}
