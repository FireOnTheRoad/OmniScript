import { contextBridge, ipcRenderer } from 'electron'

const validSendChannels = [
  'menu:new-project',
  'menu:open-project',
  'menu:save',
]

const validOnChannels = [
  'menu:new-project',
  'menu:open-project',
  'menu:save',
  'project:file-changed'
]

const validInvokeChannels = [
  'workspace:get',
  'workspace:set-path',
  'workspace:update-settings',
  'dialog:pick-workspace',
  'project:load',
  'project:save',
  'project:new',
  'project:remove-recent'
]

const api = {
  send: (channel: string, ...args: unknown[]): void => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },

  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (validOnChannels.includes(channel)) {
      const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
        callback(...args)
      }
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
    return () => {}
  },

  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`))
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
