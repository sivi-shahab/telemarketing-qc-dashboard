<template>
  <div class="msh">
    <div class="msh-head">
      <span class="msh-title">Riwayat Manual Status</span>
      <span v-if="events.length" class="msh-count">{{ events.length }} perubahan</span>
    </div>

    <div v-if="loading" class="msh-loading"><span class="spinner"></span> Memuat riwayat…</div>
    <div v-else-if="errorMsg" class="msh-empty">{{ errorMsg }}</div>
    <div v-else-if="!events.length" class="msh-empty">
      Belum ada perubahan yang tercatat.
    </div>

    <ol v-else class="msh-list">
      <li v-for="e in events" :key="e.id" class="msh-item">
        <span :class="['msh-dot', dotClass(e.event)]"></span>
        <div class="msh-body">
          <div class="msh-line">
            <strong>{{ EVENT_LABEL[e.event] || e.event }}</strong>
            <span class="msh-who">{{ e.actor_username || '—' }}<template v-if="e.actor_role"> · {{ ROLE_LABEL[e.actor_role] || e.actor_role }}</template></span>
            <span class="msh-time">{{ formatDate(e.created_at) }}</span>
          </div>
          <!-- Perpindahan vonis; hanya ditampilkan bila memang berubah. -->
          <div v-if="e.status_before !== e.status_after" class="msh-line msh-transition">
            <span :class="['msh-badge', badgeClass(e.status_before)]">{{ label(e.status_before) }}</span>
            <span class="msh-arrow">→</span>
            <span :class="['msh-badge', badgeClass(e.status_after)]">{{ label(e.status_after) }}</span>
          </div>
          <div v-else-if="e.requested_status" class="msh-line msh-transition">
            <span class="msh-usul">Usulan:</span>
            <span :class="['msh-badge', badgeClass(e.requested_status)]">{{ label(e.requested_status) }}</span>
            <span class="msh-usul">— belum jadi vonis</span>
          </div>
          <div v-if="e.comment" class="msh-comment">“{{ e.comment }}”</div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '../api/client.js'

const props = defineProps({ resultId: { type: String, required: true } })

const EVENT_LABEL = {
  usul: 'QC mengajukan',
  // Vonis pertama yang sama dengan AI Status: final tanpa hierarki.
  konfirmasi: 'QC menyetujui AI Status (tanpa hierarki)',
  set_langsung: 'Ditetapkan langsung',
  tl_approve: 'TL QC menyetujui',
  tl_reject: 'TL QC menolak',
  tl_escalate: 'TL QC meneruskan ke SPQ Head',
  spq_approve: 'SPQ Head menyetujui',
  spq_reject: 'SPQ Head menolak',
}
const ROLE_LABEL = {
  qc: 'QC', team_leader_qc: 'Team Leader QC', spq_head: 'SPQ Head', admin: 'Admin',
}
const STATUS_LABEL = { PASS: 'Qualified', FAIL: 'Not Qualified', PENDING: 'Pending' }
const STATUS_CLASS = { PASS: 'ok', FAIL: 'bad', PENDING: 'wait' }

const events = ref([])
const loading = ref(true)
const errorMsg = ref('')

function label(s) { return STATUS_LABEL[s] || 'Belum ada vonis' }
function badgeClass(s) { return STATUS_CLASS[s] || 'none' }
function dotClass(ev) {
  if (ev === 'tl_reject' || ev === 'spq_reject') return 'dot-bad'
  if (ev === 'tl_approve' || ev === 'spq_approve' || ev === 'set_langsung' || ev === 'konfirmasi') return 'dot-ok'
  return 'dot-neutral'
}
function formatDate(iso) {
  if (!iso) return '—'
  // Backend menyimpan naive UTC; baca sebagai UTC lalu tampilkan dalam WIB.
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

onMounted(async () => {
  try {
    const res = await apiClient.get(`/qc_status_events/${props.resultId}`)
    events.value = res.data?.events || []
  } catch {
    errorMsg.value = 'Gagal memuat riwayat Manual Status.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.msh { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border, #e5e7eb); }
.msh-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.msh-title { font-size: 12px; font-weight: 700; color: var(--text, #111); }
.msh-count { font-size: 11px; color: var(--text-muted, #6b7280); }
.msh-loading, .msh-empty { font-size: 12px; color: var(--text-muted, #6b7280); }
.msh-list { list-style: none; margin: 0; padding: 0; }
.msh-item { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px dashed var(--border, #e5e7eb); }
.msh-item:last-child { border-bottom: none; }
.msh-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: 0 0 8px; }
.dot-ok { background: #16a34a; } .dot-bad { background: #dc2626; } .dot-neutral { background: #9ca3af; }
.msh-body { flex: 1; min-width: 0; }
.msh-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; }
.msh-who { color: var(--text-muted, #6b7280); }
.msh-time { margin-left: auto; font-size: 11px; color: var(--text-muted, #6b7280); white-space: nowrap; }
.msh-transition { margin-top: 3px; }
.msh-arrow { color: var(--text-muted, #6b7280); }
.msh-usul { font-size: 11px; color: var(--text-muted, #6b7280); }
.msh-badge { font-size: 10.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.msh-badge.ok { background: #dcfce7; color: #166534; }
.msh-badge.bad { background: #fee2e2; color: #991b1b; }
.msh-badge.wait { background: #fef3c7; color: #b45309; }
.msh-badge.none { background: #f3f4f6; color: #1E1F21; }
.msh-comment { margin-top: 3px; font-size: 11.5px; color: var(--text-muted, #6b7280); font-style: italic; }
</style>
