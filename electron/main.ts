import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadProject, saveProject, checkProjectExists, getProjectPath } from './ipc/project-handlers'
import { startWatching, stopWatching, markWrite } from './ipc/file-watcher'
import {
  loadConfig,
  saveConfig,
  addRecentProject,
  removeRecentProject,
  ensureWorkspace,
  getDefaultWorkspacePath
} from './ipc/workspace'
import type { WorkspaceConfig } from '../src/types'

app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow: BrowserWindow | null = null
let currentProjectPath: string | null = null
let workspaceConfig: WorkspaceConfig | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    title: 'Storyboard - 分镜设计',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-project')
        },
        {
          label: '打开项目',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open-project')
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 Storyboard',
              message: 'Storyboard App v1.0.0',
              detail: '视频分镜设计桌面工具\n基于 Electron + Vue 3 构建'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function registerIpcHandlers(): void {
  ipcMain.handle('workspace:get', async () => {
    return {
      workspacePath: workspaceConfig!.workspacePath,
      recentProjects: workspaceConfig!.recentProjects,
      lastProjectPath: workspaceConfig!.lastProjectPath,
      settings: workspaceConfig!.settings
    }
  })

  ipcMain.handle('workspace:set-path', async (_event, newPath: string) => {
    try {
      await ensureWorkspace(newPath)
      workspaceConfig = { ...workspaceConfig!, workspacePath: newPath }
      await saveConfig(workspaceConfig)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('workspace:update-settings', async (_event, updates: Record<string, unknown>) => {
    try {
      workspaceConfig = {
        ...workspaceConfig!,
        settings: { ...workspaceConfig!.settings, ...updates }
      }
      await saveConfig(workspaceConfig)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dialog:pick-workspace', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择工作区目录',
      defaultPath: workspaceConfig!.workspacePath
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle('project:load', async (_event, basePath: string) => {
    try {
      const data = await loadProject(basePath)
      currentProjectPath = basePath
      startWatching(basePath, mainWindow)

      const meta = data.meta as { name?: string; description?: string } | null
      workspaceConfig = await addRecentProject(workspaceConfig!, {
        name: meta?.name || '',
        description: meta?.description || '',
        path: basePath,
        lastOpenedAt: new Date().toISOString()
      })

      return { success: true, data }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('project:save', async (_event, basePath: string, data: Record<string, unknown>) => {
    try {
      markWrite()
      await saveProject(basePath, data)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('project:new', async (_event, name: string, description: string) => {
    try {
      const ws = workspaceConfig!.workspacePath
      await ensureWorkspace(ws)

      if (checkProjectExists(ws, name)) {
        return { success: false, error: `项目「${name}」已存在，请使用其他名称` }
      }

      const projectPath = getProjectPath(ws, name)
      const gs = workspaceConfig!.settings

      const initialData = {
        meta: {
          name,
          description: description || '',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          author: '',
          settings: {
            defaultShotDuration: gs.defaultShotDuration,
            frameRate: gs.frameRate,
            aspectRatio: gs.aspectRatio,
            exportTemplate: 'default'
          }
        },
        script: '',
        storyboard: { shots: [], totalDuration: 0, shotCount: 0 },
        projectPath
      }

      markWrite()
      await saveProject(projectPath, initialData)
      currentProjectPath = projectPath
      startWatching(projectPath, mainWindow)

      workspaceConfig = await addRecentProject(workspaceConfig!, {
        name,
        description: description || '',
        path: projectPath,
        lastOpenedAt: new Date().toISOString()
      })

      return { success: true, data: initialData }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('project:remove-recent', async (_event, projectPath: string) => {
    try {
      workspaceConfig = await removeRecentProject(workspaceConfig!, projectPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.storyboard.app')

  workspaceConfig = await loadConfig()
  await ensureWorkspace(workspaceConfig.workspacePath)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopWatching()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }
