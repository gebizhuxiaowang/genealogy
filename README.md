# 谱笺（Genealogy）

谱笺是一个**本地优先（local-first）**的纯前端家谱编辑器。它用于在浏览器中记录人物、配偶/伴侣、亲子关系、史料来源、人物照片和多条人物记录，并将同一项目导出为可迁移数据、项目包和出版文件。

项目当前不依赖账号、服务端数据库或云同步。数据默认保存在当前浏览器的 IndexedDB 中；需要备份、换设备或跨浏览器使用时，请导出 `.genealogy.zip` 项目包后再导入。

## 当前能力

- 人物资料：姓名、称号/庙号、生卒、地点、角色、来源、存疑说明、多条时间线记录。
- 关系模型：配偶/婚配（`Union`）以及亲生、收养、继亲、监护等亲子关系。
- 图谱：家谱树桩图、血缘详情图、上/下/左/右四方向自动布局、手动微调与恢复自动布局。
- 图谱预览：只读浏览模式；点击人物以弹窗查看自动人物志。
- 图片：JPG、PNG、WebP，单张最大 10 MiB；图片保存在 IndexedDB，并可随项目包携带。
- 导出：原始 JSON、`.genealogy.zip` 项目包、PDF、Word（`.docx`）和 EPUB。
- 示例：唐、宋、元、明、清皇室近亲参考数据的 v2 转换样例。

> 历史示例仅包含参考数据中明确记录的主要成员与关系，不代表完整宗室或所有史书记录。详见 [`doc/示例数据/编纂状态.md`](doc/示例数据/编纂状态.md)。

## 快速开始

要求：Node.js 与 npm。

```zsh
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址即可使用。生产构建：

```zsh
npm run build
```

常用质量命令：

```zsh
npm run typecheck
npm run test
npm run lint
```

## 使用与备份

1. 在“图谱编辑”中维护人物、关系、照片和人物条目；修改会自动保存到当前浏览器。
2. 在“图谱预览”中只读查看关系，点击人物查看自动人物志。
3. 在“出版预览”中导出文件。
4. **跨浏览器或跨设备迁移请使用 `.genealogy.zip` 项目包。**普通 JSON 不包含图片二进制内容。

IndexedDB 受浏览器站点和本地存储状态影响；它不是独立备份。重要项目应定期导出项目包。

## 项目结构

```text
src/
  App.tsx             # 编辑、预览、导入导出 UI
  domain.ts           # schema、领域类型、校验、v1→v2 迁移
  db.ts               # IndexedDB 项目与媒体 Blob 持久化
  layout.ts           # ELK 图谱投影、关系线与家庭单元
  exporters.tsx       # JSON/项目包/PDF/Word/EPUB 导入导出
  reference-data.ts   # 参考历史数据到 v2 的规范化
  domain.test.ts      # 领域模型与迁移测试
doc/
  需求.md
  开发计划.md
  参考数据/           # 唐宋元明清原始参考数据
  示例数据/           # 编纂范围和历史数据说明
