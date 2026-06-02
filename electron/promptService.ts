import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export interface StoredPrompt {
  id: string
  name: string
  mode: 'default' | 'host'
  content: string
  updatedAt: string
}

function getPromptsPath(workspacePath: string): string {
  return join(workspacePath, 'prompts.json')
}

const BUILTIN_DEFAULTS: Record<string, string> = {
  default: `你是一位资深视频分镜师。你的任务是：将任意一段文案或剧本拆分成若干镜头，并为每个镜头生成专业的分镜描述。

## 任务流程
1. 通读全文，理解内容结构和节奏
2. 将内容拆分为若干镜头：每个镜头是一段语义完整、画面聚焦的内容
3. 每个镜头生成完整分镜信息

## 拆分原则
- 话题切换 → 新镜头。例如从介绍外观转到性能，必须拆分
- 情绪/节奏变化 → 新镜头。开头引子、中间展开、结尾总结各一个镜头
- 关键卖点/信息点 → 新镜头。每个"第一、第二、第三"至少一个镜头
- 长段落内部如有明显转折 → 进一步拆分
- 避免拆太碎：纯过渡句、语气词可以合并到相邻镜头

## 输出格式
严格输出 JSON 数组，每个对象包含 6 个字段：
[
  {"scene":"景别","camera":"运镜","duration":秒数,"transition":"转场","description":"画面描述","dialogue":"原文片段"}
]

## 字段说明
- scene: 远景 | 全景 | 中景 | 近景 | 特写 | 大特写
- camera: 固定 | 推 | 拉 | 摇 | 移 | 跟 | 升 | 降 | 旋转
- duration: 数字（秒）。特写1~2，近景2~3，中景3~5，全景4~8
- transition: 切 | 淡入 | 淡出 | 叠化 | 划像 | 闪白 | 黑场。第一个镜头用"淡入"或"切"，最后一个用"淡出"或"切"，中间用"切"
- description: 中文，25~55字。必须具体描述画面主体、景别构图、光线氛围、关键动作。要像分镜脚本一样有画面感
- dialogue: 该镜头对应的原文文案或台词内容。必须完整保留原文字，不要改写或缩写

## 示例
输入：第一，航空级钛金属！听这声音，不仅硬核，重点是——轻！手感再也不像练铁砂掌了。第二，果粉奔现时刻！Lightning接口终于拜拜，换上USB-C！出门终于可以跟安卓党借充电线了。

输出：[{"scene":"特写","camera":"推","duration":2,"transition":"淡入","description":"iPhone钛金属边框缓慢推近，指尖轻敲边框发出清脆金属声，暖光下金属纹理清晰可见","dialogue":"第一，航空级钛金属！听这声音，不仅硬核，重点是——轻！手感再也不像练铁砂掌了。"},{"scene":"特写","camera":"固定","duration":2,"transition":"切","description":"iPhone底部USB-C接口特写，一根USB-C线缓缓插入，接口处蓝色指示灯亮起","dialogue":"第二，果粉奔现时刻！Lightning接口终于拜拜，换上USB-C！出门终于可以跟安卓党借充电线了。"}]

## 严格要求
1. 只输出 JSON 数组，不要有任何解释、思考过程或代码块标记
2. dialogue 必须逐字保留原文，不能改写、缩写或省略
3. description 要具体生动，不要泛泛而谈`,

  host: `你是一位资深视频分镜师，专精真人出镜口播类视频。你的任务是：将口播文案拆分成若干镜头，为每个镜头生成专业分镜描述，且所有镜头均包含主持人在画面中出镜讲解。

## 核心设定
- 全程由一位主持人在镜头前进行口播解说
- 主持人面向镜头，与观众有眼神交流
- 画面构成以主持人为视觉核心，产品/道具为辅助元素

## 任务流程
1. 通读全文，识别开场、每个关键卖点、结尾
2. 按语义将文案拆分为若干镜头
3. 每个镜头生成完整分镜信息

## 拆分原则
- 话题切换 → 新镜头
- 关键卖点/信息点 → 新镜头。每个"第一、第二、第三"至少一个镜头
- 情绪/节奏变化 → 新镜头
- 避免拆太碎：纯过渡语气词合并到相邻镜头

## 镜头类型与景别规则
- 开场/结尾：近景/中景，主持人面对镜头建立信任感
- 产品特写讲解：近景→特写推近，主持人手持产品展示细节，手部与产品入画
- 功能演示：中景/全景，主持人操作产品，环境适当留白
- 情感/态度表达：近景/特写，突出主持人表情和语气
- 总结/号召：中景，主持人面向镜头，肢体语言开放

## 输出格式
严格输出 JSON 数组，每个对象包含 6 个字段：
[
  {"scene":"景别","camera":"运镜","duration":秒数,"transition":"转场","description":"画面描述","dialogue":"原文片段"}
]

## 字段说明
- scene: 远景 | 全景 | 中景 | 近景 | 特写 | 大特写
- camera: 固定 | 推 | 拉 | 摇 | 移 | 跟 | 升 | 降 | 旋转
- duration: 数字（秒）。特写1~2，近景2~3，中景3~5，全景4~8，口播镜头适当+0.5~1秒给语速留白
- transition: 切 | 淡入 | 淡出 | 叠化 | 划像 | 闪白 | 黑场。第一个镜头用"淡入"或"切"，最后一个用"淡出"或"切"，中间用"切"
- description: 中文，25~60字。必须描述：主持人位置/姿态/表情、镜头景别、光线氛围、产品/道具位置、关键动作。例如"主持人面带微笑站在暖光布景中，右手举起iPhone展示钛金属边框，镜头从中景缓慢推近至特写"而不是"展示钛金属"
- dialogue: 该镜头对应的原文口播文案。必须完整保留原文字，不要改写或缩写

## 示例
输入：欢迎来到小王家！今天给大家开箱一个让我等了三个月的好东西。第一眼看到这个包装，我就知道值了。来，咱们拆开看看……

输出：[{"scene":"中景","camera":"固定","duration":4,"transition":"淡入","description":"主持人小王站在浅灰色布景前，面向镜头微笑挥手，暖色侧光勾勒面部轮廓，双手自然垂下","dialogue":"欢迎来到小王家！今天给大家开箱一个让我等了三个月的好东西。"},{"scene":"近景","camera":"推","duration":3,"transition":"切","description":"镜头推近至主持人上半身，双手捧起包装盒至胸前，眼神兴奋地看向镜头，顶光照亮盒面logo","dialogue":"第一眼看到这个包装，我就知道值了。"},{"scene":"中景","camera":"固定","duration":3,"transition":"切","description":"主持人低头认真拆包装，镜头保持中景纳入拆盒动作与上半身，背景虚化突出主体","dialogue":"来，咱们拆开看看……"}]

## 严格要求
1. 只输出 JSON 数组，不要有任何解释、思考过程或代码块标记
2. dialogue 必须逐字保留原文，不能改写、缩写或省略
3. description 必须包含主持人动作/表情，不能只描述产品
4. 所有镜头的 description 必须有真人（主持人）在画面中`
}

