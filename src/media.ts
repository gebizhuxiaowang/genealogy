import { MAX_IMAGE_BYTES, createId, type MediaMetadata } from './domain'
import type { StoredAsset } from './db'

const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
export function validateImage(file: File): void { if (!supportedTypes.has(file.type)) throw new Error('仅支持 JPG、PNG 或 WebP 图片。'); if (file.size > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过 10 MB。') }
async function thumbnailFrom(file: File): Promise<Blob> { const bitmap = await createImageBitmap(file); const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale)); const context = canvas.getContext('2d'); if (!context) throw new Error('无法生成图片缩略图。'); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法压缩图片。')), 'image/webp', 0.82)) }
export async function createAsset(projectId: string, file: File): Promise<StoredAsset> { validateImage(file); const id = createId('media'); const metadata: MediaMetadata = { id, filename: file.name, mimeType: file.type as MediaMetadata['mimeType'], size: file.size, sourceIds: [], personIds: [], createdAt: new Date().toISOString() }; return { id, projectId, blob: file, thumbnail: await thumbnailFrom(file), metadata } }
export const assetUrl = (blob: Blob) => URL.createObjectURL(blob)
