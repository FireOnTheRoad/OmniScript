<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  NButton, NSpace, NModal, NInputNumber, NCard, NTag, NSpin, NEmpty, NInput,
  NForm, NFormItem, NDivider, NPopconfirm, NScrollbar, NCheckbox
} from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useProject } from '@/composables/useProject'
import { useStoryboard } from '@/composables/useStoryboard'
import { useScript } from '@/composables/useScript'
import { useAiAssistant } from '@/composables/useAiAssistant'
import { notify } from '@/utils/notify'
import type { Shot, RecentProject } from '@/types'

const projectStore = useProjectStore()
const selectionStore = useSelectionStore()
const { loadWorkspace, openProject, newProject, saveProject, removeRecentProject } = useProject()
const { addShotForParagraph, smartSplitAll, smartSplitSelected, deleteShot } = useStoryboard()
const { parseParagraphs } = useScript()

const editorText = ref(projectStore.script)
const isEditing = ref(false)
const editingParagraphs = ref<string[]>([])
const showSmartSplitModal = ref(false)
const smartSplitCount = ref(1)
const workspaceLoading = ref(true)
const aiSelectedParagraphs = ref<Set<number>>(new Set())

const workspacePath = ref('')
const recentProjects = ref<RecentProject[]>([])

const newProjectName = ref('')
const newProjectDesc = ref('')
const showNewProjectForm = ref(false)
const creatingProject = ref(false)

const paragraphs = computed(() => parseParagraphs(editorText.value))

const selectedShots = computed(() => {
  const idx = selectionStore.selectedParagraphIndex
  if (idx < 0) return projectStore.shots
  return projectStore.shots.filter((s) => s.scriptRef?.paragraphIndex === idx)
})

function getShotCountForParagraph(pIdx: number): number {
  return projectStore.shots.filter((s) => s.scriptRef?.paragraphIndex === pIdx).length
}

function formatDate(isoStr: string): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 7) return `${days} 天前`
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return isoStr
  }
}

async function handleCreateProject(): Promise<void> {
  if (!newProjectName.value.trim()) return
  creatingProject.value = true
  const success = await newProject(newProjectName.value, newProjectDesc.value)
  if (success) {
    showNewProjectForm.value = false
    newProjectName.value = ''
    newProjectDesc.value = ''
    refreshWorkspace()
  }
  creatingProject.value = false
}

async function handleOpenProject(projectPath: string): Promise<void> {
  await openProject(projectPath)
  refreshWorkspace()
}

async function handleRemoveRecent(projectPath: string): Promise<void> {
  await removeRecentProject(projectPath)
  refreshWorkspace()
}

async function refreshWorkspace(): Promise<void> {
  const ws = await loadWorkspace()
  workspacePath.value = ws.workspacePath
  recentProjects.value = ws.recentProjects
}

function handleParagraphClick(index: number): void {
  selectionStore.selectParagraph(index)
}

function isParagraphSelected(index: number): boolean {
  return selectionStore.selectedParagraphIndex === index
}

function startEditing(): void {
  editingParagraphs.value = [...parseParagraphs(editorText.value)]
  if (editingParagraphs.value.length === 0) {
    editingParagraphs.value.push('')
  }
  isEditing.value = true
}

function addEditingParagraph(): void {
  editingParagraphs.value.push('')
}

function removeEditingParagraph(index: number): void {
  editingParagraphs.value.splice(index, 1)
  if (editingParagraphs.value.length === 0) {
    editingParagraphs.value.push('')
  }
}

function handleSaveScript(): void {
  editorText.value = editingParagraphs.value.join('\n\n')
  projectStore.updateScript(editorText.value)
  saveProject()
  isEditing.value = false
}

function cancelEdit(): void {
  editingParagraphs.value = []
  isEditing.value = false
}

function toggleAiSelect(pIdx: number): void {
  const s = new Set(aiSelectedParagraphs.value)
  if (s.has(pIdx)) {
    s.delete(pIdx)
  } else {
    s.add(pIdx)
  }
  aiSelectedParagraphs.value = s
}

function toggleAiSelectAll(): void {
  if (aiSelectedParagraphs.value.size === paragraphs.value.length) {
    aiSelectedParagraphs.value = new Set()
  } else {
    aiSelectedParagraphs.value = new Set(paragraphs.value.map((_, i) => i))
  }
}

function handleSmartSplit(paragraphIndex: number): void {
  selectionStore.selectParagraph(paragraphIndex)
  showSmartSplitModal.value = true
}

