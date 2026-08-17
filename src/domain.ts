import { z } from 'zod'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const certaintySchema = z.enum(['confirmed', 'probable', 'disputed'])
const relationTypeSchema = z.enum(['biological', 'adoptive', 'step', 'guardian'])
const entryCategorySchema = z.enum(['biography', 'achievement', 'office', 'migration', 'education', 'other'])
const directionSchema = z.enum(['TB', 'LR', 'BT', 'RL'])
const graphModeSchema = z.enum(['family', 'blood'])

const sourceSchema = z.object({ id: z.string().min(1), title: z.string().min(1), type: z.string().min(1), note: z.string().optional() })
const entrySchema = z.object({
  id: z.string().min(1), category: entryCategorySchema, title: z.string().min(1), startDate: z.string().optional(), endDate: z.string().optional(), place: z.string().optional(), content: z.string().default(''), sourceIds: z.array(z.string()).default([]), mediaIds: z.array(z.string()).default([]), certainty: certaintySchema.default('confirmed'), note: z.string().optional(), order: z.number().default(0),
})
const mediaSchema = z.object({ id: z.string().min(1), filename: z.string().min(1), mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().positive().max(MAX_IMAGE_BYTES), caption: z.string().optional(), date: z.string().optional(), sourceIds: z.array(z.string()).default([]), personIds: z.array(z.string()).default([]), createdAt: z.string() })
const positionSchema = z.object({ x: z.number(), y: z.number() })
const viewSchema = z.object({ id: z.string().min(1), name: z.string().min(1), mode: graphModeSchema.default('family'), direction: directionSchema.default('TB'), showDates: z.boolean().default(true), showPortraits: z.boolean().default(true), showAcademicNotes: z.boolean().default(false), positions: z.record(positionSchema).default({}) })
const personSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), courtesyOrTempleName: z.string().optional(), gender: z.enum(['female', 'male', 'unspecified']).optional(), birth: z.string().optional(), death: z.string().optional(), place: z.string().optional(), roles: z.array(z.string()).default([]), entries: z.array(entrySchema).default([]), mediaIds: z.array(z.string()).default([]), portraitMediaId: z.string().optional(), sourceIds: z.array(z.string()).default([]), certainty: certaintySchema.default('confirmed'), note: z.string().optional(),
})
const unionSchema = z.object({ id: z.string().min(1), partnerIds: z.tuple([z.string().min(1), z.string().min(1)]), type: z.string().default('marriage'), sourceIds: z.array(z.string()).default([]), certainty: certaintySchema.default('confirmed'), note: z.string().optional() })
const parentChildSchema = z.object({ id: z.string().min(1), parentId: z.string().min(1), childId: z.string().min(1), type: relationTypeSchema.default('biological'), sourceIds: z.array(z.string()).default([]), certainty: certaintySchema.default('confirmed'), note: z.string().optional() })

export const genealogyV2Schema = z.object({
  format: z.literal('genealogy-sample/v2'), schemaVersion: z.literal(2), project: z.object({ id: z.string().min(1), name: z.string().min(1), dynasty: z.string().optional(), coverage: z.string().optional(), updatedAt: z.string().optional() }), sources: z.array(sourceSchema).default([]), media: z.array(mediaSchema).default([]), views: z.array(viewSchema).min(1), persons: z.array(personSchema).min(1), unions: z.array(unionSchema).default([]), parentChildRelations: z.array(parentChildSchema).default([]),
})

export type Source = z.infer<typeof sourceSchema>
export type ProfileEntry = z.infer<typeof entrySchema>
export type MediaMetadata = z.infer<typeof mediaSchema>
export type ViewPreset = z.infer<typeof viewSchema>
export type Person = z.infer<typeof personSchema>
export type Union = z.infer<typeof unionSchema>
export type ParentChildRelation = z.infer<typeof parentChildSchema>
export type GenealogyProject = z.infer<typeof genealogyV2Schema>
export type RelationshipType = z.infer<typeof relationTypeSchema>
export type LayoutDirection = z.infer<typeof directionSchema>
export type GraphMode = z.infer<typeof graphModeSchema>
export type EntryCategory = z.infer<typeof entryCategorySchema>