```

## 数据格式

### 文档根结构（v2）

应用的规范交换格式为：

```json
{
  "format": "genealogy-sample/v2",
  "schemaVersion": 2,
  "project": { "id": "project-demo", "name": "示例家谱" },
  "sources": [],
  "media": [],
  "views": [
    {
      "id": "view-family",
      "name": "家谱树桩图",
      "mode": "family",
      "direction": "TB",
      "showDates": true,
      "showPortraits": true,
      "showAcademicNotes": false,
      "positions": {}
    }
  ],
  "persons": [
    {
      "id": "person-founder",
      "name": "始祖",
      "roles": [],
      "entries": [],
      "mediaIds": [],
      "sourceIds": [],
      "certainty": "confirmed"
    }
  ],
  "unions": [],
  "parentChildRelations": []
}
```

`format` 与 `schemaVersion` 必须成对声明。当前规范版本为 `genealogy-sample/v2` / `2`；导入入口会通过 `parseProject` 做 schema 解析、迁移与关系校验。

| 字段 | 含义 | 关键规则 |
| --- | --- | --- |
| `project` | 项目元数据 | 必须有非空 `id`、`name`；可选 `dynasty`、`coverage`、`updatedAt`。 |
| `sources` | 史料来源 | 每项具有 `id`、`title`、`type`；人物、关系、媒体和条目通过 `sourceIds` 引用它。 |
| `media` | 图片元数据 | 仅 JPEG/PNG/WebP，`size` 不超过 10 MiB；二进制 Blob 不写入普通 JSON。 |
| `views` | 图谱视图配置 | 至少一个；包含 `family`/`blood`、`TB`/`LR`/`BT`/`RL`、显示选项与人物坐标。视图不改变亲属事实。 |
| `persons` | 人物事实 | 至少一个；含姓名、可选生卒/地点/称号、`roles`、`entries`、媒体引用、来源和置信度。 |
| `unions` | 配偶或伴侣关系 | `partnerIds` 固定为两个存在的人物 ID；`type` 默认为 `marriage`。 |
| `parentChildRelations` | 亲子关系 | `parentId`、`childId` 指向现有成员；类型为 `biological`、`adoptive`、`step` 或 `guardian`。 |

### 人物、条目与不确定性

人物的 `entries` 用于可排序的生平、成就、官职、迁徙、教育或其他记录：

```json
{
  "id": "person-li",
  "name": "李某",
  "courtesyOrTempleName": "某宗",
  "roles": ["emperor"],
  "entries": [
    {
      "id": "entry-reign",
      "category": "biography",
      "title": "帝位与承继",
      "startDate": "1000",
      "content": "可核验的事实说明。",
      "sourceIds": ["source-history"],
      "mediaIds": [],
      "certainty": "confirmed",
      "order": 0
    }
  ],
  "mediaIds": [],
  "sourceIds": ["source-history"],
  "certainty": "confirmed"
}
```

`certainty` 的可用值：

- `confirmed`：可确认；
- `probable`：较可信但仍待核验；
- `disputed`：存在史料异文或学术争议。

不要把“史书未载”写成“没有子女/配偶”。对于异文、追尊、入继、兼祧或存疑母系，应以独立人物/关系、`sourceIds`、`certainty` 和 `note` 保留证据链。

### 关系示例

```json
{
  "unions": [
    {
      "id": "union-a-b",
      "partnerIds": ["person-a", "person-b"],
      "type": "marriage",
      "sourceIds": ["source-history"],
      "certainty": "confirmed"
    }
  ],
  "parentChildRelations": [
    {
      "id": "parent-a-child-c",
      "parentId": "person-a",
      "childId": "person-c",
      "type": "biological",
      "sourceIds": ["source-history"],
      "certainty": "confirmed"
    }
  ]
}
```

家谱树桩图中的“婚配”圆形节点是**图谱投影**：它将 `Union` 的双方与子女关系组织为便于阅读的结构。它不是额外的事实记录；关系事实仍只保存于 `unions` 和 `parentChildRelations`。

### 校验约束

导入以及新增配偶/亲子关系时会拒绝以下情况：

- 重复人物 ID；
- 人物、媒体、来源或关系引用不存在的对象；
- 配偶关系指向同一人物，或任一配偶不存在；
- 自指亲子关系、同类型重复亲子关系；
- 亲子关系形成血缘循环。

## JSON 与项目包

### 原始 JSON

“导出 JSON”会下载完整 `GenealogyProject` 结构，适合审阅、版本管理或外部处理；它**不包含 IndexedDB 中的原图与缩略图 Blob**。

### `.genealogy.zip` 项目包

“导出项目包”生成的文件结构如下：

```text
manifest.json                         # genealogy-package/v2、项目 ID、资产清单
genealogy.json                        # genealogy-sample/v2 文档
assets/<media-id>/original             # 原图 Blob
assets/<media-id>/thumbnail            # 缩略图 Blob
```

导入器支持 JSON、`.zip` 和 `.genealogy.zip`。对于项目包，它读取 `genealogy.json`，可选读取 `manifest.json`，并导入其中存在的媒体资产。当前接受 `genealogy-package/v1` 与 `genealogy-package/v2` manifest。

## 版本兼容与格式扩展

### 当前兼容策略

| 输入版本 | 处理方式 | 结果 |
| --- | --- | --- |
| `genealogy-sample/v1` / `schemaVersion: 1` | `migrateV1` 自动迁移 | 转为 v2、创建默认家谱视图、补空媒体列表；旧 `biography`/`achievements` 转为人物 `entries`。 |
| `genealogy-sample/v2` / `schemaVersion: 2` | Zod schema 解析并调用 `validateProject` | 作为当前规范使用。 |
| 未知文档版本 | 不支持 | 导入失败，不应猜测字段语义。 |

v1 的婚配与亲子记录会补充 `certainty: "confirmed"`；v1 不含可迁移的图片资产。v2 解析会按 schema 填充定义了默认值的字段。

### 扩展字段与破坏性升级

当前 v2 解析会剥离 schema 未声明字段。因此，**不要仅向 JSON 任意添加字段并假设旧客户端会无损保留它们**。

- 只增加可选字段且旧客户端可安全忽略时：仍应同步修改 `src/domain.ts` 的 Zod schema、类型、默认值、校验、编辑 UI、导出与测试。
- 改变字段语义、删除字段、变更关系模型或需要数据重写时：发布新的 `format` 与 `schemaVersion`，例如 v3；不要伪装成 v2。
- 若未来需要第三方扩展，应先设计并实现明确的 `extensions` 容器及其保留策略；当前版本没有通用的未知字段保留机制。

建议的升级步骤：

1. 在 `src/domain.ts` 定义新 schema 与 TypeScript 类型，保留旧 schema。
2. 新增从旧版本到目标版本的纯迁移函数，并在 `parseProject` 按 `schemaVersion` 分派。
3. 迁移后使用目标 schema 规范化，再运行 `validateProject`。
4. 同步更新 `src/exporters.tsx` 的 JSON/项目包版本和兼容读取逻辑；如 IndexedDB 结构变化，同步更新 `src/db.ts` 的 Dexie 版本迁移。
5. 更新 `src/App.tsx`、`src/layout.ts`、示例数据、测试和本 README。
6. 对旧文档、旧项目包和新文档分别执行导入、保存、再次导出的回归测试。

## 历史数据原则

唐、宋、元、明、清参考数据位于 [`doc/参考数据/`](doc/参考数据)，经 `src/reference-data.ts` 规范化为 v2 示例。正史、年表、世表、列传优先；公开资料仅用于交叉核验。参考转换不会把标为“传说”的关系生成亲子边，并将继嗣、养子、入继等明确记录转为 `adoptive`。

详见：

- [`doc/需求.md`](doc/需求.md)
- [`doc/开发计划.md`](doc/开发计划.md)
- [`doc/示例数据/编纂状态.md`](doc/示例数据/编纂状态.md)
- [`AGENTS.md`](AGENTS.md)

## 限制与后续方向

当前应用尚未实现账号、云同步、分享链接、权限控制或多人实时协作。相关能力必须在明确冲突解决、访问控制、备份和隐私边界后另行设计；不能把它们当作当前本地项目格式的既有保证。
