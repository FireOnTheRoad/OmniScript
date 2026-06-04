import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, copyFile, mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
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
import {
  readAiConfig,
  saveAiConfig,
  callAiApi,
  testAiConnection,
  readImageConfig,
  saveImageConfig,
  callChatApiSimple,
  type AiConfig,
  type ImageGenConfig
} from './aiService'
import { generateImage } from './imageService'
import {
  readAllPrompts,
  savePrompt,
  deletePrompt,
  type StoredPrompt
} from './promptService'

app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow: BrowserWindow | null = null
let currentProjectPath: string | null = null
let workspaceConfig: WorkspaceConfig | null = null

async function saveDataUrlToProject(
  projectPath: string,
  shotId: string,
  dataUrl: string
): Promise<string> {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) throw new Error('无效的 data URL')
  const buffer = Buffer.from(match[2], 'base64')
  const assetsDir = join(projectPath, 'assets', shotId)
  await mkdir(assetsDir, { recursive: true })
  const filename = `ref-${Date.now()}.png`
  const filePath = join(assetsDir, filename)
  await writeFile(filePath, buffer)
  return join('assets', shotId, filename)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    frame: false,
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

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-change', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-change', false)
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

  ipcMain.handle('dialog:pick-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: '选择参考图片',
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle('asset:copy-to-project', async (_event, sourcePath: string, projectPath: string, shotId: string) => {
    try {
      const assetsDir = join(projectPath, 'assets')
      if (!existsSync(assetsDir)) {
        await mkdir(assetsDir, { recursive: true })
      }

      const ext = sourcePath.split('.').pop() || 'jpg'
      const timestamp = Date.now()
      const fileName = `shot_${shotId}_${timestamp}.${ext}`
      const destPath = join(assetsDir, fileName)

      await copyFile(sourcePath, destPath)

      return {
        success: true,
        relPath: `assets/${fileName}`
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('asset:read', async (_event, projectPath: string, relPath: string) => {
    try {
      const fullPath = join(projectPath, relPath)
      if (!existsSync(fullPath)) {
        return { success: false, error: '文件不存在' }
      }
      const buffer = await readFile(fullPath)
      const ext = relPath.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
        svg: 'image/svg+xml'
      }
      const mime = mimeMap[ext] || 'image/jpeg'
      const base64 = buffer.toString('base64')
      return { success: true, dataUrl: `data:${mime};base64,${base64}` }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ai:get-config', async () => {
    try {
      const config = await readAiConfig(workspaceConfig!.workspacePath)
      return config
    } catch (err) {
      return null
    }
  })

  ipcMain.handle('ai:save-config', async (_event, config: AiConfig) => {
    try {
      await saveAiConfig(workspaceConfig!.workspacePath, config)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ai:generate-shots', async (_event, payload: { script: string; mode?: string }) => {
    try {
      const config = await readAiConfig(workspaceConfig!.workspacePath)
      if (!config.apiKey) {
        return { success: false, error: '未配置 API Key' }
      }
      const mode = payload.mode || 'default'
      const shots = await callAiApi(config, payload.script, workspaceConfig!.workspacePath, mode)
      return { success: true, shots }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ai:test-connection', async (_event, config: AiConfig) => {
    try {
      const result = await testAiConnection(config)
      return result
    } catch (err) {
      return { success: false, message: String(err) }
    }
  })

  // ====== Image Generation ======
  ipcMain.handle('image:get-config', async () => {
    try {
      return await readImageConfig(workspaceConfig!.workspacePath)
    } catch {
      return null
    }
  })

  ipcMain.handle('image:save-config', async (_event, config: ImageGenConfig) => {
    try {
      await saveImageConfig(workspaceConfig!.workspacePath, config)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('image:generate', async (_event, payload: { description: string; projectPath?: string; shotId?: string }) => {
    try {
      const imgCfg = await readImageConfig(workspaceConfig!.workspacePath)
      if (!imgCfg.apiKey) {
        return { success: false, error: '未配置生图 API Key' }
      }

      // Step 1: Convert description to image prompt using chat AI
      const promptWithDesc = imgCfg.promptTemplate.replace('{description}', payload.description)
      const aiCfg = await readAiConfig(workspaceConfig!.workspacePath)
      const chatResponse = await callChatApiSimple(aiCfg, promptWithDesc)
      const imagePrompt = chatResponse.trim() || payload.description

      // Step 2: Generate image
      const imageDataUrl = await generateImage(imagePrompt, imgCfg)

      // Step 3: Save to project assets if paths provided
      let relPath: string | undefined
      if (payload.projectPath && payload.shotId) {
        relPath = await saveDataUrlToProject(payload.projectPath, payload.shotId, imageDataUrl)
      }

      return { success: true, imageDataUrl, relPath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('prompts:list', async () => {
    try {
      const prompts = await readAllPrompts(workspaceConfig!.workspacePath)
      return { success: true, prompts }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('prompts:save', async (_event, prompt: Omit<StoredPrompt, 'id' | 'updatedAt'> & { id?: string }) => {
    try {
      const saved = await savePrompt(workspaceConfig!.workspacePath, prompt)
      return { success: true, prompt: saved }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('prompts:delete', async (_event, promptId: string) => {
    try {
      await deletePrompt(workspaceConfig!.workspacePath, promptId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false
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
