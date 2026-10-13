import test from 'node:test'
import assert from 'node:assert/strict'
import { groupTickets, groupStatus, joinLocalResults, describeSplit, chunkTicketIds, campaignOptions, filterByCampaign, rowsOutsideDaily } from './assignTicketData.js'

test('groupTickets mengelompokkan beberapa tiket ke satu ticket id', () => {
  const groups = groupTickets([
    { id: 'A1', tiket_id: 'A1_1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1 },
    { id: 'A1', tiket_id: 'A1_2', campaign: 'MCS', created_time: '2026-07-28T12:00:00', processed_at: 2 },
    { id: 'B2', tiket_id: 'B2_1', campaign: 'ACT02', created_time: '2026-07-28T11:00:00', processed_at: 3 },
  ])
  assert.equal(groups.length, 2)
  const a1 = groups.find((g) => g.id === 'A1')
  assert.equal(a1.tickets.length, 2)
  assert.deepEqual(a1.campaigns, ['MCS'])
})

test('groupTickets menggabungkan campaign yang berbeda dalam satu grup', () => {
  const [g] = groupTickets([
    { id: 'A1', campaign: 'LOC26', created_time: '2026-07-28T10:00:00', processed_at: 1 },
    { id: 'A1', campaign: 'ACT02', created_time: '2026-07-28T11:00:00', processed_at: 2 },
    { id: 'A1', campaign: 'LOC26', created_time: '2026-07-28T12:00:00', processed_at: 3 },
  ])
  assert.deepEqual(g.campaigns, ['LOC26', 'ACT02'])
})

test('groupTickets memakai tiket_id sebagai kunci bila id kosong', () => {
  const [g] = groupTickets([{ tiket_id: 'X9_1', campaign: 'MCS', created_time: null, processed_at: 1 }])
  assert.equal(g.id, 'X9_1')
})

test('groupTickets mengurutkan grup dari yang terbaru', () => {
  const groups = groupTickets([
    { id: 'LAMA', campaign: 'MCS', created_time: '2026-07-28T08:00:00', processed_at: 1 },
    { id: 'BARU', campaign: 'MCS', created_time: '2026-07-28T20:00:00', processed_at: 1 },
  ])
  assert.deepEqual(groups.map((g) => g.id), ['BARU', 'LAMA'])
})

test('groupTickets mengabaikan campaign kosong', () => {
  const [g] = groupTickets([
    { id: 'A1', campaign: '', created_time: '2026-07-28T10:00:00', processed_at: 1 },
    { id: 'A1', campaign: null, created_time: '2026-07-28T11:00:00', processed_at: 1 },
  ])
  assert.deepEqual(g.campaigns, [])
})

test('groupStatus done bila semua tiket punya processed_at', () => {
  const [g] = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1785249460 },
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T11:00:00', processed_at: 1785249999 },
  ])
  assert.equal(groupStatus(g), 'done')
})

test('groupStatus belum diproses bila ada satu processed_at null', () => {
  const [g] = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1785249460 },
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T11:00:00', processed_at: null },
  ])
  assert.equal(groupStatus(g), 'belum diproses')
})

test('groupStatus memperlakukan processed_at 0 sebagai sudah diproses', () => {
  const [g] = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 0 },
  ])
  assert.equal(groupStatus(g), 'done')
})

test('groupStatus belum diproses untuk grup tanpa tiket', () => {
  assert.equal(groupStatus({ id: 'A1', campaigns: [], tickets: [], latest: null }), 'belum diproses')
})

test('joinLocalResults mengisi data QC dari hasil lokal yang cocok', () => {
  const groups = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1 },
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
    { id: 'BARU', campaign: 'ACT02', created_time: '2026-07-28T10:00:00', processed_at: 1 },
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
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(groups, [
    { id: 'A1', assigned_qc: 'baru', assigned_at: '2026-07-30T00:00:00' },
    { id: 'A1', assigned_qc: 'lama', assigned_at: '2026-07-01T00:00:00' },
  ])
  assert.equal(row.assigned_qc, 'baru')
})

