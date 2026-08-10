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
          <div class="top-caption">Admin = permission sama persis dengan SPQ Head</div>
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
        </div>
      </div>

      <!-- Alur banding -->
      <div class="card">
        <h2 class="card-title">Alur Aju Banding (berjenjang)</h2>
        <div class="flow">
          <span class="chip badge-yellow">QC · Maker</span>
          <span class="flow-arrow">→</span>
          <span class="chip badge-yellow">Team Leader QC · Checker</span>
          <span class="flow-arrow">→</span>
          <span class="chip badge-red">SPQ Head · Approval</span>
        </div>
        <p class="card-subtitle">
          QC mengajukan banding pada tiket yang di-assign kepadanya. Team Leader QC
          dapat <strong>Terima (final)</strong>, <strong>Tolak (final)</strong>, atau
          <strong>Teruskan ke SPQ Head</strong>. Jika di-approve (oleh TL QC final
          maupun SPQ Head), skor &amp; error card menyesuaikan otomatis.
        </p>
      </div>

      <!-- Tabel akses menu -->
      <div class="card">
        <h2 class="card-title">Akses Menu per Role</h2>
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
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          Catatan: role <strong>Sales</strong> (Area Manager / Team Leader Sales /
          Sales Agent) di-scope dari NIP di Sales Database; <strong>QC</strong>
          di-scope dari ticket yang di-assign Team Leader QC.
        </p>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import SidebarLayout from '../../components/SidebarLayout.vue'

const roles = [
  {
    role: 'spq_head', label: 'SPQ Head', badge: 'badge-red', division: 'Puncak',
    scope: 'Seluruh sistem',
    menus: ['Stats', 'Results', 'Transkrip', 'Assign Ticket', 'Manual Check', 'Pending Check', 'Campaigns', 'Database Sales', 'Database QC', 'Upload (semua)', 'Delete', 'Manage User', 'Hierarki Role & Menu'],
  },
  {
    role: 'admin', label: 'Admin', badge: 'badge-red', division: 'Puncak',
    scope: 'Seluruh sistem (permission = SPQ Head)',
    menus: ['Sama persis dengan SPQ Head'],
  },
  {
    role: 'telesales_head', label: 'Telesales Head', badge: 'badge-red', division: 'Sales (oversight)',
    scope: 'Semua AM → TL Sales → Agent',
    menus: ['Stats (global + Hierarki Error Rate)', 'Results'],
  },
  {
    role: 'area_manager', label: 'Area Manager', badge: 'badge-green', division: 'Sales',
    scope: 'Area: semua TL Sales & agent di bawahnya',
    menus: ['Stats (area + Hierarki)', 'Results'],
  },
  {
    role: 'team_leader', label: 'Team Leader Sales', badge: 'badge-green', division: 'Sales',
    scope: 'Tim: agent di bawahnya',
    menus: ['Stats (roster tim)', 'Results'],
  },
  {
    role: 'sales_agent', label: 'Sales Agent', badge: 'badge-blue', division: 'Sales',
    scope: 'Tiket miliknya sendiri',
    menus: ['Stats (sendiri)', 'Results'],
  },
  {
    role: 'team_leader_qc', label: 'Team Leader QC', badge: 'badge-yellow', division: 'Quality Control',
    scope: 'Semua tiket (checker banding & pembagi ticket)',
    menus: ['Stats', 'Results', 'Transkrip', 'Assign Ticket', 'Manual Check', 'Pending Check', 'Upload Audio', 'Upload Transcript'],
  },
  {
    role: 'qc', label: 'QC', badge: 'badge-yellow', division: 'Quality Control',
    scope: 'Hanya tiket yang di-assign kepadanya',
    menus: ['Stats (assigned)', 'Results (assigned)', 'Transkrip', 'Manual Check', 'Pending Check'],
  },
  {
    role: 'qc_support', label: 'QC Support', badge: 'badge-yellow', division: 'Quality Control (standalone)',
    scope: 'Tiket complaint miliknya sendiri (isolated — role lain tak bisa lihat)',
    menus: ['Results', 'Transkrip', 'Upload Audio', 'Upload Transcript', '(tanpa Statistics)'],
  },
  {
    role: 'demo', label: 'Demo', badge: 'badge-gray', division: 'Showcase (demo ke orang awam)',
    scope: 'Seluruh hasil (global) — untuk demo end-to-end ke orang awam',
    menus: ['Stats', 'Results', 'Campaigns', 'Upload Transcript', 'Detail evaluasi', '(tanpa admin/delete)'],
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
.standalone-note { font-size: 10.5px; color: var(--text-muted); max-width: 160px; text-align: center; line-height: 1.3; }
.branch-labels { display: flex; gap: 80px; margin-top: 6px; }
.branch-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.branches { display: flex; gap: 80px; align-items: flex-start; }
.chain { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.arrow { color: var(--text-muted); font-size: 14px; }

/* Flow */
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
.note { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
</style>