const legacySchema = z.object({ format: z.literal('genealogy-sample/v1'), schemaVersion: z.literal(1), project: z.object({ id: z.string(), name: z.string(), dynasty: z.string().optional(), coverage: z.string().optional(), updatedAt: z.string().optional() }), sources: z.array(sourceSchema).default([]), persons: z.array(z.object({ id: z.string(), name: z.string(), courtesyOrTempleName: z.string().optional(), gender: z.enum(['female', 'male', 'unspecified']).optional(), birth: z.string().optional(), death: z.string().optional(), place: z.string().optional(), biography: z.string().optional(), achievements: z.string().optional(), roles: z.array(z.string()).default([]), sourceIds: z.array(z.string()).default([]), certainty: certaintySchema.default('confirmed'), note: z.string().optional() })), unions: z.array(unionSchema.omit({ certainty: true })).default([]), parentChildRelations: z.array(parentChildSchema.omit({ certainty: true })).default([]) })

export const createId = (prefix: string) => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
export const defaultView = (): ViewPreset => ({ id: 'view-family', name: '家谱树桩图', mode: 'family', direction: 'TB', showDates: true, showPortraits: true, showAcademicNotes: false, positions: {} })

export function migrateV1(input: unknown): GenealogyProject {
  const legacy = legacySchema.parse(input)
  const persons = legacy.persons.map((person) => {
    const entries: ProfileEntry[] = []
    if (person.biography) entries.push({ id: createId('entry'), category: 'biography', title: '生平', content: person.biography, sourceIds: person.sourceIds, mediaIds: [], certainty: person.certainty, order: 0 })
    if (person.achievements) entries.push({ id: createId('entry'), category: 'achievement', title: '成就', content: person.achievements, sourceIds: person.sourceIds, mediaIds: [], certainty: person.certainty, order: entries.length })
    return { ...person, entries, mediaIds: [] }
  })
  return { format: 'genealogy-sample/v2', schemaVersion: 2, project: legacy.project, sources: legacy.sources, media: [], views: [defaultView()], persons, unions: legacy.unions.map((item) => ({ ...item, certainty: 'confirmed' as const })), parentChildRelations: legacy.parentChildRelations.map((item) => ({ ...item, certainty: 'confirmed' as const })) }
}

export function parseProject(input: unknown): GenealogyProject {
  const raw = input as { schemaVersion?: number }
  const project = raw?.schemaVersion === 1 ? migrateV1(input) : genealogyV2Schema.parse(input)
  validateProject(project)
  return project
}

export function validateProject(project: GenealogyProject): void {
  const personIds = new Set(project.persons.map((person) => person.id))
  if (personIds.size !== project.persons.length) throw new Error('人物 ID 不能重复。')
  const sourceIds = new Set(project.sources.map((source) => source.id))
  const mediaIds = new Set(project.media.map((media) => media.id))
  const assertSources = (ids: string[]) => { if (!ids.every((id) => sourceIds.has(id))) throw new Error('存在未定义的史料来源引用。') }
  for (const media of project.media) { assertSources(media.sourceIds); if (!media.personIds.every((id) => personIds.has(id))) throw new Error('媒体引用了不存在的人物。') }
  for (const person of project.persons) { assertSources(person.sourceIds); if (!person.mediaIds.every((id) => mediaIds.has(id)) || (person.portraitMediaId && !mediaIds.has(person.portraitMediaId))) throw new Error('人物引用了不存在的媒体。'); for (const entry of person.entries) { assertSources(entry.sourceIds); if (!entry.mediaIds.every((id) => mediaIds.has(id))) throw new Error('条目引用了不存在的媒体。') } }
  for (const union of project.unions) { if (union.partnerIds[0] === union.partnerIds[1] || !union.partnerIds.every((id) => personIds.has(id))) throw new Error('配偶关系无效。'); assertSources(union.sourceIds) }
  const unique = new Set<string>(); const parentsByChild = new Map<string, string[]>()
  for (const relation of project.parentChildRelations) { if (relation.parentId === relation.childId || !personIds.has(relation.parentId) || !personIds.has(relation.childId)) throw new Error('亲子关系无效。'); const key = `${relation.parentId}:${relation.childId}:${relation.type}`; if (unique.has(key)) throw new Error('亲子关系不能重复。'); unique.add(key); assertSources(relation.sourceIds); parentsByChild.set(relation.childId, [...(parentsByChild.get(relation.childId) ?? []), relation.parentId]) }
  const walk = (id: string, seen: Set<string>): void => { if (seen.has(id)) throw new Error('亲子关系中不能出现循环。'); for (const parent of parentsByChild.get(id) ?? []) walk(parent, new Set(seen).add(id)) }
  project.persons.forEach((person) => walk(person.id, new Set()))
}

