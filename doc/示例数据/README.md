# 唐宋元明清帝系示例数据

本目录提供用于家谱编辑器原型验证的静态 JSON 示例。每个文件是一份可独立导入的家谱文档草案，采用统一的 `genealogy-sample/v1` 交换模型。

## 文件

| 文件 | 内容 | 说明 |
| --- | --- | --- |
| `tang-imperial-line.sample.json` | 唐代代表性帝系 | 高祖至德宗、宪宗一支，含玄武门相关同胞和武周关联 |
| `song-imperial-line.sample.json` | 宋代代表性帝系 | 北宋开国至靖康、南宋高宗至理宗的关键继承关系 |
| `yuan-imperial-line.sample.json` | 元代代表性帝系 | 成吉思汗、忽必烈至顺帝的主要支系 |
| `ming-imperial-line.sample.json` | 明代代表性帝系 | 太祖至崇祯，含建文、嘉靖等旁支继位关系 |
| `qing-imperial-line.sample.json` | 清代代表性帝系 | 努尔哈赤至溥仪，含同治、光绪和宣统的继承背景 |

## 交换模型

```json
{
  "format": "genealogy-sample/v1",
  "schemaVersion": 1,
  "project": { "id": "...", "name": "..." },
  "sources": [{ "id": "...", "title": "...", "type": "historical-text" }],
  "persons": [{ "id": "...", "name": "...", "roles": [], "sourceIds": [], "certainty": "confirmed|probable|disputed" }],
  "unions": [{ "id": "...", "partnerIds": ["...", "..."], "type": "marriage", "sourceIds": [] }],
  "parentChildRelations": [{ "id": "...", "parentId": "...", "childId": "...", "type": "biological|adoptive", "sourceIds": [] }]
}
```

- `persons` 是人物事实；`unions` 是婚姻/伴侣关系；`parentChildRelations` 是逐条亲子关系。
- 同一子女可有两条生物亲子关系，也可有额外收养关系；不能依赖数组顺序推断父母或继承关系。
- `sourceIds` 引用本文件中的 `sources`。`certainty` 为 `disputed` 时，必须阅读 `note`。
- 日期均以 ISO 风格的历史年份字符串表示；负数年份代表公元前，未知字段不伪造。
- 这些数据用于功能演示，**不是完整皇室成员名录或最终学术数据库**。导入生产数据前必须按项目计划中的史料规则逐项复核。
