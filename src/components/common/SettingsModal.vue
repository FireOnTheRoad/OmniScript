<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NModal, NButton, NSpace, NInput, NInputNumber, NSelect, NDivider,
  NForm, NFormItem, NTabs, NTabPane, NDataTable, NPopconfirm, NSpin, NTag, NEmpty
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useIpc } from '@/composables/useIpc'
import { useAiAssistant } from '@/composables/useAiAssistant'
import { usePrompts } from '@/composables/usePrompts'
import { notify } from '@/utils/notify'
import type { AppSettings, AiConfig, StoredPrompt, ImageGenConfig } from '@/types'

const props = defineProps<{
  show: boolean
  workspacePath: string
  settings: AppSettings
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'updated'): void
}>()

const { invoke } = useIpc()
const { getAiConfig, saveAiConfig: persistAiConfig } = useAiAssistant()
const { listPrompts, savePrompt, removePrompt } = usePrompts()

const activeTab = ref('general')

// ====== Tab 1: 通用设置 ======
const editingPath = ref(props.workspacePath)
const defaultShotDuration = ref(props.settings.defaultShotDuration)
const frameRate = ref(props.settings.frameRate)
const aspectRatio = ref(props.settings.aspectRatio)

const aspectOptions = [
  { label: '16:9 (宽屏)', value: '16:9' },
  { label: '4:3 (标准)', value: '4:3' },
  { label: '1:1 (方形)', value: '1:1' },
  { label: '9:16 (竖屏)', value: '9:16' },
  { label: '21:9 (影院)', value: '21:9' },
  { label: '2.35:1 (宽银幕)', value: '2.35:1' }
]

const pathSaved = ref(false)
const settingsSaved = ref(false)

async function handlePickWorkspace(): Promise<void> {
  const result = await invoke<{ canceled: boolean; path?: string }>('dialog:pick-workspace')
  if (!result.canceled && result.path) {
    editingPath.value = result.path
  }
}

async function handleSavePath(): Promise<void> {
  if (!editingPath.value.trim()) {
    notify().error('工作区路径不能为空')
    return
  }
  const result = await invoke<{ success: boolean; error?: string }>(
    'workspace:set-path',
    editingPath.value.trim()
  )
  if (result.success) {
    pathSaved.value = true
    setTimeout(() => { pathSaved.value = false }, 2000)
    emit('updated')
  } else {
    notify().error(result.error || '保存失败')
  }
}

async function handleSaveSettings(): Promise<void> {
  const result = await invoke<{ success: boolean; error?: string }>(
    'workspace:update-settings',
    {
      defaultShotDuration: defaultShotDuration.value,
      frameRate: frameRate.value,
      aspectRatio: aspectRatio.value
    }
  )
  if (result.success) {
    settingsSaved.value = true
    setTimeout(() => { settingsSaved.value = false }, 2000)
    emit('updated')
  } else {
    notify().error(result.error || '保存失败')
  }
}

// ====== Tab 2: AI 配置 ======
const aiProvider = ref<'openai' | 'anthropic' | 'deepseek'>('openai')
const aiApiUrl = ref('')
const aiApiKey = ref('')
const aiModel = ref('')
const aiShowKey = ref(false)
const aiSaved = ref(false)
const aiConfigLoaded = ref(false)

async function loadAiConfig(): Promise<void> {
  const config = await getAiConfig()
  if (config) {
    aiProvider.value = config.provider
    aiApiUrl.value = config.apiUrl
    aiApiKey.value = config.apiKey
    aiModel.value = config.model
  }
  aiConfigLoaded.value = true
}

function onProviderChange(val: 'openai' | 'anthropic' | 'deepseek'): void {
  if (val === 'openai') {
    aiApiUrl.value = 'https://api.openai.com/v1/chat/completions'
    aiModel.value = aiModel.value || 'gpt-4o'
  } else if (val === 'deepseek') {
    aiApiUrl.value = 'https://api.deepseek.com/v1/chat/completions'
    aiModel.value = aiModel.value || 'deepseek-chat'
  } else {
    aiApiUrl.value = 'https://api.anthropic.com/v1/messages'
    aiModel.value = aiModel.value || 'claude-sonnet-4-20250514'
  }
}

