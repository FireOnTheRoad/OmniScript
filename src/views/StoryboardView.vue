<script setup lang="ts">
import { ref, computed, h, onMounted, watch, nextTick } from 'vue'
import {
  NButton, NSpace, NTag, NSelect, NInput, NEmpty, NDataTable,
  NButtonGroup, NPopconfirm, NModal, NInputNumber
} from 'naive-ui'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useProject } from '@/composables/useProject'
import { useStoryboard } from '@/composables/useStoryboard'
import { useIpc } from '@/composables/useIpc'
import { notify } from '@/utils/notify'
import { useRouter } from 'vue-router'
import type { Shot } from '@/types'

const projectStore = useProjectStore()
const selectionStore = useSelectionStore()
const { saveProject } = useProject()
const { deleteShot } = useStoryboard()
const { invoke } = useIpc()
const router = useRouter()

const viewMode = ref<'table' | 'cards'>('table')
const searchText = ref('')
const sceneFilter = ref<string | undefined>(undefined)
const cameraFilter = ref<string | undefined>(undefined)

// ====== image cache ======
const imageCache = ref<Record<string, string>>({})

async function loadImage(refImage: string): Promise<string> {
  if (!refImage) return ''
  if (imageCache.value[refImage]) return imageCache.value[refImage]
  try {
    const result = await invoke<{ success: boolean; dataUrl?: string }>(
      'asset:read',
      projectStore.projectPath,
      refImage
    )
    if (result.success && result.dataUrl) {
      imageCache.value[refImage] = result.dataUrl
      return result.dataUrl
    }
  } catch { /* ignore */ }
  return ''
}

async function uploadImageForShot(shotId: string): Promise<void> {
  const pickResult = await invoke<{ canceled: boolean; path?: string }>('dialog:pick-image')
  if (pickResult.canceled || !pickResult.path) return

  const copyResult = await invoke<{ success: boolean; relPath?: string; error?: string }>(
    'asset:copy-to-project',
    pickResult.path,
    projectStore.projectPath,
    shotId
  )
  if (copyResult.success && copyResult.relPath) {
    projectStore.updateShot(shotId, { refImage: copyResult.relPath })
    await loadImage(copyResult.relPath)
    saveProject()
  }
}

async function handleClickImage(shot: Shot): Promise<void> {
  if (shot.refImage && imageCache.value[shot.refImage]) {
    previewShot.value = shot
    previewVisible.value = true
  } else {
    await uploadImageForShot(shot.id)
  }
}

async function handleClickUploadBtn(shot: Shot, event: Event): Promise<void> {
  event.stopPropagation()
  await uploadImageForShot(shot.id)
}

// ====== image preview modal ======
const previewVisible = ref(false)
const previewShot = ref<Shot | null>(null)

function closePreview(): void {
  previewVisible.value = false
  previewShot.value = null
}

async function handlePreviewUpload(): Promise<void> {
  if (!previewShot.value) return
  await uploadImageForShot(previewShot.value.id)
  previewShot.value = projectStore.shots.find((s) => s.id === previewShot.value!.id) || previewShot.value
}

async function handlePreviewDelete(): Promise<void> {
  if (!previewShot.value) return
  projectStore.updateShot(previewShot.value.id, { refImage: '' })
  saveProject()
  previewShot.value = projectStore.shots.find((s) => s.id === previewShot.value!.id) || null
  notify().info('图片已删除')
}

// ====== column resize (on NDataTable native header) ======
const colWidths = ref<Record<string, number>>({
  image: 72,
  number: 60,
  scene: 72,
  camera: 64,
  duration: 60,
  dialogue: 130,
  transition: 64,
  description: 200,
  actions: 90
})

const minWidths: Record<string, number> = {
  image: 60, number: 48, scene: 56, camera: 56,
  duration: 52, dialogue: 80, transition: 56,
  description: 100, actions: 70
}

