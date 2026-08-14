import { Document as DocxDocument, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { getProjectAssets, saveAsset } from './db'
import { generateBiography, parseProject, sortPeople, type GenealogyProject, type Person } from './domain'

const safeFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '_') || 'genealogy'
const download = (blob: Blob, filename: string) => saveAs(blob, filename)
const archiveAssetPath = (id: string, name: 'original' | 'thumbnail') => `assets/${id}/${name}`

export function exportRawData(project: GenealogyProject): void { download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json;charset=utf-8' }), `${safeFileName(project.project.name)}.json`) }

export async function exportProjectPackage(project: GenealogyProject): Promise<void> {
  const archive = new JSZip(); const assets = await getProjectAssets(project.project.id)
  const files = assets.flatMap((asset) => [{ path: archiveAssetPath(asset.id, 'original'), mimeType: asset.metadata.mimeType, size: asset.blob.size }, { path: archiveAssetPath(asset.id, 'thumbnail'), mimeType: asset.thumbnail.type, size: asset.thumbnail.size }])
  archive.file('manifest.json', JSON.stringify({ format: 'genealogy-package/v2', schemaVersion: 2, projectId: project.project.id, files }, null, 2))
  archive.file('genealogy.json', JSON.stringify(project, null, 2))
  for (const asset of assets) { archive.file(archiveAssetPath(asset.id, 'original'), asset.blob); archive.file(archiveAssetPath(asset.id, 'thumbnail'), asset.thumbnail) }
  download(await archive.generateAsync({ type: 'blob' }), `${safeFileName(project.project.name)}.genealogy.zip`)
}

export async function importProjectFile(file: File): Promise<GenealogyProject> {
  const content = await file.arrayBuffer()
  if (!file.name.toLowerCase().endsWith('.zip')) return parseProject(JSON.parse(new TextDecoder().decode(content)))
  const archive = await JSZip.loadAsync(content); const projectFile = archive.file('genealogy.json')
  if (!projectFile) throw new Error('项目包中缺少 genealogy.json。')
  const manifestFile = archive.file('manifest.json'); const manifest = manifestFile ? JSON.parse(await manifestFile.async('text')) as { format?: string; schemaVersion?: number; files?: Array<{ path: string; size: number }> } : undefined
  if (manifest?.format && !['genealogy-package/v1', 'genealogy-package/v2'].includes(manifest.format)) throw new Error('不支持的项目包格式。')
  if (manifest?.files?.some((item) => item.size > 10 * 1024 * 1024)) throw new Error('项目包包含超过 10 MB 的媒体文件。')
  const project = parseProject(JSON.parse(await projectFile.async('text')))
  for (const metadata of project.media) {
    const original = archive.file(archiveAssetPath(metadata.id, 'original')); if (!original) continue
    const thumbnail = archive.file(archiveAssetPath(metadata.id, 'thumbnail'))
    const blob = new Blob([await original.async('arraybuffer')], { type: metadata.mimeType })
    const thumbnailBlob = thumbnail ? new Blob([await thumbnail.async('arraybuffer')], { type: thumbnail.name.endsWith('.webp') ? 'image/webp' : metadata.mimeType }) : blob
    await saveAsset({ id: metadata.id, projectId: project.project.id, blob, thumbnail: thumbnailBlob, metadata })
  }
  return project
}

const pdfStyles = StyleSheet.create({ page: { padding: 38, fontSize: 10, lineHeight: 1.5, color: '#20332e' }, cover: { padding: 68, justifyContent: 'center', alignItems: 'center' }, title: { fontSize: 30, marginBottom: 16, color: '#0d4b42' }, subtitle: { fontSize: 13, color: '#58746d' }, heading: { fontSize: 18, marginBottom: 12, color: '#0d4b42' }, person: { marginBottom: 12, paddingBottom: 8, borderBottom: '1 solid #d5e3dd' }, name: { fontSize: 13, marginBottom: 4 }, index: { marginBottom: 4 }, entry: { marginTop: 5, fontSize: 9 } })
function ReportCover({ project }: { project: GenealogyProject }) { return <Page size="A4" style={[pdfStyles.page, pdfStyles.cover]}><Text style={pdfStyles.title}>{project.project.name}</Text><Text style={pdfStyles.subtitle}>本地家谱出版稿 · {new Date().toLocaleDateString('zh-CN')}</Text></Page> }
function ReportPeople({ people }: { people: Person[] }) { return <Page size="A4" style={pdfStyles.page}><Text style={pdfStyles.heading}>人物志</Text>{people.map((person) => <View key={person.id} style={pdfStyles.person}><Text style={pdfStyles.name}>{person.name}{person.courtesyOrTempleName ? ` · ${person.courtesyOrTempleName}` : ''}</Text><Text>{generateBiography(person)}</Text>{person.entries.map((entry) => <Text key={entry.id} style={pdfStyles.entry}>{entry.category} · {entry.title}</Text>)}</View>)}</Page> }
function PdfReport({ project }: { project: GenealogyProject }) { const people = sortPeople(project); return <Document title={project.project.name} author="谱笺"><ReportCover project={project} /><Page size="A4" style={pdfStyles.page}><Text style={pdfStyles.heading}>成员索引</Text>{people.map((person) => <Text key={person.id} style={pdfStyles.index}>{person.name}{person.courtesyOrTempleName ? `（${person.courtesyOrTempleName}）` : ''} · {person.entries.length} 条记录</Text>)}</Page><ReportPeople people={people} /></Document> }
export async function exportPdf(project: GenealogyProject): Promise<void> { download(await pdf(<PdfReport project={project} />).toBlob(), `${safeFileName(project.project.name)}.pdf`) }

export async function exportWord(project: GenealogyProject): Promise<void> {
  const people = sortPeople(project)
  const children = [
    new Paragraph({ text: project.project.name, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: '成员索引', heading: HeadingLevel.HEADING_1 }),
    ...people.map((person) => new Paragraph({ children: [new TextRun({ text: `${person.name}${person.courtesyOrTempleName ? `（${person.courtesyOrTempleName}）` : ''}`, bold: true })] })),
    new Paragraph({ text: '人物志', heading: HeadingLevel.HEADING_1 }),
    ...people.flatMap((person) => [
      new Paragraph({ text: person.name, heading: HeadingLevel.HEADING_2 }),
      new Paragraph(generateBiography(person)),
      ...person.entries.map((entry) => new Paragraph(`${entry.category} · ${entry.title}${entry.startDate ? `（${entry.startDate}）` : ''}：${entry.content}`)),
    ]),
  ]
  const document = new DocxDocument({ sections: [{ children }] })
  download(await Packer.toBlob(document), `${safeFileName(project.project.name)}.docx`)
}

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
const xhtmlPage = (title: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN"><head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${escapeXml(title)}</h1>${body}</body></html>`
export async function exportEpub(project: GenealogyProject): Promise<void> {
  const archive = new JSZip(); const people = sortPeople(project); const assets = await getProjectAssets(project.project.id)
  archive.file('mimetype', 'application/epub+zip', { compression: 'STORE' }); archive.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'); archive.file('OEBPS/style.css', 'body{font-family:serif;line-height:1.7;margin:6%;color:#20332e}h1,h2{color:#0d4b42}article{margin-bottom:2em}.portrait{max-width:220px;max-height:220px}')
  for (const asset of assets) archive.file(`OEBPS/images/${asset.id}.${asset.metadata.mimeType.split('/')[1]}`, asset.thumbnail)
  archive.file('OEBPS/index.xhtml', xhtmlPage(project.project.name, `<p>共收录 ${people.length} 位人物。</p><h2>成员索引</h2><ol>${people.map((person) => `<li><a href="people.xhtml#${escapeXml(person.id)}">${escapeXml(person.name)}</a></li>`).join('')}</ol>`))
  archive.file('OEBPS/people.xhtml', xhtmlPage('人物志', people.map((person) => { const image = person.portraitMediaId ? project.media.find((item) => item.id === person.portraitMediaId) : undefined; const src = image ? `images/${image.id}.${image.mimeType.split('/')[1]}` : ''; return `<article id="${escapeXml(person.id)}"><h2>${escapeXml(person.name)}${person.courtesyOrTempleName ? ` · ${escapeXml(person.courtesyOrTempleName)}` : ''}</h2>${src ? `<img class="portrait" src="${src}" alt="${escapeXml(person.name)}"/>` : ''}<p>${escapeXml(generateBiography(person)).replace(/\n/g, '<br/>')}</p>${person.entries.map((entry) => `<h3>${escapeXml(entry.title)}</h3><p>${escapeXml(entry.content)}</p>`).join('')}</article>` }).join('')))
  archive.file('OEBPS/nav.xhtml', xhtmlPage('目录', '<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="index.xhtml">成员索引</a></li><li><a href="people.xhtml">人物志</a></li></ol></nav>'))
  const imageManifest = assets.map((asset) => `<item id="${asset.id}" href="images/${asset.id}.${asset.metadata.mimeType.split('/')[1]}" media-type="${asset.thumbnail.type || asset.metadata.mimeType}"/>`).join('')
  archive.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${escapeXml(project.project.id)}</dc:identifier><dc:title>${escapeXml(project.project.name)}</dc:title><dc:language>zh-CN</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="index" href="index.xhtml" media-type="application/xhtml+xml"/><item id="people" href="people.xhtml" media-type="application/xhtml+xml"/><item id="style" href="style.css" media-type="text/css"/>${imageManifest}</manifest><spine><itemref idref="index"/><itemref idref="people"/></spine></package>`)
  download(await archive.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' }), `${safeFileName(project.project.name)}.epub`)
}
