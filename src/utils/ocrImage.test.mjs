import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateOcrFiles, txtFilename, hasActive, OCR_MAX_BYTES } from './ocrImage.js'

const f = (name, size = 100, type = 'image/png') => ({ name, size, type })

test('kosong ditolak', () => {
  assert.equal(validateOcrFiles([]), 'Pilih minimal satu gambar')
})

test('lebih dari 10 ditolak', () => {
  const files = Array.from({ length: 11 }, (_, i) => f(`${i}.png`))
  assert.equal(validateOcrFiles(files), 'Maksimal 10 gambar per upload')
})

test('jenis gambar apa pun diterima; HEIC/TIFF dikenali dari ekstensi bila type kosong', () => {
  assert.equal(validateOcrFiles([f('a.gif', 1, 'image/gif'), f('b.bmp', 1, 'image/bmp'), f('c.webp', 1, 'image/webp')]), '')
  assert.equal(validateOcrFiles([f('IMG_0001.HEIC', 1, ''), f('scan.tif', 1, ''), f('x.heif', 1, '')]), '')
})

test('bukan gambar ditolak dengan pesan yang sama dengan API', () => {
  assert.equal(validateOcrFiles([f('catatan.txt', 1, 'text/plain')]), "File 'catatan.txt' bukan gambar yang bisa dibaca")
  assert.equal(validateOcrFiles([f('a.pdf', 1, 'application/pdf')]), "File 'a.pdf' bukan gambar yang bisa dibaca")
})

test('lebih dari 10 MB ditolak', () => {
  assert.equal(validateOcrFiles([f('a.png', OCR_MAX_BYTES + 1)]), "File 'a.png' melebihi 10 MB")
  assert.equal(validateOcrFiles([f('a.png', OCR_MAX_BYTES)]), '')
})

test('nama .txt mengikuti nama gambar', () => {
  assert.equal(txtFilename('screenshot chat.PNG'), 'screenshot chat.txt')
  assert.equal(txtFilename('a.b.jpg'), 'a.b.txt')
  assert.equal(txtFilename(''), 'ocr.txt')
})

test('masih ada yang berjalan', () => {
  assert.equal(hasActive([{ status: 'done' }, { status: 'failed' }]), false)
  assert.equal(hasActive([{ status: 'done' }, { status: 'processing' }]), true)
  assert.equal(hasActive([{ status: 'pending' }]), true)
  assert.equal(hasActive(undefined), false)
})