function attachResizeHandles(): void {
  nextTick(() => {
    const tableEl = document.querySelector('.storyboard-table-wrapper .n-data-table')
    if (!tableEl) return
    const thead = tableEl.querySelector('thead')
    if (!thead) return
    const ths = thead.querySelectorAll('th')

    const keyOrder = ['image', 'number', 'scene', 'camera', 'duration', 'dialogue', 'transition', 'description', 'actions']

    ths.forEach((th, i) => {
      const key = keyOrder[i]
      if (!key || key === 'actions') return
      ;(th as HTMLElement).style.position = 'relative'

      const existingHandle = th.querySelector('.col-resize-handle')
      if (existingHandle) return

      const handle = document.createElement('div')
      handle.className = 'col-resize-handle'
      handle.style.cssText = `
        position: absolute; right: 0; top: 0; bottom: 0;
        width: 6px; cursor: col-resize; z-index: 20;
        transition: background 0.1s;
      `
      handle.addEventListener('mouseenter', () => { handle.style.background = 'rgba(99,102,241,0.3)' })
      handle.addEventListener('mouseleave', () => { handle.style.background = '' })

      let startX = 0
      let startWidth = 0

      handle.addEventListener('mousedown', (e) => {
        handle.style.background = 'rgba(99,102,241,0.5)'
        startX = e.clientX
        startWidth = colWidths.value[key]

        const onMove = (me: MouseEvent) => {
          const delta = me.clientX - startX
          colWidths.value = { ...colWidths.value, [key]: Math.max(minWidths[key], startWidth + delta) }
        }
        const onUp = () => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          handle.style.background = ''
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        e.preventDefault()
      })

      th.appendChild(handle)
    })
  })
}

// ====== filters ======
const sceneOptions = [
  { label: '全部景别', value: undefined },
  { label: '远景', value: '远景' },
  { label: '全景', value: '全景' },
  { label: '中景', value: '中景' },
  { label: '近景', value: '近景' },
  { label: '特写', value: '特写' },
  { label: '大特写', value: '大特写' }
]

const cameraOptions = [
  { label: '全部运镜', value: undefined },
  { label: '固定', value: '固定' },
  { label: '推', value: '推' },
  { label: '拉', value: '拉' },
  { label: '摇', value: '摇' },
  { label: '移', value: '移' },
  { label: '跟', value: '跟' },
  { label: '升', value: '升' },
  { label: '降', value: '降' },
  { label: '旋转', value: '旋转' }
]

const filteredShots = computed<Shot[]>(() => {
  let shots = projectStore.shots
  if (sceneFilter.value) shots = shots.filter((s) => s.scene === sceneFilter.value)
  if (cameraFilter.value) shots = shots.filter((s) => s.camera === cameraFilter.value)
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    shots = shots.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.dialogue.toLowerCase().includes(q) ||
        String(s.number).includes(q)
    )
  }
  return shots
})

// ====== inline editing ======
const editingCell = ref<{ shotId: string; field: string } | null>(null)

const transitionOptions = [
  { label: '切', value: '切' },
  { label: '淡入', value: '淡入' },
  { label: '淡出', value: '淡出' },
  { label: '叠化', value: '叠化' },
  { label: '划像', value: '划像' },
  { label: '闪白', value: '闪白' },
  { label: '黑场', value: '黑场' }
]

function startEdit(shotId: string, field: string): void {
  editingCell.value = { shotId, field }
}

function isEditing(shotId: string, field: string): boolean {
  const e = editingCell.value
  return e !== null && e.shotId === shotId && e.field === field
}

function endEdit(): void {
  editingCell.value = null
}

function commitEdit(shotId: string, field: string, value: unknown): void {
  projectStore.updateShot(shotId, { [field]: value } as Partial<Shot>)
  endEdit()
  saveProject()
}

function updateField(shotId: string, field: string, value: unknown): void {
  projectStore.updateShot(shotId, { [field]: value } as Partial<Shot>)
}

function commitText(shotId: string, field: string, value: string): void {
  projectStore.updateShot(shotId, { [field]: value } as Partial<Shot>)
  endEdit()
  saveProject()
}