function confirmSmartSplitSelected(): void {
  const idx = selectionStore.selectedParagraphIndex
  if (idx >= 0) {
    const newShots = smartSplitSelected(idx, smartSplitCount.value)
    if (newShots.length > 0) {
      selectionStore.selectShot(newShots[newShots.length - 1].id)
    }
  }
  showSmartSplitModal.value = false
  saveProject()
}

function handleSmartSplitAll(): void {
  smartSplitAll()
  saveProject()
}

function handleAddShotForParagraph(paragraphIndex: number): void {
  const paragraphText = paragraphs.value[paragraphIndex] || ''
  const shot = addShotForParagraph(paragraphIndex, paragraphText)
  selectionStore.selectShot(shot.id)
  saveProject()
}

function handleDeleteShot(shotId: string): void {
  deleteShot(shotId)
  saveProject()
}

const { isConfigValid, generateShots } = useAiAssistant()

const showAiConfirm = ref(false)
const aiLoading = ref(false)

async function handleAiSplit(): Promise<void> {
  const config = await refreshAiConfig()
  if (!isConfigValid(config)) {
    notify().info('请先在设置中配置 AI API Key')
    return
  }
  aiSelectedParagraphs.value = new Set()
  showAiConfirm.value = true
}

const selectedAiCount = computed(() => aiSelectedParagraphs.value.size)

async function refreshAiConfig() {
  const { getAiConfig } = useAiAssistant()
  return await getAiConfig()
}

