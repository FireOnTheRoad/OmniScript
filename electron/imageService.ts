import * as https from 'https'
import * as http from 'http'

export interface ImageGenConfig {
  apiKey: string
  size: string
  promptTemplate: string
}

export const DEFAULT_IMAGE_CONFIG: ImageGenConfig = {
  apiKey: '',
  size: '2848x1600',
  promptTemplate: `你是一个专业的AI绘画提示词工程师。请将以下视频分镜的画面描述，转化为适合AI生图模型的结构化提示词。

要求：
1. 输出语言为英文
2. 描述画面主体、构图、光线、色彩、风格
3. 加入画质关键词（如 8K, highly detailed, cinematic lighting）
4. 长度控制在 80~150 词
5. 仅输出提示词文本，不要任何解释或标签

画面描述：
{description}`
}

export interface ImageGenResult {
  success: boolean
  localPath?: string
  error?: string
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
      { method: 'POST', headers, timeout: 120000 },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`))
            return
          }
          resolve(data)
        })
        res.on('error', reject)
      }
    )
    req.setTimeout(120000, () => {
      req.destroy()
      reject(new Error('生图请求超时（120s）'))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/**
 * Generate a reference image using the Doubao Seedream API.
 * Returns the downloaded image as a base64 data URL.
 */
export async function generateImage(
  description: string,
  config: ImageGenConfig
): Promise<string> {
  // Step 1: Build prompt from template
  const prompt = config.promptTemplate.replace('{description}', description)

  // Step 2: Call image generation API
  const body = JSON.stringify({
    model: 'doubao-seedream-5-0-260128',
    prompt,
    size: config.size,
    output_format: 'png',
    watermark: false
  })

  const raw = await makeRequest(
    'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body
  )

  const response = JSON.parse(raw)
  const url = response?.data?.[0]?.url

  if (!url || typeof url !== 'string') {
    throw new Error(
      `AI 未返回图片 URL。响应: ${JSON.stringify(response).slice(0, 300)}`
    )
  }

  // Step 3: Download the image
  const imageData = await downloadImage(url)
  return imageData
}

function downloadImage(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`下载图片失败 HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const base64 = buffer.toString('base64')
        const contentType = res.headers['content-type'] || 'image/png'
        resolve(`data:${contentType};base64,${base64}`)
      })
      res.on('error', reject)
    })
    req.setTimeout(60000, () => {
      req.destroy()
      reject(new Error('下载图片超时（60s）'))
    })
    req.on('error', reject)
  })
}
