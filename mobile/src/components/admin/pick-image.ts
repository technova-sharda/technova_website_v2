import * as ImagePicker from 'expo-image-picker'

/** Opens the photo library and returns a file part for FormData under "file", or null if cancelled. */
export async function pickImageForm(square: boolean) {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, ...(square ? { aspect: [1, 1] as [number, number] } : {}) })
  if (r.canceled || !r.assets[0]) return null
  const a = r.assets[0]
  const fd = new FormData()
  fd.append('file', { uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' } as unknown as Blob)
  return fd
}
