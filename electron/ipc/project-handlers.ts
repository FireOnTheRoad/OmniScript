import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function safeParse<T>(raw: string, label: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`[${label}] JSON parse error:`, String(err))
    return null
  }
}

function parseStoryboard(filePath: string): unknown[] {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = safeParse<{ shots?: unknown[] }>(raw, 'storyboard.json')
    if (!data) return []
    return data.shots || []
  } catch {
    return []
  }
}

function calculateTotals(shots: unknown[]): { totalDuration: number; shotCount: number } {
  let totalDuration = 0
  for (const s of shots) {
    const shot = s as Record<string, unknown>
    totalDuration += (shot.duration as number) || 0
  }
  return { totalDuration, shotCount: shots.length }
}

async function backupBeforeWrite(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    const backupPath = filePath + '.bak'
    try {
      await copyFile(filePath, backupPath)
    } catch {
      // non-critical
    }
  }
}

export function checkProjectExists(workspacePath: string, projectName: string): boolean {
  const projectDir = join(workspacePath, projectName)
  return existsSync(projectDir)
}

export function getProjectPath(workspacePath: string, projectName: string): string {
  return join(workspacePath, projectName)
}

/**
 * Read project.json metadata if the directory looks like a valid project.
 * Returns null if the directory has no project.json or it's malformed.
 */
export async function readProjectMeta(
  basePath: string
): Promise<{ name: string; description: string; projectType?: string; createdAt?: string } | null> {
  const projectJsonPath = join(basePath, 'project.json')
  if (!existsSync(projectJsonPath)) return null
  try {
    const raw = await readFile(projectJsonPath, 'utf-8')
    const parsed = safeParse<Record<string, unknown>>(raw, 'project.json')
    if (!parsed) return null
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      projectType: typeof parsed.projectType === 'string' ? parsed.projectType : undefined,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined
    }
  } catch {
    return null
  }
}

/**
 * Scan a directory for valid projects (immediate subdirectories with project.json).
 * Returns metadata for each, with the directory's mtime as a fallback timestamp.
 */
export async function scanWorkspaceProjects(workspacePath: string): Promise<
  Array<{ name: string; description: string; path: string; lastOpenedAt: string }>
> {
  if (!existsSync(workspacePath)) return []

  const entries = await readdir(workspacePath, { withFileTypes: true })
  const projects: Array<{ name: string; description: string; path: string; lastOpenedAt: string }> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const projectDir = join(workspacePath, entry.name)
    const meta = await readProjectMeta(projectDir)
    if (!meta) continue

    // mtime gives us a reasonable "last touched" sort key for projects
    // that have never been opened in this app installation.
    let lastOpenedAt = meta.createdAt || ''
    try {
      const st = await stat(projectDir)
      lastOpenedAt = new Date(st.mtimeMs).toISOString()
    } catch {
      // ignore
    }

    projects.push({
      name: meta.name || entry.name,
      description: meta.description || '',
      path: projectDir,
      lastOpenedAt
    })
  }

  return projects
}

export async function loadProject(basePath: string): Promise<Record<string, unknown>> {
  const projectJsonPath = join(basePath, 'project.json')
  const scriptPath = join(basePath, 'script.md')
  const storyboardPath = join(basePath, 'storyboard.json')
  const videoJsonPath = join(basePath, 'video.json')
  const assetsPath = join(basePath, 'assets')

  let meta = null
  if (existsSync(projectJsonPath)) {
    const raw = await readFile(projectJsonPath, 'utf-8')
    meta = safeParse(raw, 'project.json')
    if (!meta) {
      const bakPath = projectJsonPath + '.bak'
      if (existsSync(bakPath)) {
        const bakRaw = await readFile(bakPath, 'utf-8')
        meta = safeParse(bakRaw, 'project.json.bak')
      }
    }
  }

  // Default projectType to 'script' for backward compat
  const projectType = (meta as Record<string, unknown>)?.projectType || 'script'

  let script = ''
  if (existsSync(scriptPath)) {
    try {
      script = await readFile(scriptPath, 'utf-8')
    } catch {
      script = ''
    }
  }

  const shots = existsSync(storyboardPath) ? parseStoryboard(storyboardPath) : []
  const { totalDuration, shotCount } = calculateTotals(shots)

  if (!existsSync(assetsPath)) {
    await mkdir(assetsPath, { recursive: true })
  }

  // Load video data for video projects
  let video = undefined
  if (projectType === 'video' && existsSync(videoJsonPath)) {
    try {
      const videoRaw = await readFile(videoJsonPath, 'utf-8')
      const videoData = safeParse<{ clips?: unknown[]; sourceFolder?: string; markdown?: string }>(
        videoRaw,
        'video.json'
      )
      if (videoData) {
        // Backward compat: older project files stored markdown in script.md instead of video.json
        const markdown = typeof videoData.markdown === 'string' ? videoData.markdown : script
        video = {
          clips: videoData.clips || [],
          sourceFolder: videoData.sourceFolder || '',
          markdown
        }
      }
    } catch {
      // non-critical
    }
  }

  return {
    meta,
    script,
    storyboard: { shots, totalDuration, shotCount },
    projectPath: basePath,
    video
  }
}

export async function saveProject(basePath: string, data: Record<string, unknown>): Promise<void> {
  const projectJsonPath = join(basePath, 'project.json')
  const scriptPath = join(basePath, 'script.md')
  const storyboardPath = join(basePath, 'storyboard.json')
  const assetsPath = join(basePath, 'assets')

  if (!existsSync(basePath)) {
    await mkdir(basePath, { recursive: true })
  }
  if (!existsSync(assetsPath)) {
    await mkdir(assetsPath, { recursive: true })
  }

  const meta = data.meta as Record<string, unknown> | null
  if (meta) {
    await backupBeforeWrite(projectJsonPath)
    await writeFile(projectJsonPath, JSON.stringify(meta, null, 2), 'utf-8')
  }

  const script = (data.script as string) || ''
  await writeFile(scriptPath, script, 'utf-8')

  const storyboard = data.storyboard as { shots: unknown[] }
  if (storyboard) {
    const { totalDuration, shotCount } = calculateTotals(storyboard.shots || [])
    await backupBeforeWrite(storyboardPath)
    await writeFile(
      storyboardPath,
      JSON.stringify({ shots: storyboard.shots, totalDuration, shotCount }, null, 2),
      'utf-8'
    )
  }

  // Save video data for video projects
  const videoData = data.video as
    | { clips: unknown[]; sourceFolder: string; markdown?: string }
    | undefined
  if (videoData) {
    const videoJsonPath = join(basePath, 'video.json')
    await backupBeforeWrite(videoJsonPath)
    await writeFile(
      videoJsonPath,
      JSON.stringify(
        {
          clips: videoData.clips,
          sourceFolder: videoData.sourceFolder,
          markdown: videoData.markdown || ''
        },
        null,
        2
      ),
      'utf-8'
    )
  }
}
