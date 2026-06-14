import { useProjectStore } from '@/stores/projectStore'
import { useIpc } from './useIpc'
import { notify } from '@/utils/notify'
import router from '@/router'
import type { ProjectData, RecentProject, AppSettings, ProjectType } from '@/types'

function toPlain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_SAVE_DELAY = 2000

export function useProject() {
  const store = useProjectStore()
  const { invoke, on } = useIpc()

  async function loadWorkspace(): Promise<{
    workspacePath: string
    recentProjects: RecentProject[]
    lastProjectPath: string
    settings: AppSettings
  }> {
    return invoke<{
      workspacePath: string
      recentProjects: RecentProject[]
      lastProjectPath: string
      settings: AppSettings
    }>('workspace:get')
  }

  async function openProject(basePath: string): Promise<boolean> {
    try {
      const result = await invoke<{ success: boolean; data?: ProjectData; error?: string }>(
        'project:load',
        basePath
      )
      if (result.success && result.data) {
        store.setProject(result.data)
        notify().success(`已打开项目「${result.data.meta?.name || '未命名'}」`)
        const pType = result.data.meta?.projectType || 'script'
        router.push({ name: pType === 'video' ? 'video' : 'script' })
        return true
      }
      notify().error(result.error || '打开项目失败')
      return false
    } catch (err) {
      notify().error(`打开项目失败：${String(err)}`)
      return false
    }
  }

  async function newProject(name: string, description: string, projectType: ProjectType = 'script'): Promise<boolean> {
    if (!name.trim()) {
      notify().error('请输入项目名称')
      return false
    }

    try {
      const result = await invoke<{ success: boolean; data?: ProjectData; error?: string }>(
        'project:new',
        name.trim(),
        description.trim(),
        projectType
      )
      if (result.success && result.data) {
        store.setProject(result.data)
        notify().success(`已创建项目「${name}」`)
        router.push({ name: projectType === 'video' ? 'video' : 'script' })
        return true
      }
      notify().error(result.error || '创建项目失败')
      return false
    } catch (err) {
      notify().error(`创建项目失败：${String(err)}`)
      return false
    }
  }

  async function saveProject(silent = false): Promise<boolean> {
    if (!store.hasOpenProject) return false

    try {
      const result = await invoke<{ success: boolean; error?: string }>(
        'project:save',
        store.projectPath,
        toPlain(store.projectData)
      )
      if (result.success) {
        if (!silent) notify().success('项目已保存')
        return true
      }
      notify().error(result.error || '保存失败')
      return false
    } catch (err) {
      notify().error(`保存失败：${String(err)}`)
      return false
    }
  }

  async function removeRecentProject(projectPath: string): Promise<boolean> {
    try {
      await invoke('project:remove-recent', projectPath)
      return true
    } catch {
      return false
    }
  }

  async function scanWorkspace(): Promise<{ added: number; total: number } | null> {
    try {
      const result = await invoke<{ success: boolean; added?: number; total?: number; error?: string }>(
        'workspace:scan'
      )
      if (result.success) {
        return { added: result.added || 0, total: result.total || 0 }
      }
      notify().error(result.error || '扫描工作区失败')
      return null
    } catch (err) {
      notify().error(`扫描工作区失败：${String(err)}`)
      return null
    }
  }

  async function importProject(projectPath: string): Promise<boolean> {
    try {
      const result = await invoke<{ success: boolean; name?: string; error?: string }>(
        'project:import',
        projectPath
      )
      if (result.success) {
        notify().success(`已导入项目「${result.name}」`)
        return true
      }
      notify().error(result.error || '导入项目失败')
      return false
    } catch (err) {
      notify().error(`导入项目失败：${String(err)}`)
      return false
    }
  }

  function scheduleAutoSave(): void {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }
    autoSaveTimer = setTimeout(() => {
      saveProject(true)
    }, AUTO_SAVE_DELAY)
  }

  function setupFileWatcher(): void {
    on('project:file-changed', () => {
      if (store.hasOpenProject) {
        notify().info('检测到外部文件变更，正在重新加载...')
        openProject(store.projectPath)
      }
    })
  }

  async function closeProject(): Promise<void> {
    await saveProject(true)
    store.clearProject()
    router.push({ name: 'script' })
  }

  function setupMenuListeners(): void {
    on('menu:open-project', async (path: unknown) => {
      if (typeof path === 'string') {
        await openProject(path)
      }
    })

    on('menu:save', () => {
      saveProject()
    })
  }

  return {
    loadWorkspace,
    openProject,
    newProject,
    saveProject,
    closeProject,
    removeRecentProject,
    scanWorkspace,
    importProject,
    scheduleAutoSave,
    setupFileWatcher,
    setupMenuListeners
  }
}
