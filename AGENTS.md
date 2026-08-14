# AI 协作开发指南

本文件面向在本仓库中工作的 AI Agent 与开发者。目标是在不破坏本地优先、可迁移、可追溯数据模型的前提下演进谱笺。

## 1. 工作原则

- 以 `src/domain.ts` 为家谱事实、版本与校验的唯一权威；UI 不应自行创造领域规则。
- 默认本地优先：应用没有账号、后端、云同步、分享或多人协作。不要把规划能力写成已实现功能。
- 亲属事实与图谱展示分离：`persons`、`unions`、`parentChildRelations` 是事实；`views`、布局坐标、筛选和渲染节点只是展示数据。
- 所有导入数据和参考资料均不可信。使用 Zod/领域校验，不执行导入包内的脚本或不明内容。
- 历史数据必须保留来源和不确定性。缺载不等于不存在；冲突不应被擅自合并为确定事实。
- 除非用户明确要求，不要创建 Git 提交、暂存或推送；尤其不要推送到 `main`/`master`。

## 2. 架构地图

| 路径 | 职责 |
| --- | --- |
| `src/domain.ts` | v1/v2 schema、领域类型、默认值、迁移、引用/循环校验、领域操作。 |
| `src/App.tsx` | 编辑、只读预览、导入导出和人物志弹窗。 |
| `src/layout.ts` | ELK 布局；事实关系到人物节点、家庭单元和关系边的投影。 |
| `src/db.ts` | Dexie/IndexedDB 中的活动项目与图片 Blob。 |
| `src/media.ts` | 图片类型、尺寸、缩略图处理。 |
| `src/exporters.tsx` | JSON、`.genealogy.zip`、PDF、DOCX、EPUB 导入导出。 |
| `src/reference-data.ts` | `doc/参考数据/*.json` 到 v2 示例项目的规范化。 |
| `src/domain.test.ts` | 领域操作、迁移和样例回归测试起点。 |
| `doc/` | 需求、实现计划、参考数据和历史编纂边界。 |

## 3. 数据模型不可破坏规则

### 3.1 当前规范

规范文档为 `format: "genealogy-sample/v2"` 与 `schemaVersion: 2`。根字段是：

```text
project, sources, media, views, persons, unions, parentChildRelations
```

- `sources` 是可追溯证据的索引；所有 `sourceIds` 必须引用已存在来源。
- `media` 是图片元数据；二进制文件由 IndexedDB 或项目包中的 `assets/` 保存。
- `persons` 至少一项；`unions` 的双方必须存在且不能是同一人物。
- `parentChildRelations` 的类型只能为 `biological`、`adoptive`、`step`、`guardian`；不能自指、重复或形成循环。
- `certainty` 只能为 `confirmed`、`probable`、`disputed`。
- `views.positions` 只以人物 ID 映射坐标，不能替代或反推亲属事实。

任何修改都先检查并更新 `genealogyV2Schema`、类型、默认值与 `validateProject`，再修改 UI、布局和导入导出。

### 3.2 图谱家庭单元

`family-*` 节点是 `layout.ts` 为家谱树桩图生成的**投影节点**，不是存储在项目文档中的人物或关系。它将 `Union` 的配偶线与子女线汇合，并显示“婚配”或关系类型。不要把它写入 `persons`，也不要通过它直接修改事实数据。

在 family 模式中，当前布局按父母所在的第一个 `Union` 为子女选择家庭单元。多人多段婚配可能因此存在归属歧义。若要正确建模子女属于哪一段婚配，应设计可迁移的可选 `unionId` 或独立 family-child 模型；不要用 UI 猜测覆盖已有关系。

## 4. Schema 演进与兼容性流程

### 4.1 v1 → v2 的现有迁移

`parseProject` 按 `schemaVersion` 分派。v1 导入通过 `migrateV1` 转换为 v2：

- 创建默认 `family/TB` 视图和空 `media`；
- 将人物 `biography` 转为 `biography` 类型条目；
- 将 `achievements` 转为 `achievement` 类型条目；
- 给旧婚配和亲子关系补 `certainty: "confirmed"`；
- 再执行领域校验。

修改 v1 兼容逻辑前，必须保留并更新迁移回归测试。

### 4.2 新版本的必经步骤

当字段语义改变、关系模型重构、字段删除或需要重写数据时，必须升级 `format` 和 `schemaVersion`，不可伪装为 v2：

