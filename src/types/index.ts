export type ShotScene = '远景' | '全景' | '中景' | '近景' | '特写' | '大特写'

export type ShotCamera = '固定' | '推' | '拉' | '摇' | '移' | '跟' | '升' | '降' | '旋转'

export type ShotTransition = '切' | '淡入' | '淡出' | '叠化' | '划像' | '闪白' | '黑场'

export interface SketchObject {
  type: 'rect' | 'circle' | 'line' | 'arrow' | 'pen' | 'text'
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  w?: number
  h?: number
  r?: number
  points?: number[]
  stroke?: string
  strokeWidth?: number
  fill?: string
  text?: string
  fontSize?: number
}

export interface Annotation {
  type: 'text' | 'arrow' | 'rect'
  x: number
  y: number
  x2?: number
  y2?: number
  w?: number
  h?: number
  content?: string
  label?: string
  color?: string
}

export interface SketchData {
  objects: SketchObject[]
}

export interface ScriptRef {
  paragraphIndex: number
  text: string
}

export interface Shot {
  id: string
  number: number
  scene: ShotScene
  camera: ShotCamera
  duration: number
  dialogue: string
  description: string
  scriptRef?: ScriptRef
  refImage?: string
  sketch?: SketchData
  annotations?: Annotation[]
  transition: ShotTransition
  notes: string
}

export interface StoryboardData {
  shots: Shot[]
  totalDuration: number
  shotCount: number
}

export interface ProjectSettings {
  defaultShotDuration: number
  frameRate: number
  aspectRatio: string
  exportTemplate: string
}

export interface ProjectMeta {
  name: string
  description: string
  version: string
  createdAt: string
  modifiedAt: string
  author: string
  settings: ProjectSettings
}

export interface ProjectData {
  meta: ProjectMeta | null
  script: string
  storyboard: StoryboardData
  projectPath: string
}

export interface RecentProject {
  name: string
  description: string
  path: string
  lastOpenedAt: string
}

export interface AppSettings {
  defaultShotDuration: number
  frameRate: number
  aspectRatio: string
}

export interface AiConfig {
  provider: 'openai' | 'anthropic' | 'deepseek'
  apiUrl: string
  apiKey: string
  model: string
}

export interface AiShotField {
  scene: string
  camera: string
  duration: number
  transition: string
  description: string
  dialogue: string
}

export interface WorkspaceConfig {
  workspacePath: string
  lastProjectPath: string
  recentProjects: RecentProject[]
  settings: AppSettings
}
