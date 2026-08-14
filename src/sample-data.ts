import { type GenealogyProject } from './domain'
import { referenceSampleProjects } from './reference-data'

export type SampleProject = { key: string; label: string; project: GenealogyProject }
export const sampleProjects: SampleProject[] = referenceSampleProjects
export const defaultProject = sampleProjects[0].project
