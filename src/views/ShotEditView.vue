<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  NButton, NSpace, NSelect, NInput, NInputNumber, NEmpty, NButtonGroup, NColorPicker
} from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import { useProject } from '@/composables/useProject'
import { useIpc } from '@/composables/useIpc'
import { useRouter } from 'vue-router'
import type { Shot, ShotScene, ShotCamera, ShotTransition } from '@/types'
import type { Canvas as FabricCanvas, Rect, Circle, Line, Group, PencilBrush, FabricObject } from 'fabric'

const props = defineProps<{
  shotId?: string
}>()

const projectStore = useProjectStore()
const { saveProject } = useProject()
const { invoke } = useIpc()
const router = useRouter()

const currentShot = computed<Shot | undefined>(() => {
  if (!props.shotId || props.shotId === 'new') return undefined
  return projectStore.shots.find((s) => s.id === props.shotId)
})

const localScene = ref<ShotScene>('中景')
const localCamera = ref<ShotCamera>('固定')
const localDuration = ref(3)
const localDialogue = ref('')
const localDescription = ref('')
const localTransition = ref<ShotTransition>('切')
const localNotes = ref('')

const canvasRef = ref<HTMLCanvasElement | null>(null)
const drawingTool = ref<'pen' | 'rect' | 'circle' | 'arrow' | 'eraser'>('pen')
const strokeColor = ref('#333333')
const strokeWidth = ref(2)
const showColorPicker = ref(false)

const sceneOptions = [
  { label: '远景', value: '远景' },
  { label: '全景', value: '全景' },
  { label: '中景', value: '中景' },
  { label: '近景', value: '近景' },
  { label: '特写', value: '特写' },
  { label: '大特写', value: '大特写' }
]

