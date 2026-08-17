import ELK from 'elkjs/lib/elk.bundled.js'
import type { Edge, Node } from '@xyflow/react'
import type { GenealogyProject, GraphMode, RelationshipType, ViewPreset } from './domain'

const elk = new ELK()
export type LayoutNodeData = { kind: 'person'; personId: string }
export type LayoutResult = { nodes: Node<LayoutNodeData>[]; edges: Edge[] }

type GraphEdgeData = { relatedPersonIds: string[]; inferred?: boolean; unionId?: string; explicitRelationId?: string }

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

function inferredCoParentEdges(project: GenealogyProject, view: ViewPreset): Edge<GraphEdgeData>[] {
  if (view.mode !== 'family') return []
  return project.parentChildRelations.flatMap((relation) => {
    if (relation.type !== 'biological') return []
    return project.unions.filter((union) => union.partnerIds.includes(relation.parentId)).flatMap((union) => {
      const coParentId = union.partnerIds.find((id) => id !== relation.parentId)
      if (!coParentId || project.parentChildRelations.some((item) => item.parentId === coParentId && item.childId === relation.childId)) return []
      return [{
        id: `inferred-coparent-${union.id}-${relation.id}-${coParentId}`,
        source: coParentId,
        target: relation.childId,
        type: 'smoothstep',
        label: '婚配共亲（推定）',
        className: 'relationship-edge edge--inferred-coparent',
        style: { stroke: '#71838a', strokeWidth: 2, strokeDasharray: '3 3' },
        labelBgStyle: { fill: '#f5f7f8', stroke: '#9aaab0', strokeWidth: 1 },
        labelStyle: { fill: '#52676f', fontWeight: 700, fontSize: 10 },
        data: { inferred: true, unionId: union.id, explicitRelationId: relation.id, relatedPersonIds: [relation.parentId, coParentId, relation.childId] },
      }]
    })
  })
}

export async function layoutProject(project: GenealogyProject, view: ViewPreset): Promise<LayoutResult> {
  const unionAnchors = view.mode === 'family' ? project.unions.map((union) => ({ id: `layout-union-${union.id}`, width: 1, height: 1, layoutOptions: { 'elk.layered.priority': '2' } })) : []
  const rootChildren = [...project.persons.map((person) => ({ id: person.id, width: 180, height: 92 })), ...unionAnchors]
  const layoutEdges = view.mode === 'family'
    ? [...project.unions.flatMap((union) => union.partnerIds.map((partnerId) => ({ id: `layout-partner-${union.id}-${partnerId}`, sources: [partnerId], targets: [`layout-union-${union.id}`] }))), ...project.parentChildRelations.map((relation) => { const union = project.unions.find((item) => item.partnerIds.includes(relation.parentId)); return { id: `layout-${relation.id}`, sources: [union ? `layout-union-${union.id}` : relation.parentId], targets: [relation.childId] } })]
    : project.parentChildRelations.map((relation) => ({ id: relation.id, sources: [relation.parentId], targets: [relation.childId] }))
  const laidOut = await elk.layout({ id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': directionMap[view.direction], 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', 'elk.spacing.nodeNode': '56', 'elk.layered.spacing.nodeNodeBetweenLayers': '104' }, children: rootChildren, edges: layoutEdges })
  const positions = new Map((laidOut.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
  const nodes = project.persons.map((person) => ({ id: person.id, position: view.mode === 'blood' ? view.positions[person.id] ?? positions.get(person.id) ?? { x: 0, y: 0 } : positions.get(person.id) ?? { x: 0, y: 0 }, style: { width: 180, height: 92 }, data: { kind: 'person' as const, personId: person.id }, className: 'person-node' }))
  const parentChildEdges: Edge<GraphEdgeData>[] = project.parentChildRelations.map((relation) => ({ id: relation.id, source: relation.parentId, target: relation.childId, type: 'smoothstep', label: relationshipLabel(relation.type), animated: relation.type !== 'biological', className: `relationship-edge edge--${relation.type}`, style: { stroke: relationshipColor(relation.type), strokeWidth: 3 }, data: { relatedPersonIds: [relation.parentId, relation.childId] }, ...edgeLabelOptions }))
  const spouseEdges: Edge<GraphEdgeData>[] = view.mode === 'family' ? project.unions.map((union) => ({ id: `union-${union.id}`, source: union.partnerIds[0], target: union.partnerIds[1], type: 'straight', label: unionLabel(union.type), className: 'relationship-edge edge--spouse', style: { stroke: '#a85c18', strokeWidth: 3, strokeDasharray: '7 4' }, data: { relatedPersonIds: [...union.partnerIds] }, ...edgeLabelOptions })) : []
  return { nodes, edges: [...spouseEdges, ...parentChildEdges, ...inferredCoParentEdges(project, view)] }
}

export const modeLabel = (mode: GraphMode) => mode === 'family' ? '家谱树桩图' : '血缘详情图'
