<template>
  <SidebarLayout title="Database QC">
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
            <td colspan="4" class="empty">Belum ada database QC yang diupload.</td>
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
  </SidebarLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const items = ref([])
const loading = ref(true)

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
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/list_qc_databases')
    items.value = res.data.items || []
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
</style>
