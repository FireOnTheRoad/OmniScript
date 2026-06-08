<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { NButton, NInput, NSpace } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import { useProjectStore } from '@/stores/projectStore'
import { useVideoProject } from '@/composables/useVideoProject'

const props = defineProps<{
  currentTimestamp: number
}>()

const emit = defineEmits<{
  'update:markdown': [value: string]
  timestampClick: [totalSeconds: number]
}>()

const store = useProjectStore()
const { insertTimestamp, parseTimestamp } = useVideoProject()

const isPreview = ref(false)
const textareaRef = ref<InstanceType<typeof NInput> | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const localMarkdown = ref(store.videoMarkdown)

const renderedHtml = computed(() => {
  let html = md.render(localMarkdown.value)
  html = html.replace(/\[(\d{2}):(\d{2}):(\d{2})\]/g, (match, h, m, s) => {
    const seconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)
    return `<span class="ts-link" data-ts="${seconds}">${match}</span>`
  })
  return html
})

function handleInput(value: string): void {
  localMarkdown.value = value
  store.updateVideoMarkdown(value)
  emit('update:markdown', value)
}

function handleInsertTimestamp(): void {
  const ts = insertTimestamp(props.currentTimestamp)
  const el = textareaRef.value?.$el?.querySelector('textarea') as HTMLTextAreaElement | null
  if (el) {
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = localMarkdown.value
    localMarkdown.value = text.slice(0, start) + ts + text.slice(end)
    store.updateVideoMarkdown(localMarkdown.value)
    emit('update:markdown', localMarkdown.value)
    nextTick(() => {
      el.selectionStart = el.selectionEnd = start + ts.length
      el.focus()
    })
  } else {
    localMarkdown.value += ts
    store.updateVideoMarkdown(localMarkdown.value)
    emit('update:markdown', localMarkdown.value)
  }
}

function handlePreviewClick(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('.ts-link')
  if (target) {
    const ts = parseInt((target as HTMLElement).dataset.ts || '0', 10)
    if (!isNaN(ts)) {
      emit('timestampClick', ts)
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault()
    handleInsertTimestamp()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="markdown-editor">
    <div class="editor-toolbar">
      <NSpace :size="4">
        <NButton
          size="tiny"
          :type="!isPreview ? 'primary' : 'default'"
          @click="isPreview = false"
        >
          编辑
        </NButton>
        <NButton
          size="tiny"
          :type="isPreview ? 'primary' : 'default'"
          @click="isPreview = true"
        >
          预览
        </NButton>
      </NSpace>
      <NButton
        size="tiny"
        type="info"
        @click="handleInsertTimestamp"
        v-if="!isPreview"
      >
        🕐 插入时间码 (Ctrl+T)
      </NButton>
    </div>

    <div class="editor-content">
      <NInput
        v-if="!isPreview"
        ref="textareaRef"
        :value="localMarkdown"
        type="textarea"
        :autosize="{ minRows: 20 }"
        placeholder="在此撰写解说稿…&#10;&#10;使用 [HH:MM:SS] 格式插入时间戳，例如 [00:01:23]&#10;预览模式下点击时间戳可跳转到视频对应位置"
        @update:value="handleInput"
        class="md-textarea"
      />
      <div
        v-else
        ref="previewRef"
        class="md-preview"
        v-html="renderedHtml"
        @click="handlePreviewClick"
      />
    </div>
  </div>
</template>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  flex-shrink: 0;
}

.editor-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.md-textarea {
  height: 100%;
}

.md-textarea :deep(.n-input__textarea-el) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  padding: 12px;
}

.md-preview {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
}

.md-preview :deep(h1),
.md-preview :deep(h2),
.md-preview :deep(h3) {
  margin-top: 16px;
  margin-bottom: 8px;
  color: #1a1a2e;
}

.md-preview :deep(p) {
  margin: 8px 0;
}

.md-preview :deep(ul),
.md-preview :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.md-preview :deep(.ts-link) {
  display: inline-block;
  background: #eef2ff;
  color: #6366f1;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.15s;
  margin: 0 2px;
}

.md-preview :deep(.ts-link:hover) {
  background: #6366f1;
  color: #fff;
}
</style>
