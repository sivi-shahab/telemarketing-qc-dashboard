# Perbandingan `4-service-telemarketing-qc-system/dashboard` vs `telemarketing-qc-dashboard`

Tanggal: 15 September 2026
Status: **dokumen review — belum ada kode yang diubah.**

**A** = `4-service-telemarketing-qc-system/dashboard` (repo monolit, HEAD `1ccd74c`).
**B** = repo ini (HEAD `46b4fa8`, branch `main`).

---

## 1. Ringkasan

61 berkas `src/` ada di kedua sisi; **18 di antaranya berbeda isi**. A tidak punya satu
pun berkas yang tidak ada di sini; B punya enam tambahan (`router/index.js`,
`components/ResultDetail.vue`, `views/NotFoundView.vue`, `views/qc/assignTicketData.js`
+ test-nya, `assets/pdf-text-layer.css`).

| Berkas | hanya di A | hanya di B |
|---|---:|---:|
| `views/dashboard/ResultsView.vue` | 513 | 889 |
| `components/EvaluationView.vue` | **227** | 17 |
| `views/dashboard/TranscriptsView.vue` | 200 | 253 |
| `views/dashboard/StatsView.vue` | 193 | 325 |
| `views/upload/UploadAudioView.vue` | 138 | **1333** |
| `views/qc/AssignTicketView.vue` | 121 | 134 |
| `components/UploadDocumentModal.vue` | 35 | 10 |
| `views/dashboard/TranscriptDetailView.vue` | 22 | 111 |
| `components/AgentErrorTable.vue` | 19 | 2 |
| `components/PdfViewer.vue` | 15 | 136 |
| `components/ManualCheckModal.vue` | 14 | 17 |
| `views/spq-head/RoleHierarchyView.vue` | 13 | 9 |
| `api/client.js` | 12 | 13 |
| `components/DocumentsSection.vue` | 10 | 3 |
| `views/upload/GetResultView.vue` | 8 | 58 |
| `utils/pdfRender.js` | 5 | 55 |
| `stores/auth.js` | 1 | 8 |
| `components/SidebarMenu.vue` | 0 | 4 |

## 2. Temuan utama: dashboard ini BELUM merender satu pun field baru

Seluruh pekerjaan lapisan API kemarin mengirim field yang tidak dibaca siapa pun di sini:

| Field / endpoint | dirender A | dirender B |
|---|---|---|
| `stages` (tabel progres pipeline) | `ResultsView.vue` | **tidak ada** |
| `document_mismatches` | `ResultsView.vue` | **tidak ada** |
| `recording_types` | `ResultsView.vue` | **tidak ada** |
| `manual_approved_at` / `_by` | `AssignTicketView.vue` | **tidak ada** |
| slot `mus_exception_confirmation` | `UploadDocumentModal.vue` | **tidak ada** |
| `GET /qc_assignment/unassigned` | `AssignTicketView.vue` | **tidak ada** |

Jadi port ini bukan tambahan opsional — ia **sisi konsumen** dari yang sudah dibangun.

## 3. Temuan kedua: bobot scorecard v3 masih ter-hardcode di sini

`components/EvaluationView.vue` menuliskan bobot produk langsung di kode:

```
B (repo ini)  Mega Cashline 108.75   Mega Ultima Shield 41.25
A             Mega Cashline 100      Mega Ultima Shield 35.5   MUS Kartu Kredit 13.25
```

Teks penjelas di layar pun menyebut "skor maksimal 108,75".

**Ini konsekuensi scorecard v4 yang belum tercatat sebelumnya.** Sesudah api naik, rincian
"Skor Maksimal" yang ditampilkan dashboard akan **bertentangan dengan skor yang dihitung
server** — dan yang paling membingungkan, keduanya tampil di layar yang sama.

## 4. Yang perlu di-port