test('joinLocalResults menyertakan status hasil groupStatus', () => {
  const groups = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: null },
  ])
  const [row] = joinLocalResults(groups, [])
  assert.equal(row.status, 'belum diproses')
})

test('joinLocalResults tetap jalan bila daftar lokal kosong atau null', () => {
  const groups = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  assert.equal(joinLocalResults(groups, null)[0].assigned_qc, null)
  assert.equal(joinLocalResults(groups, [])[0].status, 'done')
})

test('joinLocalResults memakai /qc_assignments untuk ticket yang belum punya baris result', () => {
  // Regresi: assignment tersimpan di tabel qc_assignments, tapi /list_results
  // hanya beriterasi per baris `results`. Ticket yang belum diproses tidak
  // muncul di sana, sehingga assignment "hilang" setelah reload.
  const groups = groupTickets([
    { id: '131133DNTr', campaign: 'MCS', created_time: '2026-08-15T10:00:00', processed_at: null },
  ])
  const [row] = joinLocalResults(groups, [], [
    { ticket_id: '131133DNTr', qc_username: 'H21120266', assigned_at: '2026-08-15T07:53:04' },
  ])
  assert.equal(row.assigned_qc, 'H21120266')
  assert.equal(row.assigned_at, '2026-08-15T07:53:04')
})

test('joinLocalResults: qc_assignments menang atas snapshot /list_results', () => {
  const groups = groupTickets([
    { id: 'A1', campaign: 'MCS', created_time: '2026-07-28T10:00:00', processed_at: 1 },
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
    { id: 'BARU', campaign: 'ACT02', created_time: '2026-07-28T10:00:00', processed_at: 1 },
  ])
  const [row] = joinLocalResults(groups, [], [{ ticket_id: 'LAIN', qc_username: 'qc01' }])
  assert.equal(row.assigned_qc, null)
  assert.equal(row.assigned_at, null)
})

// --- describeSplit ---------------------------------------------------------
// Kalimat konfirmasi tombol "Assign Otomatis".
//
// Sejak 2 Oktober 2026 (qc_auto_assign.distribute_evenly) server membagi rata di
// antara QC yang aktif SAAT INI, beban lama tidak dihitung. Server tetap bisa membuang
// sebagian ticket, jadi kalimat ini TIDAK boleh menyebut angka per QC — menyebutnya
// berarti orang menyetujui pembagian yang bukan yang akan terjadi.

test('describeSplit: menyebut jumlah ticket dan jumlah QC', () => {
  const s = describeSplit(134, 12)
  assert.match(s, /134 ticket/)
  assert.match(s, /12 QC/)
})

test('describeSplit: menyebut aturannya, bukan hasil per QC', () => {
  const s = describeSplit(134, 12)
  assert.match(s, /beban lama tidak dihitung/i, 'harus menyebut aturan per momen (2 Okt 2026)')
  assert.match(s, /ditentukan server/i)
})

test('describeSplit: menyebut rata per campaign', () => {
  assert.match(describeSplit(134, 12), /per campaign/)
})

test('describeSplit: TIDAK menjanjikan jumlah per QC', () => {
  // Rumus lama: "11 ticket per QC, 2 QC pertama dapat 12". Kalimat seperti itu tidak
  // boleh muncul lagi — server tidak membagi begitu.
  for (const [n, k] of [[60, 12], [134, 12], [281, 10], [3, 12]]) {
    const s = describeSplit(n, k)
    assert.doesNotMatch(s, /ticket per QC/, `masih menjanjikan jumlah per QC: ${s}`)
    assert.doesNotMatch(s, /QC pertama dapat/, `masih menjanjikan sisa ke QC pertama: ${s}`)
  }
})

test('describeSplit: tanpa QC aktif', () => {
  assert.equal(describeSplit(10, 0), 'Tidak ada QC aktif untuk dibagikan.')
})