// ====== columns ======
const shotColumns = computed<DataTableColumns<Shot>>(() => [
  {
    title: '参考图',
    key: 'image',
    width: colWidths.value.image,
    render: (row) => {
      const src = imageCache.value[row.refImage || '']
      if (src) {
        return h('img', {
          src,
          style: 'width:54px;height:36px;object-fit:cover;border-radius:4px;cursor:pointer;display:block',
          onClick: (e: Event) => { e.stopPropagation(); handleClickImage(row) }
        })
      }
      return h(NButton, {
        size: 'tiny',
        quaternary: true,
        style: 'font-size:11px',
        onClick: (e: Event) => handleClickUploadBtn(row, e)
      }, { default: () => '📷 上传' })
    }
  },
  {
    title: '镜号',
    key: 'number',
    width: colWidths.value.number,
    sorter: (a, b) => a.number - b.number,
    render: (row) =>
      h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => `镜${row.number}` })
  },
  {
    title: '景别',
    key: 'scene',
    width: colWidths.value.scene,
    render: (row) => {
      if (isEditing(row.id, 'scene')) {
        return h(NSelect, {
          size: 'small',
          value: row.scene,
          options: sceneOptions.filter((o) => o.value !== undefined),
          placeholder: '选择景别',
          autofocus: true,
          onBlur: endEdit,
          'onUpdate:value': (val: string) => commitEdit(row.id, 'scene', val)
        })
      }
      return h(NButton, {
        size: 'tiny', quaternary: true, style: 'min-width:48px;justify-content:flex-start;font-size:12px',
        onClick: () => startEdit(row.id, 'scene')
      }, { default: () => row.scene || '—' })
    }
  },
  {
    title: '运镜',
    key: 'camera',
    width: colWidths.value.camera,
    render: (row) => {
      if (isEditing(row.id, 'camera')) {
        return h(NSelect, {
          size: 'small',
          value: row.camera,
          options: cameraOptions.filter((o) => o.value !== undefined),
          placeholder: '选择运镜',
          autofocus: true,
          onBlur: endEdit,
          'onUpdate:value': (val: string) => commitEdit(row.id, 'camera', val)
        })
      }
      return h(NButton, {
        size: 'tiny', quaternary: true, style: 'min-width:48px;justify-content:flex-start;font-size:12px',
        onClick: () => startEdit(row.id, 'camera')
      }, { default: () => row.camera || '—' })
    }
  },
  {
    title: '时长',
    key: 'duration',
    width: colWidths.value.duration,
    sorter: (a, b) => a.duration - b.duration,
    render: (row) => {
      if (isEditing(row.id, 'duration')) {
        return h(NInputNumber, {
          size: 'small',
          value: row.duration,
          min: 0,
          step: 0.5,
          style: 'width:100%',
          placeholder: '秒',
          autofocus: true,
          onBlur: endEdit,
          'onUpdate:value': (val: number | null) => {
            if (val !== null) commitEdit(row.id, 'duration', val)
          }
        })
      }
      return h(NButton, {
        size: 'tiny', quaternary: true, style: 'min-width:40px;justify-content:flex-start;font-size:12px;font-family:monospace',
        onClick: () => startEdit(row.id, 'duration')
      }, { default: () => `${row.duration}s` })
    }
  },
  {
    title: '对白/旁白',
    key: 'dialogue',
    width: colWidths.value.dialogue,
    render: (row) => {
      if (isEditing(row.id, 'dialogue')) {
        return h(NInput, {
          size: 'small',
          value: row.dialogue,
          placeholder: '输入对白…',
          autofocus: true,
          style: 'width:100%;font-size:12px',
          onBlur: () => { if (row.dialogue) commitText(row.id, 'dialogue', row.dialogue); else endEdit() },
          onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { commitText(row.id, 'dialogue', row.dialogue); e.preventDefault() } },
          'onUpdate:value': (val: string) => updateField(row.id, 'dialogue', val)
        })
      }
      return h('span', {
        style: 'font-size:12px;color:#6366f1;font-style:italic;cursor:text;display:inline-block;width:100%',
        onClick: () => startEdit(row.id, 'dialogue')
      }, row.dialogue || '—')
    }
  },
  {
    title: '转场',
    key: 'transition',
    width: colWidths.value.transition,
    render: (row) => {
      if (isEditing(row.id, 'transition')) {
        return h(NSelect, {
          size: 'small',
          value: row.transition,
          options: transitionOptions,
          placeholder: '转场',
          autofocus: true,
          onBlur: endEdit,
          'onUpdate:value': (val: string) => commitEdit(row.id, 'transition', val)
        })
      }
      return h(NTag, {
        size: 'tiny', bordered: false, type: 'warning',
        style: 'cursor:pointer',
        onClick: () => startEdit(row.id, 'transition')
      }, { default: () => row.transition })
    }
  },
  {
    title: '画面描述',
    key: 'description',
    width: colWidths.value.description,
    render: (row) => {
      if (isEditing(row.id, 'description')) {
        return h(NInput, {
          size: 'small',
          value: row.description,
          placeholder: '输入画面描述…',
          autofocus: true,
          style: 'width:100%;font-size:12px',
          onBlur: () => { if (row.description) commitText(row.id, 'description', row.description); else endEdit() },
          onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { commitText(row.id, 'description', row.description); e.preventDefault() } },
          'onUpdate:value': (val: string) => updateField(row.id, 'description', val)
        })
      }
      return h('span', {
        style: 'font-size:12px;cursor:text;display:inline-block;width:100%;color:#444',
        onClick: () => startEdit(row.id, 'description')
      }, row.description || '（无描述）')
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: colWidths.value.actions,
    render: (row) =>
      h(NSpace, { size: 2 }, () => [
        h(NButton, {
          size: 'tiny', quaternary: true,
          onClick: () => router.push({ name: 'shot-edit', params: { shotId: row.id } })
        }, { default: () => '编辑' }),
        h(NPopconfirm, {
          onPositiveClick: () => handleDelete(row.id)
        }, {
          trigger: () => h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, { default: () => '删除' }),
          default: () => '确定删除该镜头？'
        })
      ])
  }
])

