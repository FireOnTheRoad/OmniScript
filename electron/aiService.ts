import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import * as https from 'https'
import * as http from 'http'

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

const defaultConfig: AiConfig = {
  provider: 'openai',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o'
}

const VALID_SCENES = ['远景', '全景', '中景', '近景', '特写', '大特写']
const VALID_CAMERAS = ['固定', '推', '拉', '摇', '移', '跟', '升', '降', '旋转']
const VALID_TRANSITIONS = ['切', '淡入', '淡出', '叠化', '划像', '闪白', '黑场']

function getConfigPath(workspacePath: string): string {
  return join(workspacePath, 'ai.json')
}

export async function readAiConfig(workspacePath: string): Promise<AiConfig> {
  const configPath = getConfigPath(workspacePath)
  if (!existsSync(configPath)) {
    await writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
    return { ...defaultConfig }
  }
  const raw = await readFile(configPath, 'utf-8')
  const parsed = JSON.parse(raw)
  return {
    provider: parsed.provider === 'anthropic' ? 'anthropic' : parsed.provider === 'deepseek' ? 'deepseek' : 'openai',
    apiUrl: parsed.apiUrl || defaultConfig.apiUrl,
    apiKey: parsed.apiKey || '',
    model: parsed.model || defaultConfig.model
  }
}

export async function saveAiConfig(workspacePath: string, config: AiConfig): Promise<void> {
  const configPath = getConfigPath(workspacePath)
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function parseAiResponse(rawText: string): AiShotField[] {
  let jsonStr = rawText.trim()

  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    jsonStr = arrayMatch[0]
  }

  const arr: unknown[] = JSON.parse(jsonStr)
  if (!Array.isArray(arr)) {
    throw new Error('AI 返回不是数组格式')
  }

  return arr.map((item) => normalizeShot(item))
}

function normalizeShot(raw: unknown): AiShotField {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const scene = typeof obj.scene === 'string' ? obj.scene.trim() : ''
  const camera = typeof obj.camera === 'string' ? obj.camera.trim() : ''
  const transition = typeof obj.transition === 'string' ? obj.transition.trim() : ''
  const description = typeof obj.description === 'string' ? obj.description.trim() : ''
  const dialogue = typeof obj.dialogue === 'string' ? obj.dialogue.trim() : ''

  let duration = 3
  if (typeof obj.duration === 'number' && obj.duration >= 0) {
    duration = obj.duration
  }

  return {
    scene: VALID_SCENES.includes(scene) ? scene : '中景',
    camera: VALID_CAMERAS.includes(camera) ? camera : '固定',
    duration: Math.round(duration * 2) / 2,
    transition: VALID_TRANSITIONS.includes(transition) ? transition : '切',
    description,
    dialogue
  }
}

function makeRequest(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http

    const req = lib.request(
      url,
      {
        method: 'POST',
        headers,
        timeout: 60000
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`))
            return
          }
          resolve(data)
        })
        res.on('error', reject)
      }
    )

    req.setTimeout(60000, () => {
      req.destroy()
      reject(new Error('请求超时（60s）'))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const SYSTEM_PROMPT = `你是一位资深视频分镜师。你的任务是：将任意一段文案或剧本拆分成若干镜头，并为每个镜头生成专业的分镜描述。

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
3. description 要具体生动，不要泛泛而谈`

export async function callAiApi(config: AiConfig, script: string): Promise<AiShotField[]> {
  let body: string
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
    body = JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: script }]
    })
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`
    body = JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: script }
      ]
    })
  }

  const raw = await makeRequest(config.apiUrl, headers, body)
  const response = JSON.parse(raw)

  let content = ''
  if (config.provider === 'anthropic') {
    content = response?.content?.[0]?.text || ''
  } else {
    const msg = response?.choices?.[0]?.message || {}
    content = msg.content || ''
  }

  if (!content) {
    const preview = JSON.stringify(response).slice(0, 500)
    throw new Error(`AI 未返回有效内容。响应: ${preview}`)
  }

  return parseAiResponse(content)
}

export async function testAiConnection(config: AiConfig): Promise<{ success: boolean; message: string }> {
  const start = Date.now()

  let body: string
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  const testPrompt = 'Reply with exactly: OK'

  if (config.provider === 'anthropic') {
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
    body = JSON.stringify({
      model: config.model,
      max_tokens: 10,
      messages: [{ role: 'user', content: testPrompt }]
    })
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`
    body = JSON.stringify({
      model: config.model,
      max_tokens: 100,
      messages: [{ role: 'user', content: testPrompt }]
    })
  }

  const raw = await makeRequest(config.apiUrl, headers, body)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  let response: any
  try {
    response = JSON.parse(raw)
  } catch {
    return { success: false, message: `无法解析服务返回（耗时 ${elapsed}s）\n原始响应: ${raw.slice(0, 200)}` }
  }

  if (config.provider === 'anthropic') {
    if (response?.content?.[0]?.text) {
      return { success: true, message: `连接成功！模型「${config.model}」响应正常（耗时 ${elapsed}s）` }
    }
  } else {
    const msg = response?.choices?.[0]?.message
    if (msg?.content || msg?.reasoning_content) {
      return { success: true, message: `连接成功！模型「${config.model}」响应正常（耗时 ${elapsed}s）` }
    }
  }

  if (response?.error?.message) {
    return { success: false, message: `服务返回错误: ${response.error.message}（耗时 ${elapsed}s）` }
  }

  const preview = JSON.stringify(response).slice(0, 300)
  return { success: false, message: `服务返回了意外内容（耗时 ${elapsed}s）\n响应: ${preview}` }
}
