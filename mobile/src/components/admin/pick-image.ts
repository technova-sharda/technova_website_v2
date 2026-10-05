import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

export type PickedImage = { uri: string; name: string; type: string }

/**
 * Opens the photo library and returns the chosen photo as a JPEG no wider than `maxWidth`.
 * Phone cameras often save HEIC/HEIF, which the website's image library can't read
 * ("unsupported image format"), and full-size photos are slow to upload, so every
 * image is re-encoded on the phone first. Returns null if the user cancels.
 */
export async function pickImage({ square = false, aspect, maxWidth = 1600 }: { square?: boolean; aspect?: [number, number]; maxWidth?: number } = {}): Promise<PickedImage | null> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], quality: 1, allowsEditing: true,
    ...(square ? { aspect: [1, 1] as [number, number] } : aspect ? { aspect } : {}),
  })
  if (r.canceled || !r.assets[0]) return null
  const a = r.assets[0]
  const ctx = ImageManipulator.manipulate(a.uri)
  if (a.width > maxWidth) ctx.resize({ width: maxWidth })
  const image = await ctx.renderAsync()
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })
  const base = (a.fileName ?? `photo-${Date.now()}`).replace(/\.[^.]*$/, '').replace(/[^\w-]+/g, '_') || 'photo'
  return { uri: out.uri, name: `${base}.jpg`, type: 'image/jpeg' }
}

/** Same as pickImage, wrapped as FormData with the file under "file" (club logo, member photo). */
export async function pickImageForm(square: boolean) {
  const img = await pickImage({ square, maxWidth: square ? 800 : 1024 })
  if (!img) return null
  const fd = new FormData()
  fd.append('file', img as unknown as Blob)
  return fd
}
