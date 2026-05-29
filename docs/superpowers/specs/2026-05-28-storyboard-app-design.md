# Storyboard App — 视频分镜设计桌面工具

## 概述

**定位**：个人创作为主，兼顾小型视频工作室团队协作的桌面分镜设计工具。

**核心工作流**：文字先行（剧本 → 分镜拆解）+ 结构化表格管理。先写剧本/旁白，按段落拆解为分镜镜头卡片，填写景别、运镜、时长、画面描述等信息，最终导出为 PDF 分镜表或 Excel 数据表。

**平台策略**：Electron 桌面应用（离线优先），项目以文件夹+明文 JSON 存储，通过坚果云/Syncthing/WebDAV 等外部同步工具实现 Git 风格的异步团队协作。

---

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 桌面壳 | Electron | 窗口管理、原生菜单、文件关联 |
| 前端框架 | Vue 3 + TypeScript | Composition API + script setup |
| 构建工具 | Vite + electron-vite | 快速热更新，Vue + Electron 一站式 |
| UI 组件库 | Naive UI | Tree-shaking 好，TypeScript 原生，表格强 |
| Markdown 编辑器 | Milkdown | 插件化架构，支持 Vue，可定制段落组件 |
| 绘图引擎 | Fabric.js | 框架无关，简笔画 + 图片标注 |
| 状态管理 | Pinia | Vue 3 官方推荐 |
| 文件监听 | chokidar | 主进程监控项目目录，外部修改自动刷新 |
| 导出 PDF | jsPDF / Puppeteer | 简单表格 jsPDF，复杂排版 Puppeteer 截图 |
| 导出 Excel | ExcelJS | 支持样式、合并单元格 |

---

## 项目文件结构

每个项目是一个文件夹（建议后缀 `.storyboard`）：

```
我的短片.storyboard/
├── project.json          # 项目元数据（名称、作者、创建时间、设置）
├── script.md             # 剧本/旁白，Markdown 格式，人可直接阅读编辑
├── storyboard.json       # 分镜数据：镜头列表、镜号、时长、运镜、备注
├── assets/               # 参考图片、草图导出等资源文件
└── exports/              # 导出产物（PDF/Excel），不纳入同步
```

**设计原则**：全部明文，无需数据库。JSON 格式人可读，方便手动编辑和冲突合并。资源文件独立存放不膨胀主数据文件。

---

## 数据模型

### project.json

```json
{
  "name": "我的短片",
  "version": "1.0.0",
  "createdAt": "2026-05-28T10:00:00Z",
  "modifiedAt": "2026-05-28T14:30:00Z",
  "author": "张三",
  "settings": {
    "defaultShotDuration": 3,
    "frameRate": 24,
    "aspectRatio": "16:9",
    "exportTemplate": "default"
  }
}
```

### storyboard.json

```json
{
  "shots": [
    {
      "id": "shot-001",
      "number": 1,
      "scene": "中景",
      "camera": "固定",
      "duration": 4.5,
      "dialogue": "原来你在这里...",
      "description": "男主从左侧入画，手持咖啡杯，自然光从右窗打来",
      "scriptRef": {
        "paragraphIndex": 3,
        "text": "第三段：主角走进咖啡店..."
      },
      "refImage": "assets/scene-ref-01.jpg",
      "sketch": {
        "objects": [
          { "type": "rect", "x": 100, "y": 200, "w": 80, "h": 120, "stroke": "#333" },
          { "type": "circle", "x": 140, "y": 180, "r": 20, "stroke": "#333" },
          { "type": "arrow", "x1": 50, "y1": 200, "x2": 250, "y2": 200 }
        ]
      },
      "annotations": [
        { "type": "text", "x": 120, "y": 300, "content": "主光源方向" },
        { "type": "arrow", "x1": 400, "y1": 200, "x2": 500, "y2": 200, "label": "人物走向" }
      ],
      "transition": "切",
      "notes": "注意光线连续性，与上一镜保持一致"
    }
  ],
  "totalDuration": 128.5,
  "shotCount": 12
}
```

### 枚举值规范

| 字段 | 可选值 |
|------|--------|
| `scene`（景别） | 远景、全景、中景、近景、特写、大特写 |
| `camera`（运镜） | 固定、推、拉、摇、移、跟、升、降、旋转 |
| `transition`（转场） | 切、淡入、淡出、叠化、划像、闪白、黑场 |

---

## 应用架构

### Electron 双进程

- **主进程（Node.js）**：文件 I/O（JSON/MD 读写）、chokidar 文件监听、IPC 通信、系统菜单、文件关联
- **渲染进程（Vue 3）**：全部 UI 和交互，通过 IPC 与主进程通信

### 数据流向

```
文件系统 ←→ Electron 主进程（IPC Handler）←→ Pinia Store ←→ Vue 视图
```

- **用户编辑**：Vue 视图 → Pinia Store 更新 → IPC 通知主进程 → 写入 JSON 文件
- **外部修改（坚果云同步）**：chokidar 检测文件变更 → IPC 通知 Store → Vue 视图自动刷新

### 目录结构