const cameraOptions = [
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

const transitionOptions = [
  { label: '切', value: '切' },
  { label: '淡入', value: '淡入' },
  { label: '淡出', value: '淡出' },
  { label: '叠化', value: '叠化' },
  { label: '划像', value: '划像' },
  { label: '闪白', value: '闪白' },
  { label: '黑场', value: '黑场' }
]

watch(
  () => currentShot.value,
  (shot) => {
    if (shot) {
      localScene.value = shot.scene
      localCamera.value = shot.camera
      localDuration.value = shot.duration
      localDialogue.value = shot.dialogue
      localDescription.value = shot.description
      localTransition.value = shot.transition
      localNotes.value = shot.notes
    }
  },
  { immediate: true }
)

let fabricCanvas: FabricCanvas | null = null
let canvasInitialized = false
let resizeObserver: ResizeObserver | null = null

let isDrawing = false
let startX = 0
let startY = 0
let currentShape: FabricObject | null = null

async function initCanvas(): Promise<void> {
  await nextTick()
  if (!canvasRef.value || canvasInitialized) return

  try {
    const fabric = await import('fabric')
    const { Canvas, PencilBrush } = fabric

    const parent = canvasRef.value.parentElement
    const w = parent?.clientWidth || 800
    const h = parent?.clientHeight || 600

    fabricCanvas = new Canvas(canvasRef.value, {
      width: w,
      height: h,
      backgroundColor: '#ffffff',
      selection: true
    })

    const brush = new PencilBrush(fabricCanvas)
    brush.color = strokeColor.value
    brush.width = strokeWidth.value
    fabricCanvas.freeDrawingBrush = brush
    fabricCanvas.isDrawingMode = true

    if (currentShot.value?.refImage && projectStore.projectPath) {
      try {
        const result = await invoke<{ success: boolean; dataUrl?: string; error?: string }>(
          'asset:read',
          projectStore.projectPath,
          currentShot.value.refImage
        )
        if (result.success && result.dataUrl) {
          const { FabricImage } = fabric
          const img = await FabricImage.fromURL(result.dataUrl)
          img.scaleToWidth(fabricCanvas.getWidth())
          img.scaleToHeight(fabricCanvas.getHeight())
          fabricCanvas.add(img)
          fabricCanvas.requestRenderAll()
        }
      } catch (err) {
        console.error('加载已有绘图失败:', err)
      }
    }

    setupDrawingEvents(fabricCanvas)

    resizeObserver = new ResizeObserver(() => {
      if (!fabricCanvas || !parent) return
      const nw = parent.clientWidth
      const nh = parent.clientHeight
      if (nw > 0 && nh > 0) {
        fabricCanvas.setDimensions({ width: nw, height: nh })
      }
    })
    if (parent) resizeObserver.observe(parent)

    canvasInitialized = true
  } catch (err) {
    console.error('Canvas init failed:', err)
  }
}

function setupDrawingEvents(canvas: FabricCanvas): void {
  canvas.on('mouse:down', (opt: any) => {
    const tool = drawingTool.value
    if (tool === 'pen' || tool === 'eraser') return

    const pointer = canvas.getScenePoint(opt.e)
    isDrawing = true
    startX = pointer.x
    startY = pointer.y

    if (tool === 'rect') {
      const fabric = requireFabric()
      if (!fabric) return
      currentShape = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: strokeColor.value,
        strokeWidth: strokeWidth.value,
        selectable: true
      })
      canvas.add(currentShape)
    } else if (tool === 'circle') {
      const fabric = requireFabric()
      if (!fabric) return
      currentShape = new fabric.Circle({
        left: startX,
        top: startY,
        radius: 0,
        fill: 'transparent',
        stroke: strokeColor.value,
        strokeWidth: strokeWidth.value,
        selectable: true
      })
      canvas.add(currentShape)
    } else if (tool === 'arrow') {
      const fabric = requireFabric()
      if (!fabric) return
      const line = new fabric.Line([startX, startY, startX, startY], {
        stroke: strokeColor.value,
        strokeWidth: strokeWidth.value,
        selectable: true
      })
      currentShape = line
      canvas.add(currentShape)
    }
  })

  canvas.on('mouse:move', (opt: any) => {
    if (!isDrawing || !currentShape) return
    const pointer = canvas.getScenePoint(opt.e)
    const tool = drawingTool.value
    const fabric = requireFabric()
    if (!fabric) return

    if (tool === 'rect' && currentShape.type === 'rect') {
      const rect = currentShape as unknown as Rect
      rect.set({
        width: Math.abs(pointer.x - startX),
        height: Math.abs(pointer.y - startY)
      })
      rect.set({ left: Math.min(pointer.x, startX), top: Math.min(pointer.y, startY) })
      canvas.requestRenderAll()
    } else if (tool === 'circle' && currentShape.type === 'circle') {
      const circle = currentShape as unknown as Circle
      const rx = Math.abs(pointer.x - startX) / 2
      const ry = Math.abs(pointer.y - startY) / 2
      circle.set({
        radius: Math.max(rx, ry),
        left: startX - Math.max(rx, ry),
        top: startY - Math.max(rx, ry)
      })
      canvas.requestRenderAll()
    } else if (tool === 'arrow' && currentShape.type === 'line') {
      const line = currentShape as unknown as Line
      line.set({ x2: pointer.x, y2: pointer.y })
      canvas.requestRenderAll()
    }
  })

  canvas.on('mouse:up', () => {
    if (!isDrawing || !currentShape) return
    const tool = drawingTool.value

    if (tool === 'arrow' && currentShape.type === 'line') {
      const fabric = requireFabric()
      if (!fabric) {
        isDrawing = false
        currentShape = null
        return
      }
      const line = currentShape as unknown as Line
      const x1 = (line as any).x1 ?? 0
      const y1 = (line as any).y1 ?? 0
      const x2 = (line as any).x2 ?? x1
      const y2 = (line as any).y2 ?? y1
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = 12 + strokeWidth.value * 2

      const tip = new fabric.Triangle({
        left: x2,
        top: y2,
        width: headLen,
        height: headLen * 0.6,
        fill: strokeColor.value,
        angle: fabric.util.radiansToDegrees(angle) + 90,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      })

      canvas.remove(currentShape)
      const group = new fabric.Group([line, tip], {
        selectable: true,
        hasControls: true
      })
      canvas.add(group)
    }

    isDrawing = false
    currentShape = null
  })
}