async function handleSaveAi(): Promise<void> {
  if (!aiApiKey.value.trim()) {
    notify().error('API Key 不能为空')
    return
  }
  const config: AiConfig = {
    provider: aiProvider.value,
    apiUrl: aiApiUrl.value.trim(),
    apiKey: aiApiKey.value.trim(),
    model: aiModel.value.trim()
  }
  const ok = await persistAiConfig(config)
  if (ok) {
    aiSaved.value = true
    setTimeout(() => { aiSaved.value = false }, 2000)
  } else {
    notify().error('保存 AI 配置失败')
  }
}

const testingConnection = ref(false)

// ====== Image Gen Config ======
const imageApiKey = ref('')
const imageSize = ref('2848x1600')
const imagePromptTemplate = ref('')
const imageShowKey = ref(false)
const imageSaved = ref(false)
const imageConfigLoaded = ref(false)

const imageSizeOptions = [
  { label: '2848x1600 (横版)', value: '2848x1600' },
  { label: '1664x928 (横版小)', value: '1664x928' },
  { label: '1600x2848 (竖版)', value: '1600x2848' },
  { label: '928x1664 (竖版小)', value: '928x1664' },
  { label: '1024x1024 (方形)', value: '1024x1024' }
]

async function loadImageConfig(): Promise<void> {
  const config = await invoke<ImageGenConfig | null>('image:get-config')
  if (config) {
    imageApiKey.value = config.apiKey
    imageSize.value = config.size
    imagePromptTemplate.value = config.promptTemplate
  }
  imageConfigLoaded.value = true
}

async function handleSaveImage(): Promise<void> {
  if (!imageApiKey.value.trim()) {
    notify().error('生图 API Key 不能为空')
    return
  }
  const config: ImageGenConfig = {
    apiKey: imageApiKey.value.trim(),
    size: imageSize.value,
    promptTemplate: imagePromptTemplate.value
  }
  const result = await invoke<{ success: boolean; error?: string }>('image:save-config', config)
  if (result.success) {
    imageSaved.value = true
    setTimeout(() => { imageSaved.value = false }, 2000)
    notify().success('生图配置已保存')
  } else {
    notify().error(result.error || '保存失败')
  }
}

async function handleTestConnection(): Promise<void> {
  if (!aiApiKey.value.trim()) {
    notify().error('请先填写 API Key')
    return
  }
  testingConnection.value = true
  try {
    const result = await invoke<{ success: boolean; message: string }>(
      'ai:test-connection',
      {
        provider: aiProvider.value,
        apiUrl: aiApiUrl.value.trim(),
        apiKey: aiApiKey.value.trim(),
        model: aiModel.value.trim()
      }
    )
    if (result.success) {
      notify().success(result.message)
    } else {
      notify().error(result.message)
    }
  } catch (err) {
    notify().error('测试连接失败：' + String(err))
  } finally {
    testingConnection.value = false
  }
}

// ====== Tab 3: AI 提示词管理 ======
const prompts = ref<StoredPrompt[]>([])
const promptsLoading = ref(false)
const showPromptModal = ref(false)
const editingPrompt = ref<StoredPrompt | null>(null)
const promptFormName = ref('')
const promptFormContent = ref('')
const promptFormMode = ref<'default' | 'host'>('default')
const promptSaving = ref(false)

const modeLabels: Record<string, string> = {
  default: '🎥 默认（产品/场景展示）',
  host: '🎙️ 真人出镜口播'
}

