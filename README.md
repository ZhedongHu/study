# 学习中心 · 自主学习平台

基于 **Material Design 3** 设计语言的纯前端静态自主学习平台。每一节课都是一个 Markdown 文件，**零依赖、纯手写**，可直接部署到 GitHub Pages。

界面参考了 [Android 开发者培训课程](https://developer.android.google.cn/courses) 的「课程 → 单元 → 课时」层级结构。

## 功能特性

- 📚 多课程 + 单元 + 课时 三层结构
- 🗂️ 课时由 `content/courses.json` 清单驱动，增删改极简
- 📝 每节课是一个独立 Markdown 文件，支持标题 / 列表 / 表格 / 代码块高亮 / 引用 / 图片 / 链接
- ✅ 学习进度本地保存（localStorage），侧栏显示完成勾选
- 🔍 全局搜索（课程 / 单元 / 课时）
- 🌗 明暗主题切换（默认跟随系统）
- 📑 右侧页内目录（TOC）与滚动高亮
- 📱 响应式布局，移动端为抽屉式导航

## 目录结构

```
.
├── index.html              # 应用外壳
├── css/
│   └── styles.css          # MD3 设计令牌与全部样式（零依赖）
├── js/
│   ├── highlight.js        # 轻量语法高亮（零依赖）
│   ├── markdown.js         # Markdown 解析器（零依赖）
│   └── app.js              # 路由 / 渲染 / 进度 / 搜索 / 主题
├── content/
│   ├── courses.json        # ★ 课程清单（核心配置）
│   ├── assets/             # 课程图片等静态资源
│   └── <course>/<unit>/<lesson>.md   # 每节课一个 Markdown 文件
└── .nojekyll               # 禁用 GitHub Pages 的 Jekyll 处理
```

## 如何新增 / 修改 / 删除课时

所有内容都通过两个地方管理：**清单** 与 **Markdown 文件**。

### 1. 新增一课

1. 在对应课程/单元的目录下新建一个 `.md` 文件，例如
   `content/android-basics/get-started/new-lesson.md`，写入课程内容。
2. 打开 `content/courses.json`，在相应 `unit` 的 `lessons` 数组里加一项：

```json
{
  "id": "new-lesson",
  "title": "我的新课",
  "desc": "一句话简介（用于卡片与搜索）",
  "file": "content/android-basics/get-started/new-lesson.md"
}
```

> `id` 在同一课程内保持唯一即可；`file` 是相对于仓库根目录的路径。保存后刷新页面即可看到。

### 2. 修改一课

- 改内容：直接编辑对应的 `.md` 文件。
- 改标题 / 简介：编辑 `courses.json` 中该课的 `title` / `desc`。

### 3. 删除一课

从 `courses.json` 对应 `lessons` 数组中删掉该项，并（可选）删除对应的 `.md` 文件。

### 4. 新增 / 删除课程或单元

在 `courses.json` 中增删 `courses` 或某个课程的 `units` 节点即可，结构与现有示例完全一致。

## Markdown 写作提示

- 一级标题 `#` 通常作为课时大标题；页面会自动取用文件首个 `#` 作为标题。
- 代码块使用围栏语法并标注语言即可高亮：` ```kotlin ` / ` ```xml ` / ` ```bash `。
- 图片、链接的**相对路径**会相对于该 `.md` 文件所在目录解析，例如：

  ```md
  ![示意图](../../assets/architecture.svg)
  ```

- 表格用 `|` 分隔，第二行为 `---` 分隔线。
- 行内代码用反引号 `` `code` ``，加粗用 `**文字**`。

## 本地预览

由于浏览器安全策略，直接双击 `index.html`（file://）无法读取 Markdown 文件，需用静态服务器：

```bash
# 在项目根目录执行任一命令，然后访问 http://localhost:8000
python3 -m http.server 8000
# 或
npx serve .
```

## 部署到 GitHub Pages

1. 把整个仓库推送到 GitHub。
2. 仓库 **Settings → Pages**，Source 选择 `main` 分支（或你使用的分支）的 `/ (root)`。
3. 等待构建完成，访问 `https://<用户名>.github.io/<仓库名>/`。

> 因为所有资源均使用**相对路径**，项目页（`/仓库名/`）与用户页（`/`）都能正常工作，无需修改代码。

## 自定义主题色

主色在 `css/styles.css` 顶部的 `:root` 与 `[data-theme="dark"]` 中定义。
修改 `--md-sys-color-primary` 及其容器色（`primary-container` / `on-primary` 等）即可整体换肤。