let fabricModule: typeof import('fabric') | null = null

function requireFabric(): typeof import('fabric') | null {
  return fabricModule
}

watch(drawingTool, (tool) => {
  if (!fabricCanvas) return
  if (tool === 'pen') {
    fabricCanvas.isDrawingMode = true
    const brush = fabricCanvas.freeDrawingBrush as PencilBrush
    brush.color = strokeColor.value
    brush.width = strokeWidth.value
  } else if (tool === 'eraser') {
    fabricCanvas.isDrawingMode = true
    const brush = fabricCanvas.freeDrawingBrush as PencilBrush
    brush.color = '#ffffff'
    brush.width = strokeWidth.value * 4
  } else {
    fabricCanvas.isDrawingMode = false
  }
})

watch(strokeColor, (color) => {
  if (!fabricCanvas) return
  if (drawingTool.value === 'pen') {
    const brush = fabricCanvas.freeDrawingBrush as PencilBrush
    brush.color = color
  }
})

watch(strokeWidth, (w) => {
  if (!fabricCanvas) return
  if (drawingTool.value === 'pen' || drawingTool.value === 'eraser') {
    const brush = fabricCanvas.freeDrawingBrush as PencilBrush
    brush.width = drawingTool.value === 'eraser' ? w * 4 : w
  }
})

function handleUndo(): void {
  if (!fabricCanvas) return
  const objects = fabricCanvas.getObjects()
  if (objects.length > 0) {
    fabricCanvas.remove(objects[objects.length - 1])
    fabricCanvas.requestRenderAll()
  }
}

function handleClear(): void {
  if (!fabricCanvas) return
  fabricCanvas.clear()
  fabricCanvas.backgroundColor = '#ffffff'
  fabricCanvas.requestRenderAll()
}

function cleanupCanvas(): void {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (fabricCanvas) {
    try {
      fabricCanvas.dispose()
    } catch {
      // ignore
    }
    fabricCanvas = null
    canvasInitialized = false
  }
}

async function handleSave(): Promise<void> {
  if (!currentShot.value) return

  const updates: Partial<Shot> = {
    scene: localScene.value,
    camera: localCamera.value,
    duration: localDuration.value,
    dialogue: localDialogue.value,
    description: localDescription.value,
    transition: localTransition.value,
    notes: localNotes.value
  }

  if (fabricCanvas && projectStore.projectPath) {
    const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 })
    try {
      const result = await invoke<{ success: boolean; relPath?: string; error?: string }>(
        'asset:save-data-url',
        projectStore.projectPath,
        currentShot.value.id,
        dataUrl
      )
      if (result.success && result.relPath) {
        updates.refImage = result.relPath
      }
    } catch (err) {
      console.error('保存绘图失败:', err)
    }
  }

  projectStore.updateShot(currentShot.value.id, updates)
  saveProject()
}

function handleBack(): void {
  router.push({ name: 'storyboard' })
}

onMounted(async () => {
  const fabric = await import('fabric')
  fabricModule = fabric
  await initCanvas()
})

onUnmounted(() => {
  cleanupCanvas()
})
</script>

