import tangRaw from '../doc/参考数据/tang.json'
import songRaw from '../doc/参考数据/song.json'
import yuanRaw from '../doc/参考数据/yuan.json'
import mingRaw from '../doc/参考数据/ming.json'
import qingRaw from '../doc/参考数据/qing.json'
import { defaultView, type EntryCategory, type GenealogyProject, type Person, type Source } from './domain'

type ReferenceChild = { name: string; gender?: string; mother?: string; order_among_siblings?: string; title_or_fate?: string; relationship_type?: string; source?: string; disputed?: boolean; note?: string }
type ReferenceSpouse = { name: string; title?: string; type?: string; children?: string[]; source?: string; disputed?: boolean; note?: string }
type ReferenceEmperor = { order: number | string; name: string; temple_name?: string | null; posthumous_name?: string | null; era_names?: string[]; reign?: string; relation_to_previous?: string; achievements?: string[]; sources?: string[]; spouses?: ReferenceSpouse[]; children?: ReferenceChild[]; notes?: string }
type ReferenceDataset = { dynasty: string; period: string; emperors: ReferenceEmperor[] }

type MutableProject = GenealogyProject & { persons: Person[]; sources: Source[] }
const code = (value: string) => Array.from(value).map((character) => character.codePointAt(0)?.toString(16)).join('-')
const stableId = (prefix: string, ...parts: string[]) => `${prefix}-${parts.map(code).join('_')}`
const normalizeName = (name: string) => name.replace(/[（(].*?[）)]/g, '').replace(/（.*$/, '').trim()
const unique = <T,>(items: T[]) => [...new Set(items)]

function relationshipType(value?: string): 'biological' | 'adoptive' | undefined {
  if (!value || value.includes('传说')) return undefined
  return value.includes('继嗣') || value.includes('养子') || value.includes('入继') ? 'adoptive' : 'biological'
}

function categoryForAchievement(): EntryCategory { return 'achievement' }

