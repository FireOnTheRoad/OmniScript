import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import type { WorkspaceConfig, RecentProject } from '../../src/types'

const DEFAULT_WORKSPACE = join(app.getPath('documents'), 'Storyboard-Projects')

function getConfigDir(): string {
  return join(app.getPath('userData'), 'config')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'workspace-config.json')
}

function defaultConfig(): WorkspaceConfig {
  return {
    workspacePath: DEFAULT_WORKSPACE,
    lastProjectPath: '',
    recentProjects: [],
    settings: {
      defaultShotDuration: 3,
      frameRate: 24,
      aspectRatio: '16:9'
    }
  }
}

export async function loadConfig(): Promise<WorkspaceConfig> {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return defaultConfig()
  }
  try {
    const raw = await readFile(configPath, 'utf-8')
    return JSON.parse(raw) as WorkspaceConfig
  } catch {
    return defaultConfig()
  }
}

export async function saveConfig(config: WorkspaceConfig): Promise<void> {
  const configDir = getConfigDir()
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true })
  }
  await writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

export function getDefaultWorkspacePath(): string {
  return DEFAULT_WORKSPACE
}

export async function ensureWorkspace(workspacePath: string): Promise<void> {
  await mkdir(workspacePath, { recursive: true })
}

export async function addRecentProject(
  config: WorkspaceConfig,
  project: RecentProject
): Promise<WorkspaceConfig> {
  const projects = config.recentProjects.filter((p) => p.path !== project.path)
  projects.unshift(project)
  if (projects.length > 20) {
    projects.length = 20
  }
  const updated = { ...config, recentProjects: projects, lastProjectPath: project.path }
  await saveConfig(updated)
  return updated
}

export async function removeRecentProject(
  config: WorkspaceConfig,
  projectPath: string
): Promise<WorkspaceConfig> {
  const projects = config.recentProjects.filter((p) => p.path !== projectPath)
  const updated = {
    ...config,
    recentProjects: projects,
    lastProjectPath: config.lastProjectPath === projectPath ? '' : config.lastProjectPath
  }
  await saveConfig(updated)
  return updated
}