<template>
  <div class="shot-edit-view">
    <div v-if="!currentShot" class="view-empty">
      <NEmpty description="请从分镜表中选择一个镜头进行编辑">
        <template #extra>
          <NButton type="primary" @click="handleBack">返回分镜表</NButton>
        </template>
      </NEmpty>
    </div>

    <template v-else>
      <div class="canvas-panel">
        <div class="panel-header">
          <div class="header-left">
            <NButton size="small" quaternary @click="handleBack">← 返回</NButton>
          </div>
          <span class="header-title">✏️ 镜{{ currentShot.number }} · 绘图</span>
          <div class="header-right">
            <NButton type="primary" size="small" @click="handleSave">保存修改</NButton>
          </div>
        </div>

        <div class="canvas-toolbar">
          <NButtonGroup size="small">
            <NButton
              :type="drawingTool === 'pen' ? 'primary' : 'default'"
              @click="drawingTool = 'pen'"
            >
              ✏️ 画笔
            </NButton>
            <NButton
              :type="drawingTool === 'rect' ? 'primary' : 'default'"
              @click="drawingTool = 'rect'"
            >
              ⬜ 矩形
            </NButton>
            <NButton
              :type="drawingTool === 'circle' ? 'primary' : 'default'"
              @click="drawingTool = 'circle'"
            >
              ⭕ 圆形
            </NButton>
            <NButton
              :type="drawingTool === 'arrow' ? 'primary' : 'default'"
              @click="drawingTool = 'arrow'"
            >
              ➡️ 箭头
            </NButton>
            <NButton
              :type="drawingTool === 'eraser' ? 'primary' : 'default'"
              @click="drawingTool = 'eraser'"
            >
              🧹 橡皮
            </NButton>
          </NButtonGroup>

          <NSpace :size="8">
            <span class="tool-label">颜色</span>
            <NInput
              v-model:value="strokeColor"
              size="small"
              style="width: 72px;"
              placeholder="#333"
            />
            <span class="tool-label">粗细</span>
            <NInputNumber
              v-model:value="strokeWidth"
              :min="1"
              :max="20"
              size="small"
              style="width: 56px;"
            />
            <NButton size="small" quaternary @click="handleUndo">↩ 撤销</NButton>
            <NButton size="small" quaternary @click="handleClear">🗑 清空</NButton>
          </NSpace>
        </div>

        <div class="canvas-body">
          <canvas ref="canvasRef" class="drawing-canvas"></canvas>
        </div>
      </div>

      <div class="property-panel">
        <div class="panel-header">⚙️ 镜头属性</div>
        <div class="property-body">
          <div class="prop-group">
            <div class="prop-label">镜号</div>
            <div class="prop-value-static">{{ currentShot.number }}</div>
          </div>

          <div class="prop-group">
            <div class="prop-label">景别</div>
            <NSelect
              v-model:value="localScene"
              :options="sceneOptions"
              size="small"
            />
          </div>

          <div class="prop-group">
            <div class="prop-label">运镜</div>
            <NSelect
              v-model:value="localCamera"
              :options="cameraOptions"
              size="small"
            />
          </div>

          <div class="prop-group">
            <div class="prop-label">时长 (秒)</div>
            <NInputNumber
              v-model:value="localDuration"
              :min="0.5"
              :max="120"
              :step="0.5"
              size="small"
            />
          </div>

          <div class="prop-group">
            <div class="prop-label">转场</div>
            <NSelect
              v-model:value="localTransition"
              :options="transitionOptions"
              size="small"
            />
          </div>

          <div class="prop-group">
            <div class="prop-label">对白/旁白</div>
            <NInput
              v-model:value="localDialogue"
              type="textarea"
              size="small"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="角色对白或旁白..."
            />
          </div>

          <div class="prop-group">
            <div class="prop-label">画面描述</div>
            <NInput
              v-model:value="localDescription"
              type="textarea"
              size="small"
              :autosize="{ minRows: 3, maxRows: 6 }"
              placeholder="描述画面构图、灯光、人物动作..."
            />
          </div>

          <div class="prop-group">
            <div class="prop-label">备注</div>
            <NInput
              v-model:value="localNotes"
              type="textarea"
              size="small"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="补充说明..."
            />
          </div>

          <div class="prop-actions">
            <NButton type="primary" block @click="handleSave">保存</NButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shot-edit-view {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.view-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-panel {
  flex: 1;
  min-width: 0;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
  min-height: 40px;
}

.header-left {
  min-width: 80px;
}

.header-title {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  color: #555;
}

.header-right {
  min-width: 100px;
  text-align: right;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.tool-label {
  font-size: 12px;
  color: #888;
}

.canvas-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f0f0f0;
}

.drawing-canvas {
  display: block;
}

.property-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.property-body {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.prop-group {
  margin-bottom: 14px;
}

.prop-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
  font-weight: 500;
}

.prop-value-static {
  font-size: 16px;
  font-weight: 700;
  color: #6366f1;
  padding: 4px 0;
}

.prop-actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
</style>
