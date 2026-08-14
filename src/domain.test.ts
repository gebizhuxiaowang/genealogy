import { describe, expect, it } from 'vitest'
import { addMediaMetadata, addParentChild, addPerson, attachMediaToPerson, createEmptyProject, parseProject } from './domain'
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
