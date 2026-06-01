<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NModal, NButton, NSpace, NInput, NInputNumber, NSelect, NDivider,
  NForm, NFormItem
} from 'naive-ui'
import { useIpc } from '@/composables/useIpc'
import { useAiAssistant } from '@/composables/useAiAssistant'
import { notify } from '@/utils/notify'
import type { AppSettings, AiConfig } from '@/types'

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

function handleClose(): void {
  emit('update:show', false)
}

const { getAiConfig, saveAiConfig: persistAiConfig } = useAiAssistant()

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

async function handleTestConnection(): Promise<void> {
  if (!aiApiKey.value.trim()) {
    notify().error('请先填写 API Key')
    return
  }
  testingConnection.value = true
  try {
    const { invoke } = useIpc()
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

onMounted(() => {
  loadAiConfig()
})
</script>

<template>
  <NModal
    :show="show"
    title="⚙️ 软件设置"
    preset="card"
    style="width: 540px"
    :bordered="false"
    @update:show="handleClose"
  >
    <div class="settings-body">
      <!-- 工作区路径 -->
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

      <!-- 默认参数 -->
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

      <NDivider />

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
  </NModal>
</template>

<style scoped>
.settings-body {
  padding: 4px 0;
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