```
storyboard-app/
├── electron/              # Electron 主进程
│   ├── main.ts            # 窗口管理、菜单、IPC、文件关联
│   ├── preload.ts         # 安全暴露 API 给渲染进程
│   ├── ipc/               # IPC 处理：文件读写、导出、文件监听
│   └── file-watcher.ts    # 监控项目文件夹变更（chokidar）
├── src/                   # Vue 3 渲染进程
│   ├── App.vue            # 根组件：布局骨架 + 路由
│   ├── views/             # 三大视图页面
│   │   ├── ScriptView.vue       # 剧本编辑视图
│   │   ├── StoryboardView.vue   # 分镜表视图
│   │   └── ShotEditView.vue     # 镜头绘图视图
│   ├── components/        # 业务组件
│   │   ├── script/        # 剧本相关
│   │   │   ├── ScriptEditor.vue        # Markdown 编辑器（Milkdown）
│   │   │   ├── ScriptParagraph.vue     # 段落组件（可选中）
│   │   │   └── SmartSplitBtn.vue       # 智能拆解按钮
│   │   ├── storyboard/    # 分镜表相关
│   │   │   ├── ShotTable.vue           # 分镜表格（主视图）
│   │   │   ├── ShotCard.vue            # 镜头卡片（画廊模式）
│   │   │   └── ShotCardGrid.vue        # 卡片画廊
│   │   ├── editor/        # 绘图编辑相关
│   │   │   ├── CanvasDraw.vue          # 草图绘制画布（Fabric.js）
│   │   │   ├── CanvasToolbar.vue       # 绘图工具栏
│   │   │   ├── RefImageAnnotator.vue   # 参考图标注器
│   │   │   └── ShotPropertyPanel.vue   # 右侧属性面板
│   │   └── common/        # 通用组件
│   │       ├── AppHeader.vue           # 顶部工具栏
│   │       ├── StatusBar.vue           # 底部状态栏
│   │       └── ExportDialog.vue        # 导出对话框
│   ├── composables/       # 组合式函数（状态管理）
│   │   ├── useProject.ts       # 项目打开/保存/监听
│   │   ├── useScript.ts        # 剧本解析与状态
│   │   ├── useStoryboard.ts    # 分镜数组 CRUD
│   │   ├── useExport.ts        # PDF/Excel 导出逻辑
│   │   └── useIpc.ts           # Electron IPC 封装
│   ├── stores/            # Pinia 状态管理
│   │   ├── projectStore.ts     # 全局项目状态
│   │   └── selectionStore.ts   # 当前选中（段落/镜头）
│   ├── types/             # TypeScript 类型定义
│   │   └── index.ts            # Project, Shot, SketchObject 等
│   └── utils/             # 工具函数
│       ├── script-parser.ts      # Markdown 段落解析
│       ├── sketch-serializer.ts  # 草图数据序列化
│       └── export-pdf.ts / export-excel.ts
```

---

## 核心功能

### 1. 剧本编辑视图（ScriptView）

**布局**：左右分栏
- **左栏**：Milkdown Markdown 编辑器，显示剧本/旁白，段落模式（段落可选中、高亮）
- **右栏**：当前选中段落关联的分镜卡片列表

**功能**：
- 段落与分镜镜头双向关联（通过 scriptRef）
- 选中段落 → 右侧显示该段所有关联镜头
- 每个段落旁显示已关联镜头数量
- "智能拆解"：选中段落 → 自动生成 N 个空白镜头卡片（默认每个段落 1 个）
- "手动添加"：选中段落 → 点击按钮 → 创建一个空白镜头

### 2. 分镜表视图（StoryboardView）

**模式一：表格模式**
- 类 Excel 表格，所有镜头一览
- 列：镜号、缩略图、景别、运镜、时长、对白、转场、描述、备注
- 支持拖拽排序、行内编辑、批量修改
- 筛选/搜索

**模式二：卡片画廊模式**
- 镜头卡片网格布局
- 每张卡片显示：镜号 + 缩略图 + 核心信息 + 描述摘要
- 点击卡片进入绘图编辑视图

**跨视图联动**：剧本中选段落 → 分镜表过滤/高亮相关行

### 3. 镜头绘图视图（ShotEditView）

**布局**：左 Canvas 区 + 右属性面板
- **Canvas 区**：Fabric.js 画布
  - 简笔草图模式：画笔、矩形、圆形、箭头、文字工具
  - 参考图叠加标注模式：底图 + 半透明标注层
- **工具栏**：画笔粗细、颜色、撤销/重做
- **属性面板**：镜号（自动）、景别（下拉）、运镜（下拉）、时长（数字输入）、对白（文本区）、转场（下拉）、文字描述（文本区）、备注

---

## 导出功能

### PDF 分镜表
- A4 纸排版，按照分镜表格式输出
- 包含：标题、项目信息、镜号、景别、运镜、时长、画面描述、草图缩略图
- 自动分页，每页约 3-5 个镜头
- 技术方案：jsPDF 生成，复杂场景可用 Puppeteer 截图

### Excel 数据表
- 标准 xlsx 格式，带样式（表头着色、列宽自适应）
- 列：镜号、景别、运镜、时长(s)、对白/旁白、转场、画面描述、参考图路径、关联段落、备注
- 草图不导出到 Excel（仅路径引用）
- 技术方案：ExcelJS

---

## 文件协作（坚果云 / WebDAV）

### 机制
- 不内置同步服务，完全依赖外部同步工具
- 项目文件夹是普通文件，放入坚果云同步盘即可多设备/多人共享
- 应用通过 chokidar 监控文件变更，外部修改自动重新加载（防抖 500ms）

### 冲突处理
- 写入前检查文件 mtime，检测到外部修改时弹出提示
- 选项：覆盖（保留当前编辑）/ 放弃修改重新加载
- 坚果云产生冲突副本时，因文件为明文 JSON/MD，可手动对比合并

### 推荐工作流
- 各成员在不同时间段编辑同一项目
- 坚果云自动同步，应用自动检测外部变更并刷新
- 避免两人同时编辑同一文件

---

## 非功能需求

- **离线优先**：所有核心功能无需网络连接
- **文件轻量**：单个项目文件夹（不含 assets）通常 < 1MB
- **响应式数据**：编辑后自动保存（debounce 2s）
- **错误处理**：JSON 解析失败时提示用户，不丢失原始数据
- **跨平台**：Windows / macOS / Linux（Electron 支持）
