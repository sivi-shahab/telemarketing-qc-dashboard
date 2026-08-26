<template>
  <SidebarLayout title="Hierarki Role & Menu">
    <div class="roles-page">
      <div class="card">
        <h2 class="card-title">Hierarki Role Dashboard</h2>
        <p class="card-subtitle">
          Struktur jabatan &amp; pembagian akses menu tiap role. <strong>SPQ Head</strong>
          adalah puncak, membawahi dua divisi: <strong>Sales</strong> dan
          <strong>Quality Control</strong>.
        </p>

        <!-- Diagram hierarki -->
        <div class="tree">
          <div class="top-row">
            <div class="node top badge-red">SPQ Head</div>
            <div class="node top badge-red">Admin</div>
          </div>
          <div class="top-caption">Admin = menu sama persis dengan SPQ Head, tanpa aksi QC di Results</div>
          <div class="branch-labels">
            <span class="branch-label">Divisi Sales</span>
            <span class="branch-label">Divisi Quality Control</span>
          </div>
          <div class="branches">
            <div class="chain">
              <div class="node badge-red">Telesales Head</div>
              <div class="arrow">↓</div>
              <div class="node badge-green">Area Manager</div>
              <div class="arrow">↓</div>
              <div class="node badge-green">Team Leader Sales</div>
              <div class="arrow">↓</div>
              <div class="node badge-blue">Sales Agent</div>
            </div>
            <div class="chain">
              <div class="node badge-yellow">Team Leader QC</div>
              <div class="arrow">↓</div>
              <div class="node badge-yellow">QC</div>
              <div class="node standalone badge-yellow">QC Support</div>
              <div class="standalone-note">standalone · data complaint terisolasi · tanpa Statistics</div>
            </div>
          </div>
          <div class="node standalone-demo badge-gray">Demo</div>
          <div class="standalone-note wide">
            di luar hierarki · read-only showcase (Stats · Results · Campaigns · Upload Transcript)
          </div>
        </div>
      </div>

      <!-- Alur review berjenjang -->
      <div class="card">
        <h2 class="card-title">Dua Alur Review Berjenjang</h2>
        <p class="card-subtitle">
          Dashboard punya <strong>dua</strong> jalur review yang terpisah dan tidak saling
          menggantikan: <strong>Manual Status</strong> (vonis akhir satu tiket) dan
          <strong>Banding Error Code</strong> (koreksi baris error tertentu).
        </p>

        <div class="flow-block">
          <div class="flow-head">
            <span class="flow-name">1 · Manual Status</span>
            <span class="flow-menu">menu Pending Check &amp; kolom Manual Status di Results</span>
          </div>
          <div class="flow">
            <span class="chip badge-yellow">QC · usulan</span>
            <span class="flow-arrow">→</span>
            <span class="chip badge-yellow">Team Leader QC · Terima / Tolak / Teruskan</span>
            <span class="flow-arrow">→</span>
            <span class="chip badge-red">SPQ Head · Approval final</span>
          </div>
          <p class="card-subtitle">
            Vonis human sejajar dengan AI Status: <strong>PASS</strong> (Qualified),
            <strong>FAIL</strong> (Not Qualified), <strong>PENDING</strong> (belum bisa
            diputuskan) — alasan wajib diisi. QC hanya boleh mengusulkan pada tiket yang
            di-assign kepadanya. <strong>Team Leader QC &amp; SPQ Head menetapkan
            LANGSUNG tanpa approval</strong> (final saat disimpan) dan penetapan itu
            menggantikan usulan QC yang masih menunggu. Admin tidak ikut serta di alur ini.
          </p>
          <p class="card-subtitle">
            Sejak 7 Agustus 2026 vonis yang <strong>sudah disetujui juga mengunci AI
            Status</strong> ke nilai yang sama — banding error code sesudahnya tetap
            menggeser skor, tabel Error Code, dan Ringkasan Kategori, tetapi tidak lagi
            mengubah status tiket. Karena kedua kolom jadi tidak pernah berbeda, blok
            <em>Manual Status</em> di tab Overview Stats dihapus dan tab itu kembali
            memuat satu grafik.
          </p>
        </div>

        <div class="flow-block">
          <div class="flow-head">
            <span class="flow-name">2 · Banding Error Code</span>
            <span class="flow-menu">menu Manual Check &amp; tabel Error Code di detail evaluasi</span>
          </div>
          <div class="flow">
            <span class="chip badge-yellow">QC · Maker</span>
            <span class="flow-arrow">→</span>
            <span class="chip badge-yellow">Team Leader QC · Checker</span>
            <span class="flow-arrow">→</span>
            <span class="chip badge-red">SPQ Head · Approval</span>
          </div>
          <p class="card-subtitle">
            QC mengajukan banding (<strong>hapus</strong> / <strong>ubah</strong> /
            <strong>tambah</strong> error code) pada tiket yang di-assign kepadanya. Team
            Leader QC dapat <strong>Terima (final)</strong>, <strong>Tolak (final)</strong>,
            atau <strong>Teruskan ke SPQ Head</strong>. Team Leader QC &amp; SPQ Head juga
            bisa <strong>mengedit error code secara langsung</strong> (tanpa hierarki, langsung
            final) — kecuali saat masih ada banding QC yang pending di baris yang sama.
            Setiap banding yang di-approve otomatis menyesuaikan skor &amp; error card.
          </p>
        </div>
      </div>

      <!-- Role kini data, bukan konstanta -->
      <div class="card">
        <h2 class="card-title">Role Sekarang Bisa Dibuat Sendiri</h2>
        <p class="card-subtitle">
          Sepuluh role di bawah adalah <strong>role bawaan</strong> — tidak bisa dihapus,
          tetapi izin &amp; campaign-nya boleh disesuaikan. Role <strong>baru</strong>
          dibuat lewat menu <strong>Manage Role</strong> dengan menyalin template dari role
          yang sudah ada, lalu memilih campaign-nya.
        </p>
        <div class="flow-block">
          <div class="flow-head">
            <span class="flow-name">Tiga hal yang menentukan hak sebuah role</span>
          </div>
          <div class="flow">
            <span class="chip badge-blue">Izin — boleh melakukan APA</span>
            <span class="flow-arrow">+</span>
            <span class="chip badge-green">Cakupan data — melihat tiket SIAPA</span>
            <span class="flow-arrow">+</span>
            <span class="chip badge-yellow">Campaign — campaign MANA</span>
          </div>
          <p class="card-subtitle">
            <strong>Tidak perlu role terpisah per campaign.</strong> Untuk sisi sales,
            campaign adalah properti ORANG-nya: diambil dari kolom <em>Dedicated</em> di
            Sales Database. Satu role <em>Sales Agent</em> melayani agent Cashline maupun
            NTB — yang membedakan baris roster masing-masing. Agent pindah campaign cukup
            diurus lewat roster; role &amp; user tidak perlu disentuh.
          </p>
          <p class="card-subtitle">
            Ini juga sebabnya campaign tidak bisa dititipkan ke nama role:
            <strong>4 dari 5 Area Manager memegang beberapa campaign sekaligus</strong>
            (satu memegang lima), sedangkan satu user hanya punya satu role. AM melihat
            seluruh campaign yang memang dia kelola.
          </p>
          <p class="card-subtitle">
            Sisi QC (QC, Team Leader QC, QC Support) tidak dibatasi campaign sama sekali —
            cakupan mereka ditentukan <em>assignment tiket</em>. Mencentang campaign pada
            sebuah role hanya <strong>mempersempit</strong>, tidak pernah memperlebar apa
            yang dikatakan roster.
          </p>
        </div>
      </div>

      <!-- Tabel akses menu -->
      <div class="card">
        <h2 class="card-title">Akses Menu per Role</h2>
        <p class="card-subtitle">
          Daftar di bawah persis mengikuti sidebar yang dirender untuk tiap role
          (grup <em>Dashboard</em> · <em>Upload Data</em> · <em>Delete Data</em> ·
          <em>Administration</em>). Menu yang tidak tercantum tidak muncul di sidebar
          <em>dan</em> aksesnya ditolak lewat URL langsung.
        </p>
        <div class="table-wrap">
          <table class="roles-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Divisi</th>
                <th>Cakupan Data</th>
                <th>Menu yang bisa diakses</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in roles" :key="r.role">
                <td><span class="badge" :class="r.badge">{{ r.label }}</span></td>
                <td>{{ r.division }}</td>
                <td>{{ r.scope }}</td>
                <td>
                  <span v-for="m in r.menus" :key="m" class="menu-pill">{{ m }}</span>
                  <div v-if="r.note" class="row-note">{{ r.note }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          Catatan: role <strong>Sales</strong> (Area Manager / Team Leader Sales /
          Sales Agent) di-scope dari NIP di Sales Database; <strong>QC</strong>
          di-scope dari ticket yang di-assign Team Leader QC; <strong>QC Support</strong>
          hanya melihat tiket yang di-upload sendiri oleh QC Support.
        </p>
      </div>

      <!-- Akses fitur di dalam menu -->
      <div class="card">
        <h2 class="card-title">Akses Fitur di dalam Menu</h2>
        <p class="card-subtitle">
          Punya menu yang sama bukan berarti melihat isi yang sama. Tabel ini merinci
          fitur di dalam halaman <strong>Results</strong> dan <strong>Stats</strong>.
        </p>
        <p class="card-subtitle">
          <strong>Admin bukan duplikat SPQ Head.</strong> Menunya identik, tetapi seluruh
          AKSI QC di Results sengaja tidak diberikan kepada Admin — Admin mengurus sistem
          (user, campaign, database), bukan memutus perkara QC.
        </p>
        <div class="table-wrap">
          <table class="roles-table feature-table">
            <thead>
              <tr>
                <th>Menu</th>
                <th>Fitur</th>
                <th>Bisa diakses oleh</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in features" :key="f.menu + f.feature">
                <td><span class="menu-tag">{{ f.menu }}</span></td>
                <td class="feature-name">{{ f.feature }}</td>
                <td>
                  <span v-for="r in f.who" :key="r" class="menu-pill">{{ r }}</span>
                </td>
                <td class="feature-note">{{ f.note }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import SidebarLayout from '../../components/SidebarLayout.vue'

// Sumber kebenaran: SidebarMenu.vue (v-if tiap RouterLink) + router/index.js
// (guard beforeEach). Urutan menu di bawah mengikuti urutan sidebar.
const roles = [
  {
    role: 'spq_head', label: 'SPQ Head', badge: 'badge-red', division: 'Puncak',
    scope: 'Seluruh sistem',
    menus: [
      'Stats', 'Results', 'Transkrip', 'Assign Ticket', 'Manual Check',
      'Pending Check', 'Campaigns', 'Database Sales', 'Database QC',
      'Upload Campaign', 'Upload Audio', 'Upload Transcript', 'Get Result',
      'Upload Database Sales', 'Upload Database QC',
      'Delete Campaign', 'Manage User', 'Manage Role', 'Hierarki Role & Menu',
    ],
    note: 'Satu-satunya role dengan grup Delete Data & Administration.',
  },
  {
    role: 'admin', label: 'Admin', badge: 'badge-red', division: 'Puncak',
    scope: 'Seluruh sistem (menu = SPQ Head)',
    menus: ['Sama persis dengan SPQ Head'],
    note: 'MENU-nya sama persis dengan SPQ Head, tetapi AKSI QC di Results sengaja tidak diberikan: '
      + 'tanpa tombol Set/Ubah & Review Manual Status, tanpa edit error code langsung & Review Banding. '
      + 'Admin mengurus sistem (user, campaign, database), bukan memutus perkara QC — termasuk '
      + 'tanpa tabel perbandingan OCR dokumen, yang juga penilaian QC. '
      + 'Sebagai gantinya Admin boleh upload dokumen pendukung (superuser Team Leader Sales).',
  },
  {
    role: 'telesales_head', label: 'Telesales Head', badge: 'badge-red', division: 'Sales (oversight)',
    scope: 'Semua AM → TL Sales → Agent',
    menus: ['Stats', 'Results'],
    note: 'Stats menampilkan kolom Area Manager (hierarki satu tingkat di bawahnya).',
  },
  {
    role: 'area_manager', label: 'Area Manager', badge: 'badge-green', division: 'Sales',
    scope: 'Area: semua TL Sales & agent di bawahnya (seluruh campaign yang dia kelola)',
    menus: ['Stats', 'Results'],
    note: 'Stats menampilkan kolom Team Leader.',
  },
  {
    role: 'team_leader', label: 'Team Leader Sales', badge: 'badge-green', division: 'Sales',
    scope: 'Tim: agent di bawahnya',
    menus: ['Stats', 'Results'],
    note: 'Satu-satunya role yang boleh UPLOAD dokumen pendukung (KTP/KK/NPWP/buku tabungan).',
  },
  {
    role: 'sales_agent', label: 'Sales Agent', badge: 'badge-blue', division: 'Sales',
    scope: 'Tiket miliknya sendiri',
    menus: ['Stats', 'Results'],
  },
  {
    role: 'team_leader_qc', label: 'Team Leader QC', badge: 'badge-yellow', division: 'Quality Control',
    scope: 'Semua tiket (checker banding & pembagi ticket)',
    menus: [
      'Stats', 'Results', 'Transkrip', 'Assign Ticket', 'Manual Check',
      'Pending Check', 'Upload Audio', 'Upload Transcript',
    ],
    note: 'Dari grup Upload Data hanya dua entri ini yang muncul (tanpa Upload Campaign / Get Result).',
  },
  {
    role: 'qc', label: 'QC', badge: 'badge-yellow', division: 'Quality Control',
    scope: 'Hanya tiket yang di-assign kepadanya',
    menus: ['Stats (assigned)', 'Results (assigned)', 'Transkrip', 'Manual Check', 'Pending Check'],
    note: 'Tanpa grup Upload Data / Delete Data — QC hanya menilai, tidak meng-upload.',
  },
  {
    role: 'qc_support', label: 'QC Support', badge: 'badge-yellow', division: 'Quality Control (standalone)',
    scope: 'Tiket complaint miliknya sendiri (isolated — role lain tak bisa lihat)',
    menus: ['Results', 'Transkrip', 'Upload Audio', 'Upload Transcript'],
    note: 'TANPA menu Stats — membuka /dashboard/stats otomatis dialihkan ke Results.',
  },
  {
    role: 'demo', label: 'Demo', badge: 'badge-gray', division: 'Showcase (demo ke orang awam)',
    scope: 'Seluruh hasil (global) — untuk demo end-to-end ke orang awam',
    menus: ['Stats', 'Results', 'Campaigns', 'Upload Transcript'],
    note: 'Read-only: tanpa Transkrip, Manual Check, Pending Check, Delete, maupun Administration.',
  },
]

// Fitur di dalam halaman — gate-nya ada di ResultsView.vue / EvaluationView.vue /
// StatsView.vue, bukan di sidebar.
const features = [
  {
    menu: 'Results', feature: 'Detail evaluasi (Executive Summary, skor, Ringkasan Kategori)',
    who: ['QC', 'Team Leader QC', 'QC Support', 'SPQ Head', 'Admin', 'Demo'],
    note: 'Sisi sales (Sales Agent / TL Sales / AM / Telesales Head) hanya melihat tabel Error Code yang disederhanakan.',
  },
  {
    menu: 'Results', feature: 'Kolom Bobot & Skor pada Ringkasan Kategori',
    who: ['Semua kecuali QC'],
    note: 'QC menilai lolos/tidaknya kategori, bukan angka bobot & skornya.',
  },
  {
    menu: 'Results', feature: 'Critical Failure(s)',
    who: ['Semua kecuali sisi sales'],
    note: 'Disembunyikan untuk Sales Agent, Team Leader Sales, Area Manager, dan Telesales Head.',
  },
  {
    menu: 'Results', feature: 'Manual Status — tombol Set / Ubah',
    who: ['QC', 'Team Leader QC', 'SPQ Head'],
    note: 'QC = usulan (tiket assigned saja). TL QC & SPQ Head menetapkan langsung, final. Admin sengaja dikecualikan.',
  },
  {
    menu: 'Results', feature: 'Manual Status — tombol Review',
    who: ['Team Leader QC', 'SPQ Head'],
    note: 'TL QC: Terima/Tolak/Teruskan usulan QC. SPQ Head: approval final untuk yang diteruskan. Admin sengaja dikecualikan.',
  },
  {
    menu: 'Results', feature: 'Error Code — ajukan banding',
    who: ['QC'],
    note: 'Hapus / ubah / tambah error code, melalui hierarki review.',
  },
  {
    menu: 'Results', feature: 'Error Code — edit langsung & Review Banding',
    who: ['Team Leader QC', 'SPQ Head'],
    note: 'Edit langsung berlaku final seketika; diblokir bila masih ada banding QC pending di baris yang sama. Admin sengaja dikecualikan.',
  },
  {
    menu: 'Results', feature: 'Riwayat (history) error code & Manual Status',
    who: ['QC', 'Team Leader QC', 'SPQ Head'],
    note: 'Kolom Riwayat menempel pada kolom aksi, jadi ikut tidak muncul untuk Admin.',
  },
  {
    menu: 'Results', feature: 'Upload dokumen pendukung',
    who: ['Team Leader Sales', 'Admin'],
    note: 'Sisi QC bersifat view-only untuk dokumen.',
  },
  {
    menu: 'Results', feature: 'View dokumen pendukung (KTP / KK / NPWP / buku tabungan)',
    who: ['Semua role'],
    note: 'Yang membatasi bukan role melainkan cakupan tiket: hanya dokumen tiket yang memang terlihat di Results-nya.',
  },
  {
    menu: 'Results', feature: 'Tabel perbandingan OCR dokumen vs TMS/Ascend',
    who: ['QC', 'Team Leader QC', 'SPQ Head'],
    note: 'Terpisah dari "View dokumen": membuka dokumennya satu hal, membaca vonis cocok/tidaknya '
      + 'terhadap data bank adalah pekerjaan QC. Role lain (termasuk Admin, QC Support, dan seluruh '
      + 'sisi sales) tetap melihat dokumennya tanpa tabel itu — backend pun tidak mengirim hasil '
      + 'OCR-nya. Kalau suatu role ternyata memerlukannya, cukup dicentang lewat Manage Role.',
  },
  {
    menu: 'Results · Stats', feature: 'Filter hierarki memakai dropdown QC / QC Support',
    who: ['Team Leader QC'],
    note: 'Team Leader QC mengawasi tim QC, bukan organisasi sales, jadi filternya per petugas QC '
      + '(memilih QC = tiket yang di-assign kepadanya; memilih QC Support = tiket complaint yang '
      + 'di-upload orang itu). Role lain — termasuk SPQ Head & Admin — memakai dropdown sisi sales '
      + '(AM / TL / Agent).',
  },
  {
    menu: 'Stats', feature: 'Tab Failure Reason',
    who: ['SPQ Head', 'Admin'],
    note: '—',
  },
  {
    menu: 'Stats', feature: 'Tabel Hierarki Error Rate QC (kinerja QC)',
    who: ['Team Leader QC', 'SPQ Head', 'Admin'],
    note: 'Termasuk Approve Rate per QC.',
  },
  {
    menu: 'Stats', feature: 'Kolom Risk System & Risk New',
    who: ['SPQ Head', 'Admin', 'Team Leader QC', 'Demo'],
    note: '—',
  },
  {
    menu: 'Stats', feature: 'Kolom Risk Base',
    who: ['Semua kecuali sisi sales'],
    note: 'Disembunyikan untuk Sales Agent, Team Leader Sales, Area Manager, dan Telesales Head.',
  },
  {
    menu: 'Stats', feature: 'Kolom hierarki (Team Leader / Area Manager)',
    who: ['Area Manager', 'Telesales Head'],
    note: 'Area Manager melihat kolom Team Leader; Telesales Head melihat kolom Area Manager.',
  },
]
</script>

<style scoped>
.roles-page { display: flex; flex-direction: column; gap: 20px; max-width: 1000px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px; }
.card-title { font-size: 17px; font-weight: 700; }
.card-subtitle { font-size: 13px; color: var(--text-muted); line-height: 1.5; }

/* Diagram */
.tree { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 0; }
.node {
  padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700;
  border: 1.5px solid transparent; white-space: nowrap; text-align: center;
}
.node.top { font-size: 15px; padding: 10px 22px; }
.top-row { display: flex; gap: 10px; align-items: center; }
.top-caption { font-size: 11px; color: var(--text-muted); font-style: italic; }
.node.standalone { margin-top: 10px; border: 1.5px dashed var(--yellow); }
.node.standalone-demo { margin-top: 18px; border: 1.5px dashed var(--border); }
.standalone-note { font-size: 10.5px; color: var(--text-muted); max-width: 160px; text-align: center; line-height: 1.3; }
.standalone-note.wide { max-width: 420px; }
.branch-labels { display: flex; gap: 80px; margin-top: 6px; }
.branch-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.branches { display: flex; gap: 80px; align-items: flex-start; }
.chain { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.arrow { color: var(--text-muted); font-size: 14px; }

/* Flow */
.flow-block { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border: 1px solid var(--border); border-radius: 12px; background: #fafbfc; }
.flow-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.flow-name { font-size: 14px; font-weight: 700; }
.flow-menu { font-size: 11.5px; color: var(--text-muted); font-style: italic; }
.flow { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.chip { padding: 6px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.flow-arrow { color: var(--text-muted); font-weight: 700; }

/* Table */
.table-wrap { overflow-x: auto; }
.roles-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.roles-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 2px solid var(--border); white-space: nowrap; }
.roles-table td { padding: 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.roles-table tr:last-child td { border-bottom: none; }

.badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.menu-pill { display: inline-block; background: #f1f5f9; color: var(--text); border-radius: 6px; padding: 2px 8px; font-size: 12px; margin: 2px 4px 2px 0; }
.row-note { font-size: 11.5px; color: var(--text-muted); line-height: 1.45; margin-top: 6px; font-style: italic; }
.note { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

/* Feature table */
.feature-table .menu-tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px; background: var(--blue-bg); color: var(--blue); white-space: nowrap; }
.feature-table .feature-name { font-weight: 600; min-width: 190px; }
.feature-table .feature-note { font-size: 12px; color: var(--text-muted); line-height: 1.45; }
</style>
