import { watch, FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { stat } from 'fs/promises'

let watcher: FSWatcher | null = null
let lastWriteTime = 0
const DEBOUNCE_MS = 500

export function startWatching(basePath: string, window: BrowserWindow | null): void {
  stopWatching()

  watcher = watch(
    [basePath + '/project.json', basePath + '/storyboard.json', basePath + '/script.md'],
    { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } }
  )

  watcher.on('change', async (filePath: string) => {
    const now = Date.now()
    if (now - lastWriteTime < DEBOUNCE_MS) {
      return
    }
    try {
      const fileStat = await stat(filePath)
      window?.webContents.send('project:file-changed', {
        path: filePath,
        mtime: fileStat.mtimeMs
      })
    } catch {
      // file may have been deleted mid-watch
    }
  })

  watcher.on('error', (err: unknown) => {
    console.error('File watcher error:', err)
  })
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

export function markWrite(): void {
  lastWriteTime = Date.now()
}

export async function checkConflict(filePath: string, localTime: number): Promise<boolean> {
  try {
    const fileStat = await stat(filePath)
    return fileStat.mtimeMs > localTime + 1000
  } catch {
    return false
  }
}
