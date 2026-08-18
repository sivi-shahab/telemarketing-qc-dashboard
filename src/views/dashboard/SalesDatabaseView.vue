<template>
  <SidebarLayout title="Database Sales">
    <div v-if="loading" class="skeleton-list">
      <div class="skeleton-row" v-for="i in 3" :key="i"></div>
    </div>

    <div v-else class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Status</th>
            <th>Uploaded</th>
            <th>Uploader</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0">
            <td colspan="4" class="empty">Belum ada database sales yang diupload.</td>
          </tr>
          <tr
            v-for="d in items"
            :key="d.id"
            :class="['data-row', { 'row-active': d.is_active }]"
          >
            <td class="cell-strong">
              <span v-if="d.is_active" class="active-dot" title="Active"></span>
              {{ d.filename }}
            </td>
            <td>
              <span :class="['status-badge', d.is_active ? 'badge-green' : 'badge-gray']">
                {{ d.is_active ? '✓ Active' : 'Inactive' }}
              </span>
            </td>
            <td class="cell-date">{{ formatDate(d.created_at) }}</td>
            <td>
              <span class="uploader-name">{{ d.uploaded_by_username || '—' }}</span>
              <span v-if="d.uploaded_by_role" class="uploader-role">{{ roleLabel(d.uploaded_by_role) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Isi roster berkas aktif. Kolom DEDICATED di sinilah yang menentukan campaign
         tiap orang — dan karenanya tiket siapa yang mereka lihat. Sebelum ini isinya
         hanya bisa diperiksa dengan membuka XLSX-nya. -->
    <div v-if="!loading" class="roster-card">
      <div class="roster-head">
        <div>
          <div class="roster-title">Isi Roster — {{ roster.filename || '—' }}</div>
          <div class="roster-sub">
            {{ roster.total }} baris ·
            <b>{{ withAccount }}</b> punya akun login ·
            <b class="warn">{{ roster.total - withAccount }}</b> belum punya akun
          </div>
        </div>
        <div class="roster-filters">
          <input v-model.trim="rosterSearch" class="text-input" placeholder="Cari NIP / nama / TL / AM…" />
          <select v-model="rosterCampaign" class="text-input">
            <option value="">Semua Campaign</option>
            <option v-for="c in roster.campaigns" :key="c" :value="c">{{ c }}</option>
            <option value="__none__">⚠ Tanpa Dedicated</option>
          </select>
          <select v-model="rosterAccount" class="text-input">
            <option value="">Semua Akun</option>
            <option value="yes">Sudah punya akun</option>
            <option value="no">Belum punya akun</option>
          </select>
        </div>
      </div>

      <div class="roster-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>NIP Baru</th>
              <th>Nama</th>
              <th>Dedicated</th>
              <th>Team Leader</th>
              <th>Area Manager</th>
              <th>Akun</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rosterRows.length">
              <td colspan="6" class="empty">Tidak ada baris yang cocok.</td>
            </tr>
            <tr v-for="(r, i) in rosterRows" :key="(r.nip_baru || r.user_id || '') + i" class="data-row">
              <td class="mono">{{ r.nip_baru || '—' }}</td>
              <td class="cell-strong">{{ r.name || '—' }}</td>
              <td>
                <span v-if="r.dedicated" class="camp-pill">{{ r.dedicated }}</span>
                <span v-else class="warn" title="Tanpa Dedicated: orang ini tidak tercakup filter campaign mana pun">⚠ kosong</span>
              </td>
              <td>
                <span>{{ r.team_leader || '—' }}</span>
                <span v-if="r.nip_tl" class="sub mono">{{ r.nip_tl }}</span>
              </td>
              <td>
                <span>{{ r.area_manager || '—' }}</span>
                <span v-if="r.nip_am" class="sub mono">{{ r.nip_am }}</span>
              </td>
              <td>
                <span :class="['status-badge', r.has_account ? 'badge-green' : 'badge-gray']">
                  {{ r.has_account ? '✓ ada' : 'belum' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="rosterRows.length < roster.total" class="roster-foot">
        Menampilkan {{ rosterRows.length }} dari {{ roster.total }} baris.
      </p>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const items = ref([])
const loading = ref(true)

const roster = ref({ filename: null, total: 0, campaigns: [], rows: [] })
const rosterSearch = ref('')
const rosterCampaign = ref('')   // '' | nama campaign | '__none__'
const rosterAccount = ref('')    // '' | 'yes' | 'no'

const withAccount = computed(() => roster.value.rows.filter((r) => r.has_account).length)

const rosterRows = computed(() => {
  const q = rosterSearch.value.toLowerCase()
  return roster.value.rows.filter((r) => {
    if (rosterCampaign.value === '__none__') {
      if (r.dedicated) return false
    } else if (rosterCampaign.value) {
      if ((r.dedicated || '').toLowerCase() !== rosterCampaign.value.toLowerCase()) return false
    }
    if (rosterAccount.value === 'yes' && !r.has_account) return false
    if (rosterAccount.value === 'no' && r.has_account) return false
    if (!q) return true
    return [r.nip_baru, r.name, r.team_leader, r.area_manager, r.nip_tl, r.nip_am]
      .some((v) => (v || '').toLowerCase().includes(q))
  })
})

function roleLabel(role) {
  const r = (role || '').toLowerCase()
  if (r === 'spq_head') return 'SPQ Head'
  if (r === 'admin') return 'Admin'
  if (r === 'telesales_head') return 'Telesales Head'
  if (r === 'team_leader_qc') return 'Team Leader QC'
  if (r === 'qc_support') return 'QC Support'
  if (r === 'area_manager') return 'Area Manager'
  if (r === 'team_leader') return 'Team Leader Sales'
  if (r === 'sales_agent') return 'Sales Agent'
  if (r === 'qc') return 'QC'
  return r
}

function formatDate(iso) {
  if (!iso) return '—'
  // Backend stores naive UTC; parse as UTC then render in WIB (Asia/Jakarta).
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

onMounted(async () => {
  try {
    const [listRes, rosterRes] = await Promise.all([
      apiClient.get('/list_sales_databases'),
      // Gagal baca roster tidak boleh menjatuhkan daftar berkas di atasnya.
      apiClient.get('/sales_database/roster').catch(() => ({ data: null })),
    ])
    items.value = listRes.data.items || []
    if (rosterRes.data) roster.value = rosterRes.data
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.table-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  background: #f8fafc; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); text-align: left;
}

.data-row td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.row-active td { background: var(--green-bg); }
.data-row:hover td { background: #f8fafc; }
.row-active:hover td { background: #dcfce7; }

.active-dot { display: inline-block; width: 8px; height: 8px; background: var(--green); border-radius: 50%; margin-right: 8px; }
.cell-strong { font-weight: 700; word-break: break-all; }
.cell-date { white-space: nowrap; color: var(--text-muted); font-size: 12px; }

.uploader-name { display: block; font-weight: 600; color: var(--text); }
.uploader-role { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.status-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }

.empty { text-align: center; padding: 40px; color: var(--text-muted); }

.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-row {
  height: 56px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200%; border-radius: 8px; animation: shimmer 1.2s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.roster-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; margin-top: 20px; overflow: hidden; }
.roster-head {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; justify-content: space-between;
  padding: 16px 18px; border-bottom: 1px solid var(--border);
}
.roster-title { font-size: 15px; font-weight: 700; }
.roster-sub { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.roster-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.roster-filters .text-input {
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 12.5px; font-family: inherit; background: #fff;
}
.roster-scroll { max-height: 60vh; overflow: auto; }
.roster-scroll thead th { position: sticky; top: 0; z-index: 1; }
.roster-foot { padding: 10px 18px; font-size: 12px; color: var(--text-muted); }
.camp-pill {
  display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.03em; padding: 2px 8px; border-radius: 999px;
  background: var(--blue-bg); color: var(--blue);
}
.warn { color: var(--red); font-weight: 700; font-size: 12px; }
.mono { font-family: ui-monospace, monospace; font-size: 12.5px; }
.sub { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
</style>