async function confirmAiSplit(): Promise<void> {
  showAiConfirm.value = false
  aiLoading.value = true

  try {
    const currentParagraphs = parseParagraphs(editorText.value)
    let selectedIndices: number[]

    if (aiSelectedParagraphs.value.size > 0) {
      selectedIndices = [...aiSelectedParagraphs.value].sort((a, b) => a - b)
    } else {
      selectedIndices = currentParagraphs.map((_, i) => i)
    }

    const selectedTexts = selectedIndices.map((i) => currentParagraphs[i])
    const combinedText = selectedTexts.join('\n\n')

    const aiShots = await generateShots(combinedText)

    const newShots: Shot[] = []
    let shotCounter = 1

    for (let aiIdx = 0; aiIdx < aiShots.length; aiIdx++) {
      const aiResult = aiShots[aiIdx]
      const dialogue = aiResult.dialogue || ''

      let paraIdx = selectedIndices[0]
      let paraText = currentParagraphs[paraIdx]

      for (const si of selectedIndices) {
        const pt = currentParagraphs[si]
        if (pt.includes(dialogue.trim()) || dialogue.trim().includes(pt)) {
          paraIdx = si
          paraText = pt
          break
        }
      }

      const shot: Shot = {
        id: `shot-${Date.now()}-${aiIdx}`,
        number: shotCounter++,
        scene: aiResult.scene as Shot['scene'],
        camera: aiResult.camera as Shot['camera'],
        duration: typeof aiResult.duration === 'number' && aiResult.duration >= 0
          ? aiResult.duration
          : 3,
        transition: aiResult.transition as Shot['transition'],
        description: aiResult.description || '',
        dialogue: dialogue || paraText,
        scriptRef: { paragraphIndex: paraIdx, text: paraText.substring(0, 100) },
        notes: ''
      }
      newShots.push(shot)
    }

    if (aiSelectedParagraphs.value.size > 0) {
      const otherShots = projectStore.shots.filter(
        (s) => s.scriptRef?.paragraphIndex !== undefined && !selectedIndices.includes(s.scriptRef.paragraphIndex)
      )
      projectStore.shots.splice(0, projectStore.shots.length)
      for (const shot of otherShots) {
        shot.number = shotCounter++
        projectStore.addShot(shot)
      }
      for (const shot of newShots) {
        projectStore.addShot(shot)
      }
    } else {
      projectStore.shots.splice(0, projectStore.shots.length)
      for (const shot of newShots) {
        projectStore.addShot(shot)
      }
    }

    projectStore.renumberShots()
    saveProject()
    notify().success(`已生成 ${newShots.length} 个分镜`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 分析失败'
    notify().error(msg)
  } finally {
    aiLoading.value = false
  }
}

onMounted(async () => {
  await refreshWorkspace()
  workspaceLoading.value = false
})

watch(() => projectStore.script, (newScript) => {
  editorText.value = newScript
  isEditing.value = false
})
</script>

<template>
  <div class="script-view">
    <template v-if="projectStore.hasOpenProject">
      <!-- ====== 已打开项目：剧本编辑 ====== -->
      <div class="script-editor-panel">
        <div class="panel-header">
          <span>📄 剧本 / 旁白</span>
          <NSpace>
            <NButton
              v-if="!isEditing"
              size="small"
              @click="startEditing"
            >
              编辑
            </NButton>
            <NButton
              v-if="isEditing"
              size="small"
              type="primary"
              @click="handleSaveScript"
            >
              保存
            </NButton>
            <NButton
              v-if="isEditing"
              size="small"
              @click="cancelEdit"
            >
              取消
            </NButton>
            <NButton
              size="small"
              @click="handleSmartSplitAll"
            >
              全部拆解
            </NButton>
            <NButton
              size="small"
              type="info"
              :loading="aiLoading"
              @click="handleAiSplit"
            >
              {{ aiLoading ? '⏳ AI 分析中…' : '🤖 AI 智能分镜' }}
            </NButton>
          </NSpace>
        </div>

        <div class="script-content">
          <template v-if="isEditing">
            <NScrollbar style="max-height: calc(100vh - 140px)">
              <div class="editing-paragraphs">
                <div
                  v-for="(para, pIdx) in editingParagraphs"
                  :key="pIdx"
                  class="editing-para-row"
                >
                  <span class="editing-para-label">段{{ pIdx + 1 }}</span>
                  <NInput
                    v-model:value="editingParagraphs[pIdx]"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    :placeholder="`第 ${pIdx + 1} 段文案…`"
                    class="editing-para-input"
                  />
                  <NButton
                    size="tiny"
                    quaternary
                    type="error"
                    @click="removeEditingParagraph(pIdx)"
                    v-if="editingParagraphs.length > 1"
                  >
                    ✕
                  </NButton>
                </div>
                <NButton
                  size="small"
                  dashed
                  style="margin-top: 8px; width: 100%"
                  @click="addEditingParagraph"
                >
                  + 添加段落
                </NButton>
              </div>
            </NScrollbar>
          </template>
          <template v-else>
            <NScrollbar style="max-height: calc(100vh - 140px)">
              <div class="script-paragraphs">
                <div class="ai-select-bar" v-if="paragraphs.length > 0">
                  <NCheckbox
                    size="small"
                    :checked="aiSelectedParagraphs.size === paragraphs.length"
                    @update:checked="toggleAiSelectAll"
                  >
                    全选段落 ({{ aiSelectedParagraphs.size }}/{{ paragraphs.length }})
                  </NCheckbox>
                </div>
                <div
                  v-for="(para, pIdx) in paragraphs"
                  :key="pIdx"
                  class="script-paragraph"
                  :class="{ 'paragraph-selected': isParagraphSelected(pIdx) }"
                  @click="handleParagraphClick(pIdx)"
                >
                  <div class="paragraph-index">
                    <NCheckbox
                      size="small"
                      :checked="aiSelectedParagraphs.has(pIdx)"
                      @click.stop
                      @update:checked="toggleAiSelect(pIdx)"
                    />
                    <span>{{ pIdx + 1 }}</span>
                  </div>
                  <div class="paragraph-text">{{ para }}</div>
                  <div class="paragraph-actions">
                    <NTag v-if="getShotCountForParagraph(pIdx) > 0" size="tiny" type="info" round style="margin-right: 2px">
                      {{ getShotCountForParagraph(pIdx) }}镜
                    </NTag>
                    <NButton size="tiny" quaternary @click.stop="handleAddShotForParagraph(pIdx)">
                      + 镜头
                    </NButton>
                    <NButton size="tiny" quaternary @click.stop="handleSmartSplit(pIdx)">
                      拆解
                    </NButton>
                  </div>
                </div>
                <NEmpty v-if="paragraphs.length === 0" description="暂无剧本内容，点击编辑开始" style="margin-top: 40px" />
              </div>
            </NScrollbar>
          </template>
        </div>
      </div>

      <!-- ====== 右侧关联分镜 ====== -->
      <div class="shot-preview-panel">
        <div class="panel-header">
          <span>🎬 关联分镜</span>
          <span v-if="selectionStore.selectedParagraphIndex >= 0" class="panel-hint">
            段落 {{ selectionStore.selectedParagraphIndex + 1 }} · {{ selectedShots.length }} 个分镜
          </span>
          <span v-else class="panel-hint">
            全部 {{ selectedShots.length }} 个分镜
          </span>
        </div>

        <NScrollbar style="flex: 1">
          <div class="shot-cards">
            <template v-if="selectedShots.length > 0">
              <NCard
                v-for="shot in selectedShots"
                :key="shot.id"
                size="small"
                class="shot-card"
                hoverable
              >
                <div class="shot-card-header">
                  <NTag type="info" size="small">{{ shot.number }}#</NTag>
                  <NTag size="small">{{ shot.scene }}</NTag>
                  <NTag size="small">{{ shot.camera }}</NTag>
                  <NTag size="small">{{ shot.duration }}s</NTag>
                  <NPopconfirm @positive-click="handleDeleteShot(shot.id)">
                    <template #trigger>
                      <NButton size="tiny" quaternary type="error">🗑</NButton>
                    </template>
                    删除该镜头？
                  </NPopconfirm>
                </div>
                <div class="shot-card-body">
                  <div class="shot-description">{{ shot.description || '（点击编辑添加描述）' }}</div>
                  <div v-if="shot.dialogue" class="shot-dialogue">💬 {{ shot.dialogue }}</div>
                </div>
              </NCard>
            </template>
            <NEmpty v-else description="暂无分镜，使用 AI 或手动添加" style="margin-top: 40px" />
          </div>
        </NScrollbar>
      </div>

      <!-- ====== 智能拆解弹窗 ====== -->
      <NModal v-model:show="showSmartSplitModal" title="智能拆解">
        <div style="padding: 16px; min-width: 280px">
          <p style="margin-bottom: 12px">为当前段落生成几个空镜头？</p>
          <NInputNumber v-model:value="smartSplitCount" :min="1" :max="20" style="width: 100%" />
          <NSpace justify="end" style="margin-top: 16px">
            <NButton @click="showSmartSplitModal = false">取消</NButton>
            <NButton type="primary" @click="confirmSmartSplitSelected">确认拆解</NButton>
          </NSpace>
        </div>
      </NModal>

      <NModal v-model:show="showAiConfirm" title="🤖 AI 智能分镜">
        <div style="padding: 16px; min-width: 320px">
          <p style="margin-bottom: 8px; font-weight: 600">AI 将分析所选段落并自动生成：</p>
          <ul style="margin: 0 0 12px; padding-left: 20px; font-size: 13px; color: #555; line-height: 1.8">
            <li>景别 / 运镜 / 时长</li>
            <li>转场 / 画面描述</li>
            <li>对白保持原样不修改</li>
          </ul>
          <p style="font-size: 12px; color: #888; margin-bottom: 12px">
            已选择 <strong>{{ selectedAiCount > 0 ? selectedAiCount : '全部' }}</strong> 段，AI 将保持段落顺序
          </p>
          <NSpace justify="end">
            <NButton @click="showAiConfirm = false">取消</NButton>
            <NButton type="info" @click="confirmAiSplit">开始分析</NButton>
          </NSpace>
        </div>
      </NModal>
    </template>

    <!-- ====== 未打开项目：欢迎页 / 项目管理 ====== -->
    <template v-else>
      <div class="welcome-page">
        <NSpin :show="workspaceLoading">
          <div class="welcome-content">
            <!-- 标题 -->
            <div class="welcome-hero">
              <h1 class="welcome-title">🎬 Storyboard</h1>
              <p class="welcome-subtitle">视频分镜设计桌面工具</p>
              <p class="workspace-info">工作区：{{ workspacePath }}</p>
            </div>

            <NDivider />

            <!-- 新建项目 -->
            <div class="section">
              <div class="section-header">
                <h3>📁 新建项目</h3>
                <NButton
                  type="primary"
                  size="medium"
                  @click="showNewProjectForm = !showNewProjectForm"
                  v-if="!showNewProjectForm"
                >
                  + 新建项目
                </NButton>
              </div>

              <div v-if="showNewProjectForm" class="new-project-form">
                <NForm label-placement="top">
                  <NFormItem label="项目名称" required>
                    <NInput
                      v-model:value="newProjectName"
                      placeholder="例如：短片《夏日》分镜"
                      @keyup.enter="handleCreateProject"
                    />
                  </NFormItem>
                  <NFormItem label="项目描述">
                    <NInput
                      v-model:value="newProjectDesc"
                      type="textarea"
                      placeholder="可选：简要描述项目内容、目标风格等"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                    />
                  </NFormItem>
                  <NSpace>
                    <NButton type="primary" :loading="creatingProject" @click="handleCreateProject">
                      创建项目
                    </NButton>
                    <NButton @click="showNewProjectForm = false">取消</NButton>
                  </NSpace>
                </NForm>
              </div>
            </div>

            <NDivider />

            <!-- 最近项目 -->
            <div class="section">
              <div class="section-header">
                <h3>🕐 最近打开的项目</h3>
              </div>

              <template v-if="recentProjects.length > 0">
                <div class="recent-list">
                  <div
                    v-for="project in recentProjects"
                    :key="project.path"
                    class="recent-item"
                  >
                    <div class="recent-info" @click="handleOpenProject(project.path)">
                      <div class="recent-name">{{ project.name || '未命名项目' }}</div>
                      <div class="recent-desc">
                        {{ project.description || '无描述' }}
                        <span class="recent-date">{{ formatDate(project.lastOpenedAt) }}</span>
                      </div>
                    </div>
                    <div class="recent-actions">
                      <NButton size="small" @click="handleOpenProject(project.path)">打开</NButton>
                      <NPopconfirm @positive-click="handleRemoveRecent(project.path)">
                        <template #trigger>
                          <NButton size="small" quaternary type="error">移除</NButton>
                        </template>
                        从最近列表中移除？
                      </NPopconfirm>
                    </div>
                  </div>
                </div>
              </template>
              <NEmpty v-else description="暂无最近项目，创建第一个项目吧" style="margin-top: 24px" />
            </div>
          </div>
        </NSpin>
      </div>
    </template>
  </div>
</template>

<style scoped>
.script-view {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.script-editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 13px;
  background: #fafafa;
}

.panel-hint {
  font-weight: 400;
  font-size: 12px;
  color: #888;
}

.script-content {
  flex: 1;
  padding: 12px;
  overflow: hidden;
}

.script-textarea :deep(.n-input__textarea-el) {
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 14px;
  line-height: 1.8;
}

.editing-paragraphs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editing-para-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.editing-para-label {
  font-size: 12px;
  color: #6366f1;
  font-weight: 600;
  min-width: 36px;
  padding-top: 8px;
}

.editing-para-input {
  flex: 1;
}

.ai-select-bar {
  padding: 4px 10px;
  background: #f0f4ff;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}

.script-paragraphs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.script-paragraph {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.script-paragraph:hover {
  background: #f0f0ff;
}

.script-paragraph:hover .paragraph-actions {
  opacity: 1;
}

.paragraph-selected {
  background: #e8e8ff;
  outline: 2px solid #6366f1;
  outline-offset: -2px;
}

.paragraph-index {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #aaa;
  min-width: 52px;
  text-align: center;
  padding-top: 2px;
}

.paragraph-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.7;
  color: #333;
}

.paragraph-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.shot-preview-panel {
  width: 420px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
}

.shot-cards {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shot-card {
  border-radius: 8px;
  overflow: visible;
}

.shot-card :deep(.n-card__content) {
  overflow: visible;
  word-break: break-word;
  white-space: normal;
}

.shot-card :deep(.n-card-header) {
  overflow: visible;
}

.shot-card-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.shot-card-body {
  font-size: 12px;
  word-break: break-word;
  white-space: pre-wrap;
}

.shot-description {
  color: #555;
  line-height: 1.6;
}

.shot-dialogue {
  margin-top: 6px;
  color: #6366f1;
  font-style: italic;
  line-height: 1.5;
}

/* ====== Welcome Page ====== */
.welcome-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #faf5ff 100%);
  overflow: auto;
}

.welcome-content {
  max-width: 600px;
  width: 100%;
  padding: 40px 32px;
}

.welcome-hero {
  text-align: center;
  margin-bottom: 16px;
}

.welcome-title {
  font-size: 28px;
  font-weight: 700;
  color: #6366f1;
  margin: 0 0 8px;
}

.welcome-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0 0 8px;
}

.workspace-info {
  font-size: 12px;
  color: #aaa;
  margin: 0;
  word-break: break-all;
}

.section {
  margin: 8px 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 15px;
  color: #444;
}

.new-project-form {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s;
}

.recent-item:hover {
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.15);
}

.recent-info {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.recent-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.recent-desc {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-date {
  color: #bbb;
  margin-left: 8px;
}

.recent-actions {
  display: flex;
  gap: 4px;
  margin-left: 12px;
  flex-shrink: 0;
}
</style>
