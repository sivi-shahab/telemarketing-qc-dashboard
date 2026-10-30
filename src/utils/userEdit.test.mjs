import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserPatch, editWarnings, fieldLabel } from './userEdit.js'

const orig = { id: 1, username: '123', name: 'Budi', email: 'b@x.id', role: 'qc', campaign_from_roster: false }
const same = { username: '123', name: 'Budi', email: 'b@x.id', role: 'qc', password: '' }

test('patch hanya berisi field yang berubah (setelah trim)', () => {
  assert.deepEqual(buildUserPatch(orig, same, { canEditRole: true }), {})
  assert.deepEqual(
    buildUserPatch(orig, { ...same, name: '  Budi S  ', email: ' b@x.id ' }, { canEditRole: true }),
    { name: 'Budi S' },
  )
})

test('password kosong tidak dikirim; terisi dikirim', () => {
  assert.equal('password' in buildUserPatch(orig, same, { canEditRole: true }), false)
  assert.deepEqual(buildUserPatch(orig, { ...same, password: 'rahasia1' }, { canEditRole: true }), { password: 'rahasia1' })
})

test('role diabaikan bila tidak boleh edit role', () => {
  const f = { ...same, role: 'admin' }
  assert.deepEqual(buildUserPatch(orig, f, { canEditRole: false }), {})
  assert.deepEqual(buildUserPatch(orig, f, { canEditRole: true }), { role: 'admin' })
})

test('peringatan NIP berubah', () => {
  assert.deepEqual(editWarnings(orig, { username: '999' }, { salesScope: false }), [
    'Tiket dan seluruh riwayat akan ikut pindah ke NIP baru.',
  ])
})

test('peringatan NIP sales: dua peringatan', () => {
  assert.deepEqual(editWarnings(orig, { username: '999' }, { salesScope: true }), [
    'Tiket dan seluruh riwayat akan ikut pindah ke NIP baru.',
    'User sales: roster Sales Database harus diupload ulang dengan NIP baru; sebelum itu user ini tidak melihat data. Data tiket lama di App C/DWH tetap memakai NIP lama.',
  ])
})

test('peringatan role qc -> lain saja', () => {
  const w = 'Tiket hari ini yang belum dikerjakan akan dibagi ulang di slot auto assign berikutnya.'
  assert.deepEqual(editWarnings(orig, { role: 'admin' }, { salesScope: false }), [w])
  assert.deepEqual(editWarnings({ ...orig, role: 'admin' }, { role: 'qc' }, { salesScope: false }), [])
  assert.deepEqual(editWarnings(orig, { name: 'X' }, { salesScope: true }), [])
})

test('fieldLabel', () => {
  assert.equal(fieldLabel('username'), 'Username (NIP)')
  assert.equal(fieldLabel('name'), 'Nama')
  assert.equal(fieldLabel('email'), 'Email')
  assert.equal(fieldLabel('role'), 'Role')
  assert.equal(fieldLabel('password'), 'Password')
  assert.equal(fieldLabel('upload_audio'), 'Upload Audio')
  assert.equal(fieldLabel('upload_transcript'), 'Upload Transcript')
})