test('describeSplit: tanpa ticket', () => {
  assert.equal(describeSplit(0, 12), 'Tidak ada ticket yang belum di-assign.')
})


// --- joinLocalResults: tiga tahap -------------------------------------------

test('joinLocalResults membawa Checked At dan Approved At sebagai DUA field berbeda', () => {
  const groups = [{ id: 'A1', tickets: [], campaigns: [] }]
  const [row] = joinLocalResults(groups, [{
    id: 'A1',
    qc_checked_at: '2026-09-10T08:00:00', qc_checked_by: 'qc01',
    manual_approved_at: '2026-09-11T09:00:00', manual_approved_by: 'tl01',
  }], [])
  assert.equal(row.qc_checked_at, '2026-09-10T08:00:00')
  assert.equal(row.qc_checked_by, 'qc01')
  assert.equal(row.manual_approved_at, '2026-09-11T09:00:00')
  assert.equal(row.manual_approved_by, 'tl01')
})

test('joinLocalResults: sudah dicek tetapi belum disetujui', () => {
  const groups = [{ id: 'A1', tickets: [], campaigns: [] }]
  const [row] = joinLocalResults(groups, [{
    id: 'A1', qc_checked_at: '2026-09-10T08:00:00', qc_checked_by: 'qc01',
  }], [])
  assert.equal(row.qc_checked_at, '2026-09-10T08:00:00')
  assert.equal(row.manual_approved_at, null, 'kolom Approved At harus kosong, bukan meminjam Checked At')
  assert.equal(row.manual_approved_by, null)
})

// --- chunkTicketIds: pengayaan hanya untuk ticket yang tampil -----------------
//
// Halaman ini dulu menarik /list_results halaman demi halaman TANPA filter (sampai
// 10.000 baris) lalu membuang hampir semuanya. Sekarang ia meminta ticket yang
// benar-benar ada di tabelnya — dipotong supaya query string tidak tak terbatas.

test('chunkTicketIds memotong daftar sesuai ukuran', () => {
  assert.deepEqual(chunkTicketIds(['a', 'b', 'c', 'd', 'e'], 2), [['a', 'b'], ['c', 'd'], ['e']])
})

test('chunkTicketIds membuang id kosong dan duplikat', () => {
  assert.deepEqual(chunkTicketIds(['a', '', 'a', null, ' b ', undefined], 10), [['a', 'b']])
})

test('chunkTicketIds tanpa id menghasilkan daftar kosong', () => {
  assert.deepEqual(chunkTicketIds([], 10), [])
  assert.deepEqual(chunkTicketIds(null, 10), [])
})

test('chunkTicketIds: tanpa potongan berarti tidak ada permintaan sama sekali', () => {
  // Penting: nol potongan, BUKAN satu potongan kosong. Satu potongan kosong akan
  // mengirim ticket_ids= kosong, dan itu permintaan yang tidak ada gunanya.
  assert.equal(chunkTicketIds([''], 10).length, 0)
})

// --- Riwayat assignment (tab Log QC, qc_assignment_events) -------------------

import { eventActionLabel, eventSourceLabel, filterEvents } from './assignTicketData.js'

test('label aksi riwayat', () => {
  assert.deepEqual(eventActionLabel('assign'), { text: 'Assign', tone: 'green' })
  assert.deepEqual(eventActionLabel('reassign'), { text: 'Pindah', tone: 'blue' })
  assert.deepEqual(eventActionLabel('unassign'), { text: 'Lepas', tone: 'red' })
  assert.deepEqual(eventActionLabel('aneh'), { text: 'aneh', tone: 'gray' })
})

test('label jalur riwayat', () => {
  assert.equal(eventSourceLabel('manual'), 'Manual')
  assert.equal(eventSourceLabel('auto'), 'Assign Otomatis')
  assert.equal(eventSourceLabel('scheduler'), 'Batch terjadwal')
  assert.equal(eventSourceLabel('lepas'), 'Lepas')
  assert.equal(eventSourceLabel('lepas_semua'), 'Lepas Semua')
  assert.equal(eventSourceLabel('user_deleted'), 'User QC dihapus')
  assert.equal(eventSourceLabel('backfill'), 'Data awal')
  assert.equal(eventSourceLabel(null), '—')
})