const promptColumns: DataTableColumns<StoredPrompt> = [
  {
    title: '名称',
    key: 'name',
    width: 180,
    ellipsis: { tooltip: true }
  },
  {
    title: '模式',
    key: 'mode',
    width: 140,
    render: (row) => h(NTag, { size: 'small', type: row.mode === 'host' ? 'warning' : 'info', bordered: false },
      { default: () => modeLabels[row.mode] || row.mode })
  },
  {
    title: '内容预览',
    key: 'content',
    ellipsis: { tooltip: true },
    render: (row) => {
      const preview = row.content.replace(/\n/g, ' ').substring(0, 60)
      return preview + (row.content.length > 60 ? '…' : '')
    }
  },
  {
    title: '最后更新',
    key: 'updatedAt',
    width: 120,
    render: (row) => {
      try {
        const d = new Date(row.updatedAt)
        if (isNaN(d.getTime())) return '—'
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } catch { return '—' }
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row) => {
      const isBuiltin = row.id.startsWith('builtin-')
      return h(NSpace, { size: 4 }, () => [
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          onClick: () => openEditPrompt(row)
        }, { default: () => '✏️' }),
        !isBuiltin
          ? h(NPopconfirm, {
            onPositiveClick: () => handleDeletePrompt(row.id)
          }, {
            trigger: () => h(NButton, {
              size: 'tiny',
              quaternary: true,
              type: 'error'
            }, { default: () => '🗑' }),
            default: () => '删除该提示词？将恢复内置默认'
          })
          : null
      ])
    }
  }
]

async function loadPrompts(): Promise<void> {
  promptsLoading.value = true
  try {
    prompts.value = await listPrompts()
  } catch (err) {
    notify().error('加载提示词失败：' + String(err))
  } finally {
    promptsLoading.value = false
  }
}

function openEditPrompt(prompt: StoredPrompt): void {
  editingPrompt.value = prompt
  promptFormName.value = prompt.name
  promptFormContent.value = prompt.content
  promptFormMode.value = prompt.mode
  showPromptModal.value = true
}

function openCreatePrompt(): void {
  editingPrompt.value = null
  promptFormName.value = ''
  promptFormContent.value = ''
  promptFormMode.value = 'default'
  showPromptModal.value = true
}

async function handleSavePrompt(): Promise<void> {
  if (!promptFormName.value.trim()) {
    notify().error('请输入提示词名称')
    return
  }
  if (!promptFormContent.value.trim()) {
    notify().error('请输入提示词内容')
    return
  }
  promptSaving.value = true
  try {
    await savePrompt({
      id: editingPrompt.value?.id,
      name: promptFormName.value.trim(),
      content: promptFormContent.value.trim(),
      mode: promptFormMode.value
    })
    showPromptModal.value = false
    await loadPrompts()
    notify().success('提示词已保存')
  } catch (err) {
    notify().error('保存失败：' + String(err))
  } finally {
    promptSaving.value = false
  }
}

async function handleDeletePrompt(promptId: string): Promise<void> {
  try {
    await removePrompt(promptId)
    await loadPrompts()
    notify().success('已删除并恢复内置默认')
  } catch (err) {
    notify().error('删除失败：' + String(err))
  }
}

function handleClose(): void {
  emit('update:show', false)
}

onMounted(() => {
  loadAiConfig()
  loadImageConfig()
  loadPrompts()
})
</script>

