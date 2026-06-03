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
        timeout: 180000
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

    req.setTimeout(180000, () => {
      req.destroy()
      reject(new Error('请求超时（180s），模型可能较慢，请稍后重试'))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export type AiShotMode = 'default' | 'host'

export async function callAiApi(
  config: AiConfig,
  script: string,
  workspacePath: string,
  mode: AiShotMode = 'default'
): Promise<AiShotField[]> {
  const { getPromptForMode } = await import('./promptService')
  const prompt = await getPromptForMode(workspacePath, mode)

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
      system: prompt,
      messages: [{ role: 'user', content: script }]
    })
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`
    body = JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: prompt },
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
    content = msg.content || msg.reasoning_content || ''
  }

  if (!content) {
    const preview = JSON.stringify(response).slice(0, 500)
    throw new Error(`AI 未返回有效内容，请检查模型名称或 API Key。响应: ${preview}`)
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
