<script setup lang="ts">
import { ref, computed, h } from 'vue'
import {
  NButton, NSpace, NTag, NSelect, NInput, NEmpty, NDataTable,
  NButtonGroup, NPopconfirm
} from 'naive-ui'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useProject } from '@/composables/useProject'
import { useStoryboard } from '@/composables/useStoryboard'
import { useRouter } from 'vue-router'
import type { Shot } from '@/types'

const projectStore = useProjectStore()
const selectionStore = useSelectionStore()
const { saveProject } = useProject()
const { deleteShot } = useStoryboard()
const router = useRouter()

const viewMode = ref<'table' | 'cards'>('table')
const searchText = ref('')
const sceneFilter = ref<string | undefined>(undefined)
const cameraFilter = ref<string | undefined>(undefined)

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
  if (sceneFilter.value) {
    shots = shots.filter((s) => s.scene === sceneFilter.value)
  }
  if (cameraFilter.value) {
    shots = shots.filter((s) => s.camera === cameraFilter.value)
  }
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

const shotColumns = computed<DataTableColumns<Shot>>(() => [
  {
    title: '镜号',
    key: 'number',
    width: 60,
    sorter: (a, b) => a.number - b.number,
    render: (row) =>
      h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => `镜${row.number}` })
  },
  {
    title: '景别',
    key: 'scene',
    width: 80,
    render: (row) => row.scene
  },
  {
    title: '运镜',
    key: 'camera',
    width: 70,
    render: (row) => row.camera
  },
  {
    title: '时长',
    key: 'duration',
    width: 70,
    sorter: (a, b) => a.duration - b.duration,
    render: (row) => `${row.duration}s`
  },
  {
    title: '对白/旁白',
    key: 'dialogue',
    width: 120,
    ellipsis: { tooltip: true },
    render: (row) => row.dialogue || '—'
  },
  {
    title: '转场',
    key: 'transition',
    width: 70,
    render: (row) =>
      h(NTag, { size: 'tiny', bordered: false }, { default: () => row.transition })
  },
  {
    title: '画面描述',
    key: 'description',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (row) => row.description || '（无描述）'
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) =>
      h(NSpace, { size: 4 }, () => [
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          onClick: () => router.push({ name: 'shot-edit', params: { shotId: row.id } })
        }, { default: () => '编辑' }),
        h(NPopconfirm, {
          onPositiveClick: () => handleDelete(row.id)
        }, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, { default: () => '删除' }),
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

function handleRowClick(row: Shot): void {
  selectionStore.selectShot(row.id)
}

const rowKey = (row: Shot): DataTableRowKey => row.id
</script>

<template>
  <div class="storyboard-view">
    <div v-if="!projectStore.hasOpenProject" class="view-empty">
      <NEmpty description="尚未打开项目，请切换到「📝 剧本编辑」新建或打开项目">
      </NEmpty>
    </div>

    <template v-else>
      <div class="view-toolbar">
        <div class="toolbar-left">
          <NButtonGroup size="small">
            <NButton
              :type="viewMode === 'table' ? 'primary' : 'default'"
              @click="viewMode = 'table'"
            >
              📋 表格
            </NButton>
            <NButton
              :type="viewMode === 'cards' ? 'primary' : 'default'"
              @click="viewMode = 'cards'"
            >
              🖼️ 画廊
            </NButton>
          </NButtonGroup>
        </div>
        <div class="toolbar-filters">
          <NSelect
            v-model:value="sceneFilter"
            :options="sceneOptions"
            size="small"
            style="width: 110px;"
            placeholder="景别"
            clearable
          />
          <NSelect
            v-model:value="cameraFilter"
            :options="cameraOptions"
            size="small"
            style="width: 110px;"
            placeholder="运镜"
            clearable
          />
          <NInput
            v-model:value="searchText"
            size="small"
            style="width: 160px;"
            placeholder="搜索..."
            clearable
          />
        </div>
      </div>

      <div class="view-body">
        <!-- Table Mode -->
        <div v-if="viewMode === 'table'" class="table-container">
          <NDataTable
            :columns="shotColumns"
            :data="filteredShots"
            :row-key="rowKey"
            :max-height="undefined"
            size="small"
            :bordered="true"
            :single-line="false"
            striped
            virtual-scroll
            @update:checked-row-keys="() => {}"
          />
        </div>

        <!-- Card Gallery Mode -->
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
                <div class="card-thumb-placeholder">
                  <span>🎬</span>
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
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-body {
  flex: 1;
  overflow: hidden;
}

.table-container {
  height: 100%;
  overflow: auto;
  padding: 0;
}

.cards-container {
  height: 100%;
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
  height: 100px;
  background: #f0f0f0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-thumb-placeholder {
  font-size: 32px;
  opacity: 0.3;
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
</style>