export const cloneProject = (project: GenealogyProject): GenealogyProject => structuredClone(project)
export const touch = (project: GenealogyProject): GenealogyProject => { project.project.updatedAt = new Date().toISOString(); return project }
export function createEmptyProject(name = '未命名家谱'): GenealogyProject { const founderId = createId('person'); return { format: 'genealogy-sample/v2', schemaVersion: 2, project: { id: createId('project'), name, updatedAt: new Date().toISOString() }, sources: [], media: [], views: [defaultView()], persons: [{ id: founderId, name: '始祖', roles: [], entries: [], mediaIds: [], sourceIds: [], certainty: 'confirmed' }], unions: [], parentChildRelations: [] } }
export type ExistingRelationKind = 'parent' | 'spouse' | 'child'

export function addPerson(project: GenealogyProject, name = '新人物'): { project: GenealogyProject; person: Person } { const next = cloneProject(project); const person: Person = { id: createId('person'), name, roles: [], entries: [], mediaIds: [], sourceIds: [], certainty: 'confirmed' }; next.persons.push(person); return { project: touch(next), person } }
export function personAndDescendantIds(project: GenealogyProject, personId: string): Set<string> {
  if (!project.persons.some((person) => person.id === personId)) throw new Error('未找到要删除的人物。')
  const ids = new Set([personId])
  let changed = true
  while (changed) {
    changed = false
    for (const relation of project.parentChildRelations) {
      if (ids.has(relation.parentId) && !ids.has(relation.childId)) { ids.add(relation.childId); changed = true }
    }
  }
  return ids
}
function removePeople(project: GenealogyProject, personIds: Set<string>): GenealogyProject {
  const next = cloneProject(project)
  if (personIds.size >= next.persons.length) throw new Error('家谱至少需要保留一位人物。')
  next.persons = next.persons.filter((person) => !personIds.has(person.id))
  next.unions = next.unions.filter((union) => !union.partnerIds.some((id) => personIds.has(id)))
  next.parentChildRelations = next.parentChildRelations.filter((relation) => !personIds.has(relation.parentId) && !personIds.has(relation.childId))
  next.media = next.media.map((media) => ({ ...media, personIds: media.personIds.filter((id) => !personIds.has(id)) }))
  next.views = next.views.map((view) => { const positions = { ...view.positions }; personIds.forEach((id) => delete positions[id]); return { ...view, positions } })
  validateProject(next)
  return touch(next)
}
export function removePerson(project: GenealogyProject, personId: string): GenealogyProject { return removePeople(project, personAndDescendantIds({ ...project, parentChildRelations: [] }, personId)) }
export function removePersonAndDescendants(project: GenealogyProject, personId: string): GenealogyProject { return removePeople(project, personAndDescendantIds(project, personId)) }
export function updatePerson(project: GenealogyProject, personId: string, changes: Partial<Person>): GenealogyProject { const next = cloneProject(project); const person = next.persons.find((item) => item.id === personId); if (!person) throw new Error('未找到要编辑的人物。'); Object.assign(person, changes, { id: personId }); if (!person.name.trim()) throw new Error('姓名不能为空。'); return touch(next) }
export function addParentChild(project: GenealogyProject, parentId: string, childId: string, type: RelationshipType = 'biological'): GenealogyProject { const next = cloneProject(project); next.parentChildRelations.push({ id: createId('parent-child'), parentId, childId, type, sourceIds: [], certainty: 'confirmed' }); validateProject(next); return touch(next) }
export function addUnion(project: GenealogyProject, firstId: string, secondId: string): GenealogyProject { const next = cloneProject(project); if (next.unions.some((union) => union.partnerIds.includes(firstId) && union.partnerIds.includes(secondId))) throw new Error('配偶关系已存在。'); next.unions.push({ id: createId('union'), partnerIds: [firstId, secondId], type: 'marriage', sourceIds: [], certainty: 'confirmed' }); validateProject(next); return touch(next) }
export function linkExistingPerson(project: GenealogyProject, personId: string, existingPersonId: string, kind: ExistingRelationKind): GenealogyProject {
  if (personId === existingPersonId) throw new Error('不能将人物与其自身建立关系。')
  if (!project.persons.some((person) => person.id === personId) || !project.persons.some((person) => person.id === existingPersonId)) throw new Error('未找到要关联的人物。')
  return kind === 'parent' ? addParentChild(project, existingPersonId, personId) : kind === 'child' ? addParentChild(project, personId, existingPersonId) : addUnion(project, personId, existingPersonId)
}
export function addEntry(project: GenealogyProject, personId: string, category: EntryCategory = 'biography'): GenealogyProject { const next = cloneProject(project); const person = next.persons.find((item) => item.id === personId); if (!person) throw new Error('未找到人物。'); person.entries.push({ id: createId('entry'), category, title: '新条目', content: '', sourceIds: [], mediaIds: [], certainty: 'confirmed', order: person.entries.length }); return touch(next) }
export function updateEntry(project: GenealogyProject, personId: string, entryId: string, changes: Partial<ProfileEntry>): GenealogyProject { const next = cloneProject(project); const entry = next.persons.find((item) => item.id === personId)?.entries.find((item) => item.id === entryId); if (!entry) throw new Error('未找到条目。'); Object.assign(entry, changes, { id: entryId }); return touch(next) }
export function removeEntry(project: GenealogyProject, personId: string, entryId: string): GenealogyProject { const next = cloneProject(project); const person = next.persons.find((item) => item.id === personId); if (!person) throw new Error('未找到人物。'); person.entries = person.entries.filter((entry) => entry.id !== entryId).map((entry, index) => ({ ...entry, order: index })); return touch(next) }
export function addMediaMetadata(project: GenealogyProject, metadata: MediaMetadata): GenealogyProject { const next = cloneProject(project); next.media.push(metadata); return touch(next) }
export function attachMediaToPerson(project: GenealogyProject, personId: string, mediaId: string, portrait = false): GenealogyProject { const next = cloneProject(project); const person = next.persons.find((item) => item.id === personId); const media = next.media.find((item) => item.id === mediaId); if (!person || !media) throw new Error('未找到人物或媒体。'); person.mediaIds = [...new Set([...person.mediaIds, mediaId])]; if (portrait) person.portraitMediaId = mediaId; media.personIds = [...new Set([...media.personIds, personId])]; validateProject(next); return touch(next) }
export function updateView(project: GenealogyProject, viewId: string, changes: Partial<ViewPreset>): GenealogyProject { const next = cloneProject(project); const view = next.views.find((item) => item.id === viewId); if (!view) throw new Error('未找到图谱视图。'); Object.assign(view, changes, { id: viewId }); return touch(next) }
export function generateBiography(person: Person): string { const displayName = person.courtesyOrTempleName ? `${person.name}（${person.courtesyOrTempleName}）` : person.name; const lifespan = [person.birth, person.death].filter(Boolean).join('—'); const intro = lifespan ? `${displayName}生卒于${lifespan}。` : `${displayName}的生卒时间尚待补充。`; const entries = [...person.entries].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '') || a.order - b.order).map((entry) => `${entry.title}${entry.startDate ? `（${entry.startDate}${entry.endDate ? `—${entry.endDate}` : ''}）` : ''}：${entry.content}`).filter((entry) => entry.length > 0); return [intro, person.place ? `其活动地点记为${person.place}。` : '', ...entries, person.note ? `说明：${person.note}` : ''].filter(Boolean).join('\n\n') }
export const sortPeople = (project: GenealogyProject): Person[] => [...project.persons].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
