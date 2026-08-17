import { describe, expect, it } from 'vitest'
import { addMediaMetadata, addParentChild, addPerson, addUnion, attachMediaToPerson, createEmptyProject, linkExistingPerson, parseProject, removePerson, removePersonAndDescendants, updateView, validateProject } from './domain'
import { defaultProject, sampleProjects } from './sample-data'

const legacyProject = {
  format: 'genealogy-sample/v1', schemaVersion: 1,
  project: { id: 'legacy-project', name: '旧版家谱' },
  sources: [{ id: 'source-1', title: '旧谱', type: 'book' }],
  persons: [{ id: 'founder', name: '始祖', birth: '1900', biography: '旧版生平。', achievements: '旧版成就。', roles: [], sourceIds: ['source-1'], certainty: 'confirmed' }],
  unions: [], parentChildRelations: [],
}

describe('家谱领域模型', () => {
  it('可以创建并关联新人物', () => {
    const initial = createEmptyProject('测试家谱')
    const founder = initial.persons[0]
    const created = addPerson(initial, '子女')
    const next = addParentChild(created.project, founder.id, created.person.id)
    expect(next.persons).toHaveLength(2)
    expect(next.parentChildRelations).toMatchObject([{ parentId: founder.id, childId: created.person.id, type: 'biological' }])
  })

  it('拒绝循环亲子关系', () => {
    const initial = createEmptyProject('测试家谱')
    const founder = initial.persons[0]
    const created = addPerson(initial, '子女')
    const next = addParentChild(created.project, founder.id, created.person.id)
    expect(() => addParentChild(next, created.person.id, founder.id)).toThrow('循环')
  })

  it('删除当前人物时仅清理其关系，并保留下级节点', () => {
    const initial = createEmptyProject('测试家谱')
    const founder = initial.persons[0]
    const target = addPerson(initial, '待删除人物')
    const spouse = addPerson(target.project, '配偶')
    const child = addPerson(spouse.project, '子女')
    const unrelated = addPerson(child.project, '无关人物')
    let project = addUnion(unrelated.project, target.person.id, spouse.person.id)
    project = addParentChild(project, founder.id, target.person.id)
    project = addParentChild(project, target.person.id, child.person.id)
    project = addParentChild(project, unrelated.person.id, spouse.person.id)
    project = addMediaMetadata(project, { id: 'media-1', filename: 'portrait.webp', mimeType: 'image/webp', size: 100, sourceIds: [], personIds: [], createdAt: '2026-01-01T00:00:00.000Z' })
    project = attachMediaToPerson(project, target.person.id, 'media-1', true)
    project = updateView(project, project.views[0].id, { mode: 'blood', positions: { [target.person.id]: { x: 10, y: 20 }, [child.person.id]: { x: 30, y: 40 } } })
    const input = structuredClone(project)

    const next = removePerson(project, target.person.id)

    expect(project).toEqual(input)
    expect(next.persons.map((person) => person.id)).toEqual(expect.arrayContaining([founder.id, spouse.person.id, child.person.id, unrelated.person.id]))
    expect(next.unions).toHaveLength(0)
    expect(next.parentChildRelations).toEqual([expect.objectContaining({ parentId: unrelated.person.id, childId: spouse.person.id })])
    expect(next.media).toEqual([expect.objectContaining({ id: 'media-1', personIds: [] })])
    expect(next.views[0].positions).not.toHaveProperty(target.person.id)
    expect(next.views[0].positions).toHaveProperty(child.person.id, { x: 30, y: 40 })
    expect(() => validateProject(next)).not.toThrow()
  })

  it('删除当前人物及全部下级后代，但不沿婚配关系删除配偶', () => {
    const initial = createEmptyProject('测试家谱')
    const root = addPerson(initial, '根节点')
    const spouse = addPerson(root.project, '配偶')
    const child = addPerson(spouse.project, '子女')
    const grandchild = addPerson(child.project, '孙辈')
    let project = addParentChild(grandchild.project, initial.persons[0].id, root.person.id)
    project = addUnion(project, root.person.id, spouse.person.id)
    project = addParentChild(project, root.person.id, child.person.id)
    project = addParentChild(project, child.person.id, grandchild.person.id)
    project = updateView(project, project.views[0].id, { mode: 'blood', positions: { [root.person.id]: { x: 1, y: 1 }, [child.person.id]: { x: 2, y: 2 }, [grandchild.person.id]: { x: 3, y: 3 }, [spouse.person.id]: { x: 4, y: 4 } } })
    const input = structuredClone(project)

    const next = removePersonAndDescendants(project, root.person.id)

    expect(project).toEqual(input)
    expect(next.persons.map((person) => person.id)).toEqual(expect.arrayContaining([initial.persons[0].id, spouse.person.id]))
    expect(next.persons.map((person) => person.id)).not.toEqual(expect.arrayContaining([root.person.id, child.person.id, grandchild.person.id]))
    expect(next.unions).toHaveLength(0)
    expect(next.parentChildRelations).toHaveLength(0)
    expect(next.views[0].positions).toEqual({ [spouse.person.id]: { x: 4, y: 4 } })
    expect(() => validateProject(next)).not.toThrow()
  })

  it('关联已有成员时保持关系方向并拒绝无效关联', () => {
    const initial = createEmptyProject('测试家谱')
    const selected = addPerson(initial, '当前人物')
    const parent = addPerson(selected.project, '已有父母')
    const spouse = addPerson(parent.project, '已有配偶')
    const child = addPerson(spouse.project, '已有子女')
    let project = linkExistingPerson(child.project, selected.person.id, parent.person.id, 'parent')
    project = linkExistingPerson(project, selected.person.id, spouse.person.id, 'spouse')
    project = linkExistingPerson(project, selected.person.id, child.person.id, 'child')

    expect(project.parentChildRelations).toEqual(expect.arrayContaining([expect.objectContaining({ parentId: parent.person.id, childId: selected.person.id }), expect.objectContaining({ parentId: selected.person.id, childId: child.person.id })]))
    expect(project.unions).toEqual([expect.objectContaining({ partnerIds: expect.arrayContaining([selected.person.id, spouse.person.id]) })])
    expect(() => linkExistingPerson(project, selected.person.id, selected.person.id, 'spouse')).toThrow('自身')
    expect(() => linkExistingPerson(project, selected.person.id, child.person.id, 'parent')).toThrow('循环')
    expect(() => linkExistingPerson(project, spouse.person.id, selected.person.id, 'spouse')).toThrow('已存在')
  })

  it('拒绝删除不存在或最后一位人物', () => {
    const initial = createEmptyProject('测试家谱')
    expect(() => removePerson(initial, 'missing')).toThrow('未找到')
    expect(() => removePerson(initial, initial.persons[0].id)).toThrow('至少')
    expect(() => removePersonAndDescendants(initial, initial.persons[0].id)).toThrow('至少')
  })

  it('无损迁移 v1 文本资料至 v2 时间线', () => {
    const migrated = parseProject(legacyProject)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.format).toBe('genealogy-sample/v2')
    expect(migrated.persons[0].entries).toMatchObject([{ category: 'biography', content: '旧版生平。' }, { category: 'achievement', content: '旧版成就。' }])
    expect(migrated.views[0].mode).toBe('family')
  })

  it('可以将媒体元数据关联至人物头像', () => {
    const initial = createEmptyProject('测试家谱')
    const person = initial.persons[0]
    const withMedia = addMediaMetadata(initial, { id: 'media-1', filename: 'portrait.webp', mimeType: 'image/webp', size: 100, sourceIds: [], personIds: [], createdAt: '2026-01-01T00:00:00.000Z' })
    const next = attachMediaToPerson(withMedia, person.id, 'media-1', true)
    expect(next.persons[0].portraitMediaId).toBe('media-1')
    expect(next.media[0].personIds).toContain(person.id)
  })

  it('迁移并验证全部五朝历史示例', () => {
    expect(sampleProjects.map((sample) => sample.project.project.dynasty)).toEqual(['唐', '宋', '元', '明', '清'])
    for (const sample of sampleProjects) {
      expect(() => parseProject(sample.project)).not.toThrow()
      expect(sample.project.persons.length).toBeGreaterThan(5)
      expect(sample.project.unions.length).toBeGreaterThan(0)
      expect(sample.project.parentChildRelations.length).toBeGreaterThan(0)
    }
    expect(defaultProject.project.dynasty).toBe('唐')
  })
})