test('filterEvents mencari di ticket, QC lama/baru, dan pelaku', () => {
  const ev = [
    { ticket_id: 'T-1', qc_username: 'qc_a', qc_name: 'Ani', previous_qc_username: null, previous_qc_name: null, actor_username: 'tl' },
    { ticket_id: 'T-2', qc_username: null, qc_name: null, previous_qc_username: 'qc_b', previous_qc_name: 'Budi', actor_username: 'spq' },
  ]
  assert.equal(filterEvents(ev, '').length, 2)
  assert.deepEqual(filterEvents(ev, 't-2').map((e) => e.ticket_id), ['T-2'])
  assert.deepEqual(filterEvents(ev, 'budi').map((e) => e.ticket_id), ['T-2'])
  assert.deepEqual(filterEvents(ev, 'ANI').map((e) => e.ticket_id), ['T-1'])
  assert.deepEqual(filterEvents(ev, 'spq').map((e) => e.ticket_id), ['T-2'])
})

test('campaignOptions: campaign unik dari semua baris, urut abjad, kosong dibuang', () => {
  const rows = [
    { id: 'A1', campaigns: ['LOC26', 'ACT02'] },
    { id: 'B2', campaigns: ['ACT02'] },
    { id: 'C3', campaigns: [] },
    { id: 'D4' },
  ]
  assert.deepEqual(campaignOptions(rows), ['ACT02', 'LOC26'])
  assert.deepEqual(campaignOptions(null), [])
})

test('filterByCampaign: kosong = semua; tiket multi-campaign cocok bila salah satunya sama', () => {
  const rows = [
    { id: 'A1', campaigns: ['LOC26', 'ACT02'] },
    { id: 'B2', campaigns: ['ACT02'] },
    { id: 'C3', campaigns: ['MCS'] },
    { id: 'D4' },
  ]
  assert.equal(filterByCampaign(rows, ''), rows)
  assert.deepEqual(filterByCampaign(rows, 'ACT02').map((r) => r.id), ['A1', 'B2'])
  assert.deepEqual(filterByCampaign(rows, 'LOC26').map((r) => r.id), ['A1'])
  assert.deepEqual(filterByCampaign(rows, 'XYZ'), [])
})

test('rowsOutsideDaily: tiket upload langsung (tanpa tickets-daily) tetap jadi baris', () => {
  const local = [
    { id: 'X1', campaign: 'Cashline', status: 'done', qc_checked_at: '2026-10-13T10:00:00' },
    { id: 'X1', campaign: 'Cashline', status: 'error' }, // upload ulang lebih lama — diabaikan
  ]
  const assignments = [{ ticket_id: 'X1', qc_username: 'qc1', assigned_at: '2026-10-13T09:30:01' }]
  const [row] = rowsOutsideDaily(['X1'], local, assignments)
  assert.equal(row.id, 'X1')
  assert.deepEqual(row.campaigns, ['Cashline'])
  assert.equal(row.status, 'done')
  assert.equal(row.outsideDaily, true)
  assert.equal(row.assigned_qc, 'qc1')
  assert.equal(row.assigned_at, '2026-10-13T09:30:01')
  assert.equal(row.qc_checked_at, '2026-10-13T10:00:00')
})

test('rowsOutsideDaily: hanya assignment (belum ada result) tetap tampil; tidak dikenal dibuang', () => {
  const rows = rowsOutsideDaily(['A', 'B'], [], [{ ticket_id: 'A', qc_username: 'qc2', assigned_at: null }])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'A')
  assert.equal(rows[0].status, 'belum diproses')
  assert.deepEqual(rows[0].campaigns, [])
  assert.deepEqual(rowsOutsideDaily([], null, null), [])
})
