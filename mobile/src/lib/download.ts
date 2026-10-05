/**
 * Downloads a file from the website into the app's cache and opens the system
 * sheet (open in a PDF viewer, save to Files, share on WhatsApp…). Nothing goes
 * through the browser.
 */
import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { API_URL } from './config'
import { getApiToken } from './api'

const UTI: Record<string, string> = { 'application/pdf': 'com.adobe.pdf', 'text/csv': 'public.comma-separated-values-text' }

export async function downloadAndOpen(path: string, opts: { mimeType: string; title: string }) {
  const dir = new Directory(Paths.cache, 'downloads')
  if (!dir.exists) dir.create({ intermediates: true })
  const token = getApiToken()
  const file = await File.downloadFileAsync(`${API_URL}${path}`, dir, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  })
  if (!(await Sharing.isAvailableAsync())) throw new Error('Saved, but this phone has no app to open it')
  await Sharing.shareAsync(file.uri, { mimeType: opts.mimeType, dialogTitle: opts.title, UTI: UTI[opts.mimeType] })
  return file.uri
}