| # | Fitur | Berkas | Pasangannya |
|---|---|---|---|
| 1 | Bobot scorecard v4 + tampilan pengecualian MUS | `EvaluationView.vue` | Batch 4 core |
| 2 | Slot "Konfirmasi Pengecualian MUS" + terima JPG/PNG khusus slot itu | `UploadDocumentModal.vue` | A1 |
| 3 | Pratinjau `<img>` untuk dokumen gambar (`mime_type` `image/*`) | `DocumentsSection.vue` | A1 |
| 4 | Tabel progres pipeline (`stages`), `document_mismatches`, `recording_types` | `ResultsView.vue` | A9, A2 |
| 5 | Pratinjau Auto Assign (`/qc_assignment/unassigned`) + kolom Approved | `AssignTicketView.vue` | A7, A4 |
| 6 | Keterangan "usulan ini ditinjau hierarki, termasuk bila sama dengan AI Status" | `ManualCheckModal.vue` | A8 |
| 7 | Point of Improvement sebagai paragraf KEDUA di kolom Reason | `AgentErrorTable.vue` | — |

Nomor 6 kecil tetapi penting: sesudah A8, vonis QC tidak lagi final seketika. Kalimat itu
memberitahu QC **sebelum** menekan Submit, bukan sesudahnya.

## 5. Fondasi B yang TIDAK boleh tersentuh

1. **`api/client.js`** — token dibaca dari Pinia store (`useAuthStore`), bukan
   `localStorage` langsung; refresh dijalankan store supaya ref tidak basi. A masih
   menulis `localStorage` sendiri. `baseURL` default juga milik lingkungan ini.
2. **Delete All + Reprocess All** di `ResultsView.vue` (~26 baris `reprocess`, blok
   `DeleteAll`, pembatalan job).
3. **Proxy `/tickets_daily`** di `TranscriptsView.vue` dan `AssignTicketView.vue` —
   pasangan endpoint ber-RBAC di api; A masih menembak App C langsung.
4. **`UploadAudioView.vue`** (1.333 baris unik) — jalur audio & recording queue.
5. **`PdfViewer.vue` + `utils/pdfRender.js` + `assets/pdf-text-layer.css`** (136+55 baris).
6. **`StatsView.vue`**: "Avg Failure Rate" + "Total Recording" (21 kemunculan vs 9 di A) —
   pasangan `_avg`/`_avg_of` di core yang sudah dipertahankan saat port core.
7. **Enam berkas yang hanya ada di sini**: `router/index.js`, `ResultDetail.vue`,
   `NotFoundView.vue`, `assignTicketData.js` + `assignTicketData.test.mjs`,
   `pdf-text-layer.css`.

## 6. Yang perlu DIPUTUSKAN

### 6.1 `StatsView.vue` — dua perubahan yang bertabrakan

A mengganti istilah **"Total Submission" → "Data Leads"** (14 kemunculan), termasuk nama
tab. B memakai **"Avg Failure Rate" + "Total Recording"** yang datang bersama perubahan
penyebut di core (2 September 2026) — dan itu fondasi yang sudah dipertahankan.

Keduanya menyentuh tabel dan label yang sama. Perlu diputuskan: ikut istilah "Data Leads"
milik A, atau pertahankan istilah sekarang? **Usul: pertahankan istilah B**, dan ambil
dari A hanya yang bukan penamaan. Penggantian istilah adalah keputusan bisnis, bukan
teknis — dan "Avg Failure Rate" di sini sudah sejalan dengan cara server menghitungnya.

### 6.2 `TranscriptsView.vue` — dropdown AI Status disembunyikan

A menyembunyikan dropdown AI Status di menu Transkrip (permintaan 14 Agustus 2026),
dengan alasan menu itu mengurus transkrip yang masuk, bukan vonis penilaiannya. Kodenya
sengaja dipertahankan supaya bisa dihidupkan lagi.

Menghilangkan filter yang sekarang dipakai orang perlu persetujuan Anda.

### 6.3 Cakupan `ResultsView.vue` — 513 lawan 889

Berkas terbesar dan paling dua-arah. Yang perlu diambil hanya tiga hal (§4 no. 4);
sisanya perbedaan tata letak dan kolom yang tumbuh sendiri-sendiri. **Usul: sentuh hanya
tiga hal itu**, jangan menyelaraskan seluruh berkas — risikonya tidak sebanding.

