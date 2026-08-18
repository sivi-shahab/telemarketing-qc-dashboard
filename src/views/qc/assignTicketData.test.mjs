import test from 'node:test'
import assert from 'node:assert/strict'
import { groupTickets, groupStatus, joinLocalResults } from './assignTicketData.js'

test('groupTickets mengelompokkan beberapa tiket ke satu ticket id', () => {
  const groups = groupTickets([
    { id: 'A1', tiket_id: 'A1_1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1 },
    { id: 'A1', tiket_id: 'A1_2', context: 'card', created_time: '2026-07-28T12:00:00', processed_at: 2 },
    { id: 'B2', tiket_id: 'B2_1', context: 'ntb', created_time: '2026-07-28T11:00:00', processed_at: 3 },
  ])
  assert.equal(groups.length, 2)
  const a1 = groups.find((g) => g.id === 'A1')
  assert.equal(a1.tickets.length, 2)
  assert.deepEqual(a1.contexts, ['card'])
})

test('groupTickets menggabungkan context yang berbeda dalam satu grup', () => {
  const [g] = groupTickets([
    { id: 'A1', context: 'cashline', created_time: '2026-07-28T10:00:00', processed_at: 1 },
    { id: 'A1', context: 'ntb', created_time: '2026-07-28T11:00:00', processed_at: 2 },
    { id: 'A1', context: 'cashline', created_time: '2026-07-28T12:00:00', processed_at: 3 },
  ])
  assert.deepEqual(g.contexts, ['cashline', 'ntb'])
})

test('groupTickets memakai tiket_id sebagai kunci bila id kosong', () => {
  const [g] = groupTickets([{ tiket_id: 'X9_1', context: 'card', created_time: null, processed_at: 1 }])
  assert.equal(g.id, 'X9_1')
})

test('groupTickets mengurutkan grup dari yang terbaru', () => {
  const groups = groupTickets([
    { id: 'LAMA', context: 'card', created_time: '2026-07-28T08:00:00', processed_at: 1 },
    { id: 'BARU', context: 'card', created_time: '2026-07-28T20:00:00', processed_at: 1 },
  ])
  assert.deepEqual(groups.map((g) => g.id), ['BARU', 'LAMA'])
})

test('groupTickets mengabaikan context kosong', () => {
  const [g] = groupTickets([
    { id: 'A1', context: '', created_time: '2026-07-28T10:00:00', processed_at: 1 },
    { id: 'A1', context: null, created_time: '2026-07-28T11:00:00', processed_at: 1 },
  ])
  assert.deepEqual(g.contexts, [])
})

test('groupStatus done bila semua tiket punya processed_at', () => {
  const [g] = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1785249460 },
    { id: 'A1', context: 'card', created_time: '2026-07-28T11:00:00', processed_at: 1785249999 },
  ])
  assert.equal(groupStatus(g), 'done')
})

test('groupStatus belum diproses bila ada satu processed_at null', () => {
  const [g] = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1785249460 },
    { id: 'A1', context: 'card', created_time: '2026-07-28T11:00:00', processed_at: null },
  ])
  assert.equal(groupStatus(g), 'belum diproses')
})

test('groupStatus memperlakukan processed_at 0 sebagai sudah diproses', () => {
  const [g] = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 0 },
  ])
  assert.equal(groupStatus(g), 'done')
})

test('groupStatus belum diproses untuk grup tanpa tiket', () => {
  assert.equal(groupStatus({ id: 'A1', contexts: [], tickets: [], latest: null }), 'belum diproses')
})

test('joinLocalResults mengisi data QC dari hasil lokal yang cocok', () => {
  const groups = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(groups, [
    { id: 'A1', assigned_qc: 'qc01', assigned_at: '2026-07-29T03:00:00', qc_checked_at: '2026-07-30T04:00:00', qc_checked_by: 'qc01' },
  ])
  assert.equal(row.assigned_qc, 'qc01')
  assert.equal(row.assigned_at, '2026-07-29T03:00:00')
  assert.equal(row.qc_checked_at, '2026-07-30T04:00:00')
  assert.equal(row.qc_checked_by, 'qc01')
})

test('joinLocalResults memberi null bila ticket belum ada di sistem ini', () => {
  const groups = groupTickets([
    { id: 'BARU', context: 'ntb', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(groups, [{ id: 'LAIN', assigned_qc: 'qc01' }])
  assert.equal(row.assigned_qc, null)
  assert.equal(row.assigned_at, null)
  assert.equal(row.qc_checked_at, null)
  assert.equal(row.qc_checked_by, null)
})

test('joinLocalResults memakai hasil lokal PERTAMA saat satu ticket punya banyak result', () => {
  // /list_results terurut uploaded_at menurun, jadi yang pertama adalah yang terbaru.
  const groups = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(groups, [
    { id: 'A1', assigned_qc: 'baru', assigned_at: '2026-07-30T00:00:00' },
    { id: 'A1', assigned_qc: 'lama', assigned_at: '2026-07-01T00:00:00' },
  ])
  assert.equal(row.assigned_qc, 'baru')
})

test('joinLocalResults menyertakan status hasil groupStatus', () => {
  const groups = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: null },
  ])
  const [row] = joinLocalResults(groups, [])
  assert.equal(row.status, 'belum diproses')
})

test('joinLocalResults tetap jalan bila daftar lokal kosong atau null', () => {
  const groups = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  assert.equal(joinLocalResults(groups, null)[0].assigned_qc, null)
  assert.equal(joinLocalResults(groups, [])[0].status, 'done')
})

test('joinLocalResults memakai /qc_assignments untuk ticket yang belum punya baris result', () => {
  // Regresi: assignment tersimpan di tabel qc_assignments, tapi /list_results
  // hanya beriterasi per baris `results`. Ticket yang belum diproses tidak
  // muncul di sana, sehingga assignment "hilang" setelah reload.
  const groups = groupTickets([
    { id: '131133DNTr', context: 'card', created_time: '2026-08-15T10:00:00', processed_at: null },
  ])
  const [row] = joinLocalResults(groups, [], [
    { ticket_id: '131133DNTr', qc_username: 'H21120266', assigned_at: '2026-08-15T07:53:04' },
  ])
  assert.equal(row.assigned_qc, 'H21120266')
  assert.equal(row.assigned_at, '2026-08-15T07:53:04')
})

test('joinLocalResults: qc_assignments menang atas snapshot /list_results', () => {
  const groups = groupTickets([
    { id: 'A1', context: 'card', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(
    groups,
    [{ id: 'A1', assigned_qc: 'qc_lama', assigned_at: '2026-07-01T00:00:00', qc_checked_at: '2026-07-30T04:00:00', qc_checked_by: 'qc01' }],
    [{ ticket_id: 'A1', qc_username: 'qc_baru', assigned_at: '2026-07-29T03:00:00' }],
  )
  assert.equal(row.assigned_qc, 'qc_baru')
  assert.equal(row.assigned_at, '2026-07-29T03:00:00')
  // kolom pemeriksaan QC tetap dari /list_results
  assert.equal(row.qc_checked_at, '2026-07-30T04:00:00')
  assert.equal(row.qc_checked_by, 'qc01')
})

test('joinLocalResults: ticket tanpa assignment tetap null', () => {
  const groups = groupTickets([
    { id: 'BARU', context: 'ntb', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(groups, [], [{ ticket_id: 'LAIN', qc_username: 'qc01' }])
  assert.equal(row.assigned_qc, null)
  assert.equal(row.assigned_at, null)
})
