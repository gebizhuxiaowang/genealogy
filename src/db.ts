import Dexie, { type Table } from 'dexie'
import { parseProject, type GenealogyProject, type MediaMetadata } from './domain'

interface StoredProject { id: string; project: GenealogyProject; updatedAt: string }
export interface StoredAsset { id: string; projectId: string; blob: Blob; thumbnail: Blob; metadata: MediaMetadata }

class GenealogyDatabase extends Dexie {
  projects!: Table<StoredProject, string>
  assets!: Table<StoredAsset, string>
  constructor() { super('genealogy-editor'); this.version(1).stores({ projects: '&id, updatedAt' }); this.version(2).stores({ projects: '&id, updatedAt', assets: '&id, projectId' }) }
}
const database = new GenealogyDatabase()
const activeProjectId = 'active-project'
export async function loadActiveProject(): Promise<GenealogyProject | undefined> { const stored = await database.projects.get(activeProjectId); return stored ? parseProject(stored.project) : undefined }
export async function saveActiveProject(project: GenealogyProject): Promise<void> { await database.projects.put({ id: activeProjectId, project, updatedAt: new Date().toISOString() }) }
export async function saveAsset(asset: StoredAsset): Promise<void> { await database.assets.put(asset) }
export async function getAsset(assetId: string): Promise<StoredAsset | undefined> { return database.assets.get(assetId) }
export async function getProjectAssets(projectId: string): Promise<StoredAsset[]> { return database.assets.where('projectId').equals(projectId).toArray() }
export async function deleteProjectAssets(projectId: string, keepIds: string[]): Promise<void> { const assets = await getProjectAssets(projectId); await database.assets.bulkDelete(assets.filter((asset) => !keepIds.includes(asset.id)).map((asset) => asset.id)) }
export async function clearActiveProject(): Promise<void> { await database.projects.delete(activeProjectId) }