## 7. Usul urutan kerja

| Batch | Isi | Risiko |
|---|---|---|
| D1 | `EvaluationView.vue` — bobot v4 (§3) | sedang — angka yang dilihat QC |
| D2 | `UploadDocumentModal.vue` + `DocumentsSection.vue` — slot MUS + pratinjau gambar | rendah |
| D3 | `ManualCheckModal.vue` — keterangan hierarki | rendah |
| D4 | `AgentErrorTable.vue` — Point of Improvement | rendah |
| D5 | `AssignTicketView.vue` — pratinjau Auto Assign + kolom Approved | sedang |
| D6 | `ResultsView.vue` — `stages`, `document_mismatches`, `recording_types` | sedang |
| D7 | `StatsView.vue` / `TranscriptsView.vue` — sesudah keputusan §6.1 dan §6.2 | tinggi |

D1 sebaiknya duluan: ia yang paling cepat terlihat salah begitu api naik.

Repo ini ada di branch `main`; pekerjaannya akan dibuat di branch baru.

## 8. Belum diperiksa

`package.json`, `Dockerfile`, `nginx.conf`, `vite.config.js`, `index.html`, dan isi
`public/` — belum dibandingkan.

---

# BAGIAN II — Catatan pelaksanaan

## 9. D1 — `EvaluationView.vue`: bobot scorecard v4

Berkas diambil **utuh** dari repo monolit. Diperiksa lebih dulu: ketujuh belas baris yang
sebelumnya hanya ada di sini **seluruhnya digantikan** versi monolit — bobot v3, komentar
"skor maksimal 108,75", `passing_grade`/`maximum_score` yang dibaca apa adanya dari
`evaluation`, dan `scorecardBelumWeight` yang menjumlah bobot penuh tanpa menghormati
kredit parsial. Tidak ada satu pun fondasi repo ini di berkas ini.

Impor kedua versi identik (`PdfViewer`, empat modal, `useAuthStore`, `P`,
`appealTimeline`) dan pemakaian `<PdfViewer>` sama persis — `:result-id` + `:filename`,
dua prop yang didukung `PdfViewer.vue` repo ini. Jadi `PdfViewer` yang jauh berbeda antar
repo (136 baris unik di sini) tidak terpengaruh.

### Yang ikut masuk selain angkanya

`mus_exemption` (5 kemunculan), `mus_cc` / MUS Kartu Kredit (6), "Mega Ultima Shield
(wajib, tidak dipenuhi)", kredit parsial pada kolom Perubahan, jenis recording &
rekaman perbaikan (11), dan **Point of Improvement**.

### Verifikasi — dari BUNDLE hasil build, bukan dari sumbernya

```
npm test                          : 23 pass, 0 fail
vite build                        : ✓ built in 3.44s

dist/assets/EvaluationView-*.js
  108.75  ->  0 kemunculan     41.25  ->  0 kemunculan
  35.5    ->  3                13.25  ->  1
  "MUS Kartu Kredit"                          -> ada
  "Mega Ultima Shield (wajib, tidak dipenuhi)" -> ada
```

Angka v3 benar-benar **hilang dari artefak yang dikirim ke browser**, bukan sekadar
diganti di sumber. Itu pemeriksaan yang berarti di sini: bobotnya ter-hardcode, jadi
satu-satunya bukti yang meyakinkan adalah tidak adanya lagi angka lama di bundle.

`dist/` ada di `.gitignore`, jadi build tidak mengotori commit.

### Tidak ada test baru

Konvensi test repo ini (`node --test` atas modul `.js` murni — lihat
`assignTicketData.test.mjs`) menuntut logikanya berdiri di luar SFC. Perhitungan bobot
hidup di dalam `EvaluationView.vue`; mengeluarkannya adalah refactor tersendiri yang
justru akan menjauhkan berkas ini dari repo monolit. Jadi D1 **tidak** menambah test —
yang menjaganya hanya pemeriksaan bundle di atas.