<template>
  <NModal
    :show="show"
    title="⚙️ 软件设置"
    preset="card"
    style="width: 680px; max-height: 80vh"
    :bordered="false"
    @update:show="handleClose"
  >
    <NTabs v-model:value="activeTab" type="line" size="medium">
      <NTabPane name="general" tab="📁 通用设置">
        <div class="tab-body">
          <div class="settings-group">
            <div class="group-title">📁 工作区路径</div>
            <p class="group-desc">所有项目将保存在此目录下</p>
            <NSpace vertical style="width: 100%">
              <NSpace style="width: 100%">
                <NInput
                  v-model:value="editingPath"
                  style="flex: 1"
                  placeholder="D:\MyProjects\Storyboard"
                />
                <NButton size="small" quaternary @click="handlePickWorkspace">
                  浏览...
                </NButton>
              </NSpace>
              <NButton
                type="primary"
                size="small"
                :disabled="editingPath === workspacePath"
                @click="handleSavePath"
              >
                {{ pathSaved ? '已保存 ✓' : '保存路径' }}
              </NButton>
            </NSpace>
          </div>

          <NDivider />

          <div class="settings-group">
            <div class="group-title">🎬 新建项目默认参数</div>
            <p class="group-desc">创建新项目时自动应用这些默认值</p>

            <NForm label-placement="left" label-width="120" size="small">
              <NFormItem label="默认镜头时长(s)">
                <NInputNumber
                  v-model:value="defaultShotDuration"
                  :min="0.5"
                  :max="60"
                  :step="0.5"
                  style="width: 120px"
                />
              </NFormItem>
              <NFormItem label="帧率 (fps)">
                <NInputNumber
                  v-model:value="frameRate"
                  :min="12"
                  :max="120"
                  :step="1"
                  style="width: 120px"
                />
              </NFormItem>
              <NFormItem label="默认画幅比例">
                <NSelect
                  v-model:value="aspectRatio"
                  :options="aspectOptions"
                  style="width: 140px"
                />
              </NFormItem>
            </NForm>

            <NButton
              type="primary"
              size="small"
              style="margin-top: 8px"
              @click="handleSaveSettings"
            >
              {{ settingsSaved ? '已保存 ✓' : '保存参数' }}
            </NButton>
          </div>
        </div>
      </NTabPane>

      <NTabPane name="ai" tab="🤖 AI 配置">
        <div class="tab-body">
          <div class="settings-group">
            <div class="group-title">🤖 AI 智能分镜</div>
            <p class="group-desc">配置 AI API，启用智能分镜拆分与填充功能</p>

            <NForm label-placement="left" label-width="100" size="small">
              <NFormItem label="协议">
                <NSelect
                  v-model:value="aiProvider"
                  :options="[
                    { label: 'OpenAI', value: 'openai' },
                    { label: 'DeepSeek', value: 'deepseek' },
                    { label: 'Anthropic', value: 'anthropic' }
                  ]"
                  style="width: 160px"
                  @update:value="onProviderChange"
                />
              </NFormItem>
              <NFormItem label="API URL">
                <NInput
                  v-model:value="aiApiUrl"
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </NFormItem>
              <NFormItem label="API Key">
                <NSpace style="width: 100%">
                  <NInput
                    v-model:value="aiApiKey"
                    :type="aiShowKey ? 'text' : 'password'"
                    placeholder="sk-..."
                    style="flex: 1"
                  />
                  <NButton size="tiny" quaternary @click="aiShowKey = !aiShowKey">
                    {{ aiShowKey ? '🙈' : '👁' }}
                  </NButton>
                </NSpace>
              </NFormItem>
              <NFormItem label="模型">
                <NInput
                  v-model:value="aiModel"
                  placeholder="gpt-4o"
                />
              </NFormItem>
            </NForm>

            <NButton
              type="primary"
              size="small"
              style="margin-top: 8px"
              @click="handleSaveAi"
            >
              {{ aiSaved ? '已保存 ✓' : '保存 AI 配置' }}
            </NButton>
            <NButton
              size="small"
              style="margin-top: 8px; margin-left: 8px"
              :loading="testingConnection"
              @click="handleTestConnection"
            >
              {{ testingConnection ? '测试中…' : '🔗 测试连接' }}
            </NButton>
          </div>
        </div>
      </NTabPane>

      <NTabPane name="prompts" tab="📝 AI 提示词">
        <div class="tab-body">
          <div class="settings-group">
            <div class="group-title">📝 AI 分镜提示词</div>
            <p class="group-desc">自定义 AI 生成分镜时使用的系统提示词。内置提示词可编辑但不可删除</p>

            <NSpace justify="end" style="margin-bottom: 12px">
              <NButton size="small" type="primary" @click="openCreatePrompt">
                + 新建提示词
              </NButton>
            </NSpace>

            <NSpin :show="promptsLoading">
              <NDataTable
                v-if="prompts.length > 0"
                :columns="promptColumns"
                :data="prompts"
                :bordered="false"
                size="small"
                :single-line="false"
                :row-key="(row: StoredPrompt) => row.id"
                :pagination="{ pageSize: 5 }"
                style="margin-bottom: 8px"
              />
              <NEmpty v-else description="暂无提示词" style="padding: 20px" />
            </NSpin>
          </div>
        </div>
      </NTabPane>

      <NTabPane name="image" tab="🎨 生图配置">
        <div class="tab-body">
          <div class="settings-group">
            <div class="group-title">🎨 AI 参考图生成</div>
            <p class="group-desc">配置 AI 生图 API，在分镜表中根据画面描述自动生成参考图</p>

            <NForm label-placement="left" label-width="100" size="small">
              <NFormItem label="API Key">
                <NSpace style="width: 100%">
                  <NInput
                    v-model:value="imageApiKey"
                    :type="imageShowKey ? 'text' : 'password'"
                    placeholder="输入 Ark API Key..."
                    style="flex: 1"
                  />
                  <NButton size="tiny" quaternary @click="imageShowKey = !imageShowKey">
                    {{ imageShowKey ? '🙈' : '👁' }}
                  </NButton>
                </NSpace>
              </NFormItem>
              <NFormItem label="图片尺寸">
                <NSelect
                  v-model:value="imageSize"
                  :options="imageSizeOptions"
                  style="width: 180px"
                />
              </NFormItem>
              <NFormItem label="提示词模板">
                <NInput
                  v-model:value="imagePromptTemplate"
                  type="textarea"
                  :autosize="{ minRows: 6, maxRows: 12 }"
                  placeholder="输入生图提示词模板，可用 {description} 作为画面描述占位符…"
                  style="font-family: monospace; font-size: 12px"
                />
              </NFormItem>
            </NForm>

            <NButton
              type="primary"
              size="small"
              style="margin-top: 8px"
              @click="handleSaveImage"
            >
              {{ imageSaved ? '已保存 ✓' : '保存生图配置' }}
            </NButton>
          </div>
        </div>
      </NTabPane>
    </NTabs>

    <!-- 提示词编辑弹窗 -->
    <NModal v-model:show="showPromptModal" title="编辑提示词" preset="card" style="width: 640px" :bordered="false">
      <div style="padding: 8px 0">
        <NForm label-placement="top" size="small">
          <NFormItem label="名称" required>
            <NInput v-model:value="promptFormName" placeholder="例如：评测类口播" />
          </NFormItem>
          <NFormItem label="适用模式" required>
            <NSelect
              v-model:value="promptFormMode"
              :options="[
                { label: '🎥 默认（产品/场景展示）', value: 'default' },
                { label: '🎙️ 真人出镜口播', value: 'host' }
              ]"
            />
          </NFormItem>
          <NFormItem label="提示词内容（系统提示词）" required>
            <NInput
              v-model:value="promptFormContent"
              type="textarea"
              :autosize="{ minRows: 10, maxRows: 20 }"
              placeholder="输入完整的系统提示词…"
              style="font-family: monospace; font-size: 12px"
            />
          </NFormItem>
        </NForm>
        <NSpace justify="end" style="margin-top: 12px">
          <NButton @click="showPromptModal = false">取消</NButton>
          <NButton type="primary" :loading="promptSaving" @click="handleSavePrompt">
            保存提示词
          </NButton>
        </NSpace>
      </div>
    </NModal>
  </NModal>
</template>

<style scoped>
.tab-body {
  padding: 8px 0;
}

.settings-group {
  margin-bottom: 4px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.group-desc {
  font-size: 12px;
  color: #999;
  margin: 0 0 12px;
}
</style>