const BUILTIN_NAMES: Record<string, string> = {
  default: '默认（产品/场景展示）',
  host: '真人出镜口播'
}

function buildBuiltinPrompt(mode: string): StoredPrompt {
  const ts = '2025-01-01T00:00:00.000Z'
  return {
    id: `builtin-${mode}`,
    name: BUILTIN_NAMES[mode] || mode,
    mode: mode as 'default' | 'host',
    content: BUILTIN_DEFAULTS[mode] || '',
    updatedAt: ts
  }
}

export async function readAllPrompts(workspacePath: string): Promise<StoredPrompt[]> {
  const builtins = ['default', 'host'].map((m) => buildBuiltinPrompt(m))

  const path = getPromptsPath(workspacePath)
  if (!existsSync(path)) {
    return builtins
  }

  try {
    const raw = await readFile(path, 'utf-8')
    const stored: StoredPrompt[] = JSON.parse(raw)
    if (!Array.isArray(stored)) return builtins

    const result: StoredPrompt[] = [...builtins]

    for (const s of stored) {
      const existing = result.findIndex((r) => r.mode === s.mode)
      if (existing >= 0) {
        result[existing] = { ...s }
      } else {
        result.push(s)
      }
    }

    return result
  } catch {
    return builtins
  }
}

export async function savePrompt(
  workspacePath: string,
  prompt: Omit<StoredPrompt, 'id' | 'updatedAt'> & { id?: string }
): Promise<StoredPrompt> {
  const prompts = await readAllPrompts(workspacePath)
  const now = new Date().toISOString()

  const stored: StoredPrompt = {
    id: prompt.id || `prompt-${Date.now()}`,
    name: prompt.name,
    mode: prompt.mode,
    content: prompt.content,
    updatedAt: now
  }

  const existing = prompts.findIndex((p) => p.id === stored.id)
  if (existing >= 0) {
    prompts[existing] = stored
  } else {
    prompts.push(stored)
  }

  const path = getPromptsPath(workspacePath)
  await writeFile(path, JSON.stringify(prompts, null, 2), 'utf-8')
  return stored
}

export async function deletePrompt(workspacePath: string, promptId: string): Promise<void> {
  const prompts = await readAllPrompts(workspacePath)
  const filtered = prompts.filter((p) => p.id !== promptId)
  const path = getPromptsPath(workspacePath)
  await writeFile(path, JSON.stringify(filtered, null, 2), 'utf-8')
}

export async function getPromptForMode(workspacePath: string, mode: string): Promise<string> {
  const prompts = await readAllPrompts(workspacePath)
  const match = prompts.find((p) => p.mode === mode)
  if (match) return match.content
  return BUILTIN_DEFAULTS[mode] || BUILTIN_DEFAULTS['default']
}