1. 在 `src/domain.ts` 保留旧 schema，并新增目标 schema、类型与纯迁移函数。
2. 让 `parseProject` 明确按版本分派；迁移后通过目标 schema 规范化并调用 `validateProject`。
3. 处理旧本地库：如 Dexie 表/索引变化，在 `src/db.ts` 新增版本迁移，禁止改写既有 Dexie 版本定义。
4. 处理交换包：更新 `src/exporters.tsx` 的 document/package manifest 版本、导入兼容分支和资产路径。
5. 同步更新编辑 UI、布局、参考数据转换、示例数据、README 与测试。
6. 覆盖旧文档、旧项目包、升级后保存再导出、未知版本拒绝等回归场景。

当前 v2 的 Zod 解析会移除未声明字段。不要把“添加任意 JSON 字段”当作无损扩展机制；若需要通用扩展，先实现明确的 `extensions` 容器和保留策略。

## 5. 导入导出与媒体

- 普通 JSON 是 `GenealogyProject` 文档，不携带 Blob 图片。
- `.genealogy.zip` 当前写出 `manifest.json`、`genealogy.json`、`assets/<media-id>/original`、`assets/<media-id>/thumbnail`。
- 导入支持 JSON、ZIP 与 `.genealogy.zip`；manifest 可选，当前接受 `genealogy-package/v1`、`genealogy-package/v2`。
- 图片规范：JPEG、PNG、WebP，单张不超过 10 MiB。新增格式或资产字段时同步更新 `domain.ts`、`media.ts`、`db.ts`、`exporters.tsx` 与 UI。
- 导入过程中媒体资产会写入 IndexedDB；不要声称当前导入具有原子回滚、完整性哈希校验或自动清理无引用资产。若实现这些能力，必须新增测试。

## 6. 历史数据维护

- 原始参考文件位于 `doc/参考数据/`；应用样例由 `src/reference-data.ts` 在运行时规范化。
- 每一条新增人物、婚配或亲子关系都应带可定位的 `sourceIds`；异文和争议用 `certainty` 与 `note` 保存。
- 不把“传说”转换为亲子边；明确的继嗣、养子、入继按现有规则映射为 `adoptive`。
- 不把史料未载推断为“无子”或“无配偶”。五朝参考数据不是完整宗室数据库，详见 `doc/示例数据/编纂状态.md`。
- 修改参考数据转换后，至少验证五朝样例均可 `parseProject`，且不存在悬空引用和血缘循环。

## 7. UI 与可访问性

- 编辑模式可以修改项目；图谱预览必须不挂载会调用 `setProject`/`updateView` 的编辑控件，并禁用节点拖拽、连线、删除和重连。
- 预览中的人物点击仅用于阅读人物志；人物志弹窗应保留 `role="dialog"`、`aria-modal`、可见关闭按钮与 Esc 关闭。
- 关系线颜色、线型和标签必须保持足够对比度；不要仅凭颜色区分关系类型。
- 长姓名、称号和日期必须受节点尺寸约束，避免覆盖其他节点；完整文本应通过 `title` 或详情弹窗可访问。
- 修改 `layout.ts` 时同步考虑 TB/LR/BT/RL 四种方向、家庭模式与血缘模式，以及边端点是否都存在于输出节点集合。

## 8. 质量与交付清单

### 修改前

1. 阅读将要变更的文件及相关 schema/测试。
2. 对陌生功能先梳理数据流与既有约束。
3. 若新增依赖，使用精确版本；说明原因和风险。

### 修改后

按改动范围选择并运行验证：

```zsh
npm run typecheck
npm run test
npm run lint
npm run build
```

- 数据模型、迁移、导入导出或参考数据变更：应更新或增加针对性测试。
- UI/样式变更：至少完成 typecheck、lint、build，并手动检查桌面与窄屏布局。
- 文档变更：检查命令、路径、版本和 JSON 示例与源码一致，并运行 `git diff --check`。
- 构建时若出现大 chunk 警告，应记录但不要把警告误报为失败；除非任务是性能优化，否则避免无关拆包改动。

### Git 约束

- 不执行提交、暂存、推送、重写历史、强制推送或破坏性清理，除非用户明确要求。
- 用户要求提交时，只暂存相关文件并保留 hooks；不要使用 `--no-verify`。
- 不修改 Git 全局/本地配置。

## 9. 文档同步

改变用户可见功能、数据格式、导出结构、兼容版本或历史样例边界时，同步更新：

- `README.md`：能力、使用方式、数据格式、项目包和兼容性；
- `AGENTS.md`：实现约束与协作流程；
- `doc/示例数据/编纂状态.md`：史料范围或转换规则变化；
- 其他受影响的需求/计划文档。
