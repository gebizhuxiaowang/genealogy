import ELK from 'elkjs/lib/elk.bundled.js'
import type { Edge, Node } from '@xyflow/react'
import type { GenealogyProject, GraphMode, RelationshipType, ViewPreset } from './domain'

const elk = new ELK()
export type LayoutNodeData = { kind: 'person' | 'family'; personId?: string; label?: string; title?: string }
export type LayoutResult = { nodes: Node<LayoutNodeData>[]; edges: Edge[] }

const directionMap = { TB: 'DOWN', LR: 'RIGHT', BT: 'UP', RL: 'LEFT' } as const
const relationLabels = { biological: '亲生', adoptive: '收养', step: '继亲', guardian: '监护' } satisfies Record<RelationshipType, string>
const edgeLabelOptions = {
  labelBgPadding: [4, 3] as [number, number],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#fffaf3', stroke: '#9a5e23', strokeWidth: 1 },
  labelStyle: { fill: '#5c3511', fontWeight: 700, fontSize: 11 },
}

const unionLabel = (type: string) => type === 'marriage' ? '婚配' : type
const relationshipLabel = (type: RelationshipType) => relationLabels[type]
const relationshipColor = (type: RelationshipType) => type === 'biological' ? '#176b5c' : type === 'adoptive' ? '#4f6fa9' : type === 'step' ? '#9d5b78' : '#78653a'

export async function layoutProject(project: GenealogyProject, view: ViewPreset): Promise<LayoutResult> {
  const familyNodes = view.mode === 'family' ? project.unions.map((union) => ({ id: `family-${union.id}`, width: 44, height: 44, layoutOptions: { 'elk.layered.priority': '2' } })) : []
  const rootChildren = [...project.persons.map((person) => ({ id: person.id, width: 180, height: 92 })), ...familyNodes]
  const edges = view.mode === 'family'
    ? [...project.unions.flatMap((union) => union.partnerIds.map((partnerId) => ({ id: `partner-${union.id}-${partnerId}`, sources: [partnerId], targets: [`family-${union.id}`] }))), ...project.parentChildRelations.map((relation) => { const union = project.unions.find((item) => item.partnerIds.includes(relation.parentId)); return { id: relation.id, sources: [union ? `family-${union.id}` : relation.parentId], targets: [relation.childId] } })]
    : project.parentChildRelations.map((relation) => ({ id: relation.id, sources: [relation.parentId], targets: [relation.childId] }))
  const laidOut = await elk.layout({ id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': directionMap[view.direction], 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', 'elk.spacing.nodeNode': '56', 'elk.layered.spacing.nodeNodeBetweenLayers': '104' }, children: rootChildren, edges })
  const positions = new Map((laidOut.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
  const nodes = [...project.persons.map((person) => ({ id: person.id, position: view.positions[person.id] ?? positions.get(person.id) ?? { x: 0, y: 0 }, style: { width: 180, height: 92 }, data: { kind: 'person' as const, personId: person.id }, className: 'person-node' })), ...(view.mode === 'family' ? project.unions.map((union) => ({ id: `family-${union.id}`, position: positions.get(`family-${union.id}`) ?? { x: 0, y: 0 }, style: { width: 44, height: 44 }, data: { kind: 'family' as const, label: unionLabel(union.type), title: `家庭单元：${unionLabel(union.type)}。它连接双方配偶与其子女。` }, className: 'family-node' })) : [])]
  const parentChildEdges = project.parentChildRelations.map((relation) => {
    const union = view.mode === 'family' ? project.unions.find((item) => item.partnerIds.includes(relation.parentId)) : undefined
    return { id: relation.id, source: union ? `family-${union.id}` : relation.parentId, target: relation.childId, type: 'smoothstep', label: relationshipLabel(relation.type), animated: relation.type !== 'biological', className: `relationship-edge edge--${relation.type}`, style: { stroke: relationshipColor(relation.type), strokeWidth: 3 }, ...edgeLabelOptions }
  })
  const flowEdges: Edge[] = view.mode === 'family'
    ? [...project.unions.flatMap((union) => union.partnerIds.map((partnerId) => ({ id: `partner-${union.id}-${partnerId}`, source: partnerId, target: `family-${union.id}`, type: 'straight', label: unionLabel(union.type), className: 'relationship-edge edge--spouse', style: { stroke: '#a85c18', strokeWidth: 3, strokeDasharray: '7 4' }, ...edgeLabelOptions }))), ...parentChildEdges]
    : parentChildEdges
  return { nodes, edges: flowEdges }
}

export const modeLabel = (mode: GraphMode) => mode === 'family' ? '家谱树桩图' : '血缘详情图'
