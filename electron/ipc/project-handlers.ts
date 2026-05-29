import { readFile, writeFile, mkdir, copyFile } from 'fs/promises'
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

export async function loadProject(basePath: string): Promise<Record<string, unknown>> {
  const projectJsonPath = join(basePath, 'project.json')
  const scriptPath = join(basePath, 'script.md')
  const storyboardPath = join(basePath, 'storyboard.json')
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

  return {
    meta,
    script,
    storyboard: { shots, totalDuration, shotCount },
    projectPath: basePath
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
}