export function normalizeReferenceDataset(raw: ReferenceDataset): GenealogyProject {
  const dynasty = raw.dynasty.replace(/[朝代]/g, '')
  const project: MutableProject = {
    format: 'genealogy-sample/v2', schemaVersion: 2,
    project: { id: `reference-${dynasty}`, name: `${dynasty}代皇室近亲（参考数据）`, dynasty, coverage: `${raw.period}；由 doc/参考数据 规范化，保留明确记录和争议标记` },
    sources: [], media: [], views: [defaultView()], persons: [], unions: [], parentChildRelations: [],
  }
  const sourceByTitle = new Map<string, string>()
  const personByKey = new Map<string, Person>()
  const emperorByName = new Map<string, string>()
  const addSource = (title?: string): string[] => {
    if (!title || title.includes('不详') || title.includes('缺载')) return []
    const id = sourceByTitle.get(title) ?? stableId('source', dynasty, `${sourceByTitle.size + 1}`, title)
    if (!sourceByTitle.has(title)) { sourceByTitle.set(title, id); project.sources.push({ id, title, type: title.startsWith('《') ? 'historical-text' : 'reference-note' }) }
    return [id]
  }
  const ensurePerson = (key: string, name: string, sourceIds: string[], options: Partial<Person> = {}): Person => {
    const existing = personByKey.get(key)
    if (existing) { existing.sourceIds = unique([...existing.sourceIds, ...sourceIds]); existing.roles = unique([...existing.roles, ...(options.roles ?? [])]); if (!existing.note && options.note) existing.note = options.note; return existing }
    const person: Person = { id: stableId('person', dynasty, key), name, roles: options.roles ?? [], entries: options.entries ?? [], mediaIds: [], sourceIds, certainty: options.certainty ?? 'confirmed', courtesyOrTempleName: options.courtesyOrTempleName, note: options.note }
    project.persons.push(person); personByKey.set(key, person); return person
  }
  const childKey = (name: string) => `child:${normalizeName(name)}`

  for (const emperor of raw.emperors) {
    const name = normalizeName(emperor.name); const sourceIds = unique((emperor.sources ?? []).flatMap(addSource))
    const knownChild = personByKey.get(childKey(name))
    const emperorPerson = knownChild ?? ensurePerson(`emperor:${name}`, name, sourceIds, { roles: ['emperor'], courtesyOrTempleName: emperor.temple_name && emperor.temple_name !== '无' ? emperor.temple_name : undefined, note: emperor.notes })
    if (knownChild) { emperorPerson.roles = unique([...emperorPerson.roles, 'emperor']); emperorPerson.sourceIds = unique([...emperorPerson.sourceIds, ...sourceIds]); emperorPerson.courtesyOrTempleName ??= emperor.temple_name && emperor.temple_name !== '无' ? emperor.temple_name : undefined; emperorPerson.note ??= emperor.notes }
    personByKey.set(`emperor:${name}`, emperorPerson)
    emperorByName.set(name, emperorPerson.id)
    const biography = [emperor.reign ? `在位：${emperor.reign}` : '', emperor.relation_to_previous ? `承继：${emperor.relation_to_previous}` : ''].filter(Boolean).join('；')
    if (biography) emperorPerson.entries.push({ id: stableId('entry', emperorPerson.id, 'reign'), category: 'biography', title: '帝位与承继', content: biography, sourceIds, mediaIds: [], certainty: 'confirmed', order: emperorPerson.entries.length })
    for (const achievement of emperor.achievements ?? []) emperorPerson.entries.push({ id: stableId('entry', emperorPerson.id, `achievement-${emperorPerson.entries.length}`), category: categoryForAchievement(), title: '主要事迹', content: achievement, sourceIds, mediaIds: [], certainty: 'confirmed', order: emperorPerson.entries.length })

    for (const spouseRecord of emperor.spouses ?? []) {
      const spouseName = normalizeName(spouseRecord.name); const spouseSourceIds = unique([...sourceIds, ...addSource(spouseRecord.source)])
      const spouseId = emperorByName.get(spouseName)
      const spousePerson = spouseId ? project.persons.find((person) => person.id === spouseId)! : ensurePerson(`spouse:${name}:${spouseName}`, spouseName, spouseSourceIds, { roles: [spouseRecord.type ?? 'consort'], courtesyOrTempleName: spouseRecord.title, certainty: spouseRecord.disputed ? 'disputed' : 'confirmed', note: spouseRecord.note })
      const unionId = stableId('union', dynasty, emperorPerson.id, spousePerson.id)
      if (!project.unions.some((union) => union.id === unionId || (union.partnerIds.includes(emperorPerson.id) && union.partnerIds.includes(spousePerson.id)))) project.unions.push({ id: unionId, partnerIds: [emperorPerson.id, spousePerson.id], type: spouseRecord.type ?? 'marriage', sourceIds: spouseSourceIds, certainty: spouseRecord.disputed ? 'disputed' : 'confirmed', note: spouseRecord.note })
      for (const listedChild of spouseRecord.children ?? []) {
        const childName = normalizeName(listedChild); const child = ensurePerson(childKey(childName), childName, spouseSourceIds, { roles: ['imperial-clan'] })
        const relationId = stableId('parent-child', dynasty, spousePerson.id, child.id)
        if (!project.parentChildRelations.some((relation) => relation.id === relationId)) project.parentChildRelations.push({ id: relationId, parentId: spousePerson.id, childId: child.id, type: 'biological', sourceIds: spouseSourceIds, certainty: spouseRecord.disputed ? 'disputed' : 'confirmed', note: spouseRecord.note })
      }
    }

    for (const childRecord of emperor.children ?? []) {
      const childName = normalizeName(childRecord.name); const childSourceIds = unique([...sourceIds, ...addSource(childRecord.source)])
      const child = ensurePerson(childKey(childName), childName, childSourceIds, { roles: ['imperial-clan'], certainty: childRecord.disputed ? 'disputed' : 'confirmed', note: childRecord.note })
      if (emperorByName.has(childName) && child.id !== emperorByName.get(childName)) {
        const imperial = project.persons.find((person) => person.id === emperorByName.get(childName))!
        personByKey.set(childKey(childName), imperial)
      }
      const resolvedChild = personByKey.get(childKey(childName))!
      if (childRecord.title_or_fate) resolvedChild.entries.push({ id: stableId('entry', resolvedChild.id, `record-${resolvedChild.entries.length}`), category: 'biography', title: childRecord.order_among_siblings ?? '宗室记录', content: childRecord.title_or_fate, sourceIds: childSourceIds, mediaIds: [], certainty: childRecord.disputed ? 'disputed' : 'confirmed', note: childRecord.note, order: resolvedChild.entries.length })
      const type = relationshipType(childRecord.relationship_type)
      if (type) {
        const relationId = stableId('parent-child', dynasty, emperorPerson.id, resolvedChild.id)
        if (!project.parentChildRelations.some((relation) => relation.id === relationId)) project.parentChildRelations.push({ id: relationId, parentId: emperorPerson.id, childId: resolvedChild.id, type, sourceIds: childSourceIds, certainty: childRecord.disputed ? 'disputed' : 'confirmed', note: childRecord.note })
      }
    }
  }
  for (const person of project.persons) person.entries = person.entries.map((entry, index) => ({ ...entry, order: index }))
  return project
}

const datasets: Array<[string, ReferenceDataset]> = [['tang', tangRaw as ReferenceDataset], ['song', songRaw as ReferenceDataset], ['yuan', yuanRaw as ReferenceDataset], ['ming', mingRaw as ReferenceDataset], ['qing', qingRaw as ReferenceDataset]]
export const referenceSampleProjects = datasets.map(([key, raw]) => ({ key, label: `${raw.dynasty}皇室近亲（参考库）`, project: normalizeReferenceDataset(raw) }))
