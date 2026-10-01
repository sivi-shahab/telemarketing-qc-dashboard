// Aturan upload menu OCR Gambar. Teks pesannya SAMA dengan yang dikirim API
// (`api/routers/ocr_image.py`) supaya user melihat kalimat yang sama di mana pun
// penolakannya terjadi.
export const OCR_MAX_FILES = 10
export const OCR_MAX_BYTES = 10 * 1024 * 1024
// Browser sering memberi `type` kosong untuk HEIC/HEIF (Windows) — ekstensi ini
// tetap diterima; pemeriksaan sebenarnya ada di API (isi file dibaca Pillow).
const IMAGE_EXTENSIONS = ['.heic', '.heif', '.tif', '.tiff', '.avif', '.jfif', '.jp2']
export const OCR_ACCEPT = 'image/*,.heic,.heif'

export const STATUS_LABEL = {
  pending: 'Menunggu',
  processing: 'Diproses',
  done: 'Selesai',
  failed: 'Gagal',
}

export function validateOcrFiles(files) {
  const list = Array.from(files || [])
  if (!list.length) return 'Pilih minimal satu gambar'
  if (list.length > OCR_MAX_FILES) return `Maksimal ${OCR_MAX_FILES} gambar per upload`
  for (const f of list) {
    const name = (f.name || '').toLowerCase()
    const isImage = (f.type || '').startsWith('image/') || IMAGE_EXTENSIONS.some((e) => name.endsWith(e))
    if (!isImage) return `File '${f.name}' bukan gambar yang bisa dibaca`
    if (f.size > OCR_MAX_BYTES) return `File '${f.name}' melebihi 10 MB`
  }
  return ''
}

export function txtFilename(filename) {
  const base = (filename || '').replace(/\.[^.]+$/, '')
  return `${base || 'ocr'}.txt`
}

export function hasActive(items) {
  return (items || []).some((i) => i.status === 'pending' || i.status === 'processing')
}