function handleDelete(shotId: string): void {
  deleteShot(shotId)
  saveProject()
}

function handleEditShot(shotId: string): void {
  selectionStore.selectShot(shotId)
  router.push({ name: 'shot-edit', params: { shotId } })
}

const rowKey = (row: Shot): DataTableRowKey => row.id

watch(
  () => projectStore.shots,
  async (shots) => {
    for (const shot of shots) {
      if (shot.refImage && !imageCache.value[shot.refImage]) {
        await loadImage(shot.refImage)
      }
    }
  },
  { immediate: true, deep: false }
)

watch(viewMode, async (mode) => {
  if (mode === 'table') {
    await nextTick()
    attachResizeHandles()
  }
})

onMounted(async () => {
  await nextTick()
  attachResizeHandles()
})
</script>

<template>
  <div class="storyboard-view">
    <div v-if="!projectStore.hasOpenProject" class="view-empty">
      <NEmpty description="尚未打开项目，请切换到「📝 剧本编辑」新建或打开项目" />
    </div>

    <template v-else>
      <div class="view-toolbar">
        <div class="toolbar-left">
          <NButtonGroup size="small">
            <NButton :type="viewMode === 'table' ? 'primary' : 'default'" @click="viewMode = 'table'">
              📋 表格
            </NButton>
            <NButton :type="viewMode === 'cards' ? 'primary' : 'default'" @click="viewMode = 'cards'">
              🖼️ 画廊
            </NButton>
          </NButtonGroup>
          <span class="shot-count">共 {{ filteredShots.length }} 镜</span>
        </div>
        <div class="toolbar-filters">
          <NSelect v-model:value="sceneFilter" :options="sceneOptions" size="small" style="width:110px" placeholder="景别" clearable />
          <NSelect v-model:value="cameraFilter" :options="cameraOptions" size="small" style="width:110px" placeholder="运镜" clearable />
          <NInput v-model:value="searchText" size="small" style="width:160px" placeholder="搜索..." clearable />
        </div>
      </div>

      <div class="view-body">
        <!-- ====== Table Mode ====== -->
        <div v-if="viewMode === 'table'" class="storyboard-table-wrapper">
          <NDataTable
            :columns="shotColumns"
            :data="filteredShots"
            :row-key="rowKey"
            size="small"
            :bordered="true"
            :single-line="false"
            striped
            style="min-height: 100%"
          />
        </div>

        <!-- ====== Card Gallery Mode ====== -->
        <div v-if="viewMode === 'cards'" class="cards-container">
          <div v-if="filteredShots.length === 0" class="cards-empty">
            <NEmpty description="暂无匹配的镜头" />
          </div>
          <div v-else class="cards-grid">
            <div
              v-for="shot in filteredShots"
              :key="shot.id"
              class="shot-gallery-card"
              :class="{ 'card-selected': selectionStore.selectedShotId === shot.id }"
              @click="handleEditShot(shot.id)"
            >
              <div class="card-thumb">
                <img
                  v-if="imageCache[shot.refImage || '']"
                  :src="imageCache[shot.refImage || '']"
                  class="card-thumb-img"
                />
                <div v-else class="card-thumb-placeholder">
                  <NButton size="tiny" quaternary @click.stop="handleClickUploadBtn(shot, $event)">
                    🖼 上传
                  </NButton>
                </div>
                <div class="card-number">镜{{ shot.number }}</div>
              </div>
              <div class="card-body">
                <div class="card-tags">
                  <NTag size="tiny" :bordered="false">{{ shot.scene }}</NTag>
                  <NTag size="tiny" :bordered="false">{{ shot.camera }}</NTag>
                  <span class="card-duration">⏱ {{ shot.duration }}s</span>
                </div>
                <div class="card-desc">{{ shot.description || '（无描述）' }}</div>
                <div class="card-meta">
                  <NTag size="tiny" :bordered="false" type="warning">{{ shot.transition }}</NTag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ====== Image Preview Modal ====== -->
    <NModal
      v-model:show="previewVisible"
      preset="card"
      title="🔍 参考图预览"
      style="width: 80vw; max-width: 900px"
      :bordered="false"
      @update:show="closePreview"
    >
      <div v-if="previewShot" class="preview-body">
        <div class="preview-info">
          <NSpace :size="4">
            <NTag type="info" size="small">镜{{ previewShot.number }}</NTag>
            <NTag size="small">{{ previewShot.scene }}</NTag>
            <NTag size="small">{{ previewShot.camera }}</NTag>
            <span style="font-size:12px;color:#888">⏱ {{ previewShot.duration }}s</span>
          </NSpace>
        </div>

        <div class="preview-image-wrap">
          <img
            v-if="imageCache[previewShot.refImage || '']"
            :src="imageCache[previewShot.refImage || '']"
            class="preview-image"
          />
          <NEmpty v-else description="暂无参考图" style="height:240px;justify-content:center" />
        </div>

        <div class="preview-actions">
          <NSpace justify="center">
            <NButton type="primary" size="small" @click="handlePreviewUpload">
              📤 上传新图片
            </NButton>
            <NButton
              v-if="previewShot.refImage"
              type="error"
              size="small"
              ghost
              @click="handlePreviewDelete"
            >
              🗑 删除图片
            </NButton>
            <NButton size="small" @click="closePreview">
              关闭
            </NButton>
          </NSpace>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.storyboard-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.view-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shot-count {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ====== Table ====== */
.storyboard-table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.storyboard-table-wrapper :deep(.n-data-table) {
  font-size: 12px;
}

.storyboard-table-wrapper :deep(.n-data-table-th) {
  font-size: 12px;
  padding: 6px 8px;
  background: #f5f5f5;
  user-select: none;
}

/* ====== Card Gallery ====== */
.cards-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.cards-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.shot-gallery-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}

.shot-gallery-card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
}

.shot-gallery-card.card-selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.card-thumb {
  height: 120px;
  background: #f0f0f0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-thumb-placeholder {
  font-size: 13px;
  color: #aaa;
}

.card-number {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(99, 102, 241, 0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.card-body {
  padding: 10px 12px;
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.card-duration {
  font-size: 12px;
  color: #888;
  margin-left: auto;
}

.card-desc {
  font-size: 13px;
  color: #444;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  margin-top: 8px;
}

/* ====== Preview Modal ====== */
.preview-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-info {
  padding: 0 4px;
}

.preview-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  max-height: 65vh;
  overflow: hidden;
  background: #111;
  border-radius: 8px;
}

.preview-image {
  max-width: 100%;
  max-height: 65vh;
  object-fit: contain;
}

.preview-actions {
  padding: 8px 0 4px;
  border-top: 1px solid #e5e7eb;
}
</style>
