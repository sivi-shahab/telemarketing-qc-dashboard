<template>
  <SidebarLayout :title="isPendingCheck ? 'Pending Check' : (isBandingReview ? 'Manual Check' : 'Results')">
    <!-- Filters -->
    <div class="filter-bar">
      <select v-model="filterAiStatus" class="select-input" @change="applyFilter">
        <option value="">Semua AI Status</option>
        <option v-for="s in AI_STATUS_VALUES" :key="s" :value="s">{{ aiStatusLabel(s) }}</option>
      </select>
      <select v-model="filterCampaign" class="select-input" @change="applyFilter">
        <option value="">Semua Campaign</option>
        <option v-for="c in campaignOptions" :key="c" :value="c">{{ c }}</option>
      </select>
      <!-- Hierarchy filter -->
      <select v-if="hierOptions.area_managers.length" v-model="filterAm" class="select-input" @change="onAmChange">
        <option value="">Semua AM</option>
        <option v-for="a in hierOptions.area_managers" :key="a.nip" :value="a.nip">{{ a.name }}</option>
      </select>
      <select v-if="hierOptions.team_leaders.length" v-model="filterTl" class="select-input" @change="onTlChange">
        <option value="">Semua TL</option>
        <option v-for="t in visibleTls" :key="t.nip" :value="t.nip">{{ t.name }}</option>
      </select>
      <select v-if="hierOptions.agents.length" v-model="filterAgent" class="select-input" @change="applyFilter">
        <option value="">Semua TLO</option>
        <option v-for="g in visibleAgents" :key="g.nip" :value="g.nip">{{ g.name }}</option>
      </select>
      <!-- Team Leader QC -->
      <select v-if="hierOptions.qc_users.length" v-model="filterQc" class="select-input" @change="applyFilter">
        <option value="">Semua QC</option>
        <option v-for="q in hierOptions.qc_users" :key="q.username" :value="q.username">{{ q.name }}</option>
      </select>
      <select v-if="hierOptions.qc_support_users.length" v-model="filterQcSupport" class="select-input" @change="applyFilter">
        <option value="">Semua QC Support</option>
        <option v-for="s in hierOptions.qc_support_users" :key="s.username" :value="s.username">{{ s.name }}</option>
      </select>
      <input v-model="filterTicketId" class="text-input" placeholder="ID..." @input="debouncedFilter" />
      <div class="date-range">
        <span class="dr-label">Tanggal</span>
        <input type="date" v-model="filterDateStart" class="date-input" @change="applyFilter" />
        <span class="dr-sep">s/d</span>
        <input type="date" v-model="filterDateEnd" class="date-input" @change="applyFilter" />
      </div>
      <button class="btn-clear" @click="clearFilters">Reset</button>
    </div>
    <div v-if="fetchError" class="error-box">{{ fetchError }}</div>
    <div v-if="loading" class="skeleton-list">
      <div class="skeleton-row" v-for="i in 5" :key="i"></div>
    </div>
    <div v-else class="table-card">
      <table class="data-table">
        <colgroup>
          <col style="width: 10%" />
          <col v-if="isSimpleViewer" style="width: 12%" />
          <col v-if="isSimpleViewer" style="width: 11%" />
          <col v-if="isSimpleViewer" style="width: 9%" />
          <col style="width: 6%" />
          <col style="width: 7%" />
          <col style="width: 10%" />
          <col v-if="showCriticalFailure" style="width: 13%" />
          <col v-if="showNonTolerable" style="width: 11%" />
          <col v-if="!isSimpleViewer" style="width: 8%" />
          <col style="width: 8%" />
          <col style="width: 10%" />
          <col v-if="!isSimpleViewer" style="width: 7%" />
          <col v-if="canUploadDocument" style="width: 9%" />
          <col v-if="isQc" style="width: 12%" />
          <col v-if="isSpqHead" style="width: 12%" />
          <col v-if="isSpqHead" style="width: 8%" />
          <col v-if="isTlQc" style="width: 12%" />
          <col v-if="isPendingCheck" style="width: 11%" />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th v-if="isSimpleViewer">Customer Name</th>
            <th v-if="isSimpleViewer">Nomor Kartu</th>
            <th v-if="isSimpleViewer">Limit Sebelumnya</th>
            <th class="num">Number of Calls</th>
            <th>Call Duration</th>
            <th>Campaign Interest</th>
            <th v-if="showCriticalFailure">Critical Failure(s)</th>
            <th v-if="showNonTolerable">Non-Tolerable</th>
            <th v-if="!isSimpleViewer" class="num">Passing Grade</th>
            <th>AI Status</th>
            <th>Manual Status</th>
            <th v-if="!isSimpleViewer">Export</th>
            <th v-if="canUploadDocument">Upload Document</th>
            <th v-if="isQc">Manual Check</th>
            <th v-if="isSpqHead">Manual Check</th>
            <th v-if="isSpqHead">Delete Record</th>
            <th v-if="isTlQc">Manual Check</th>
            <th v-if="isPendingCheck">Sisa Waktu (H+2)</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="pagedGroups.length === 0">
            <tr><td :colspan="colCount" class="empty">Tidak ada data.</td></tr>
          </template>

          <template v-for="group in pagedGroups" :key="group.id">
            <tr class="data-row" :class="{ expanded: expandedGroupId === group.id }" @click="toggleGroup(group)">
              <td class="cell-strong">
                <span class="expand-icon">{{ expandedGroupId === group.id ? '▼' : '▶' }}</span>
                {{ group.id || '—' }}
                <span v-if="group.results.length > 1" class="count-badge" :title="`${group.results.length} result untuk ID ini`">
                  ×{{ group.results.length }}
                </span>
              </td>
              <td v-if="isSimpleViewer" class="cell-strong">{{ group.primary.customer_name || '—' }}</td>
              <td v-if="isSimpleViewer">{{ group.primary.account_number || 'NTB' }}</td>
              <td v-if="isSimpleViewer">{{ formatLimit(group.primary) }}</td>
              <td class="num">{{ group.primary.num_calls ?? '—' }}</td>
              <td class="cell-date">{{ group.primary.audio_duration || '—' }}</td>
              <td>
                <ul v-if="group.primary.campaign_interest && group.primary.campaign_interest.length" class="campaign-interest-list">
                  <li v-for="(c, i) in group.primary.campaign_interest" :key="i">{{ c }}</li>
                </ul>
                <span v-else>—</span>
              </td>
              <td v-if="showCriticalFailure" class="cell-ccc">
                <ul v-if="cccItems(group.primary).length" class="ccc-list">
                  <li v-for="(it, i) in cccItems(group.primary)" :key="i" class="ccc-item">
                    <span :class="['ccc-dot', it.status === 'PASS' ? 'dot-green' : 'dot-red']"></span>
                    <span class="ccc-req">{{ cccRequirement(it) }}</span>
                  </li>
                </ul>
                <span v-else>—</span>
              </td>
              <td v-if="showNonTolerable" class="cell-ccc">
                <ul v-if="nonTolerableItems(group.primary).length" class="ccc-list">
                  <li v-for="(r, i) in nonTolerableItems(group.primary)" :key="i" class="ccc-item">
                    <span class="ccc-dot dot-red"></span>
                    <span class="ccc-req">{{ r }}</span>
                  </li>
                </ul>
                <span v-else>—</span>
              </td>
              <td v-if="!isSimpleViewer" class="num">{{ passingGradeDisplay(group.primary) }}</td>
              <td>
                <span v-if="group.primary.ai_status" :class="['status-badge', aiStatusBadgeClass(group.primary.ai_status)]">
                  {{ aiStatusLabel(group.primary.ai_status) }}
                </span>
                <span v-else>—</span>
              </td>
              <td class="cell-mstatus" @click.stop>
                <span v-if="group.primary.manual_status" :class="['mstatus-badge', mStatusClass(group.primary.manual_status)]" :title="mStatusTitle(group.primary)">{{ mStatusLabel(group.primary.manual_status) }}</span>
                <span v-else class="mstatus-dash">—</span>
                <button v-if="manualStatusAction(group.primary)" class="btn-mstatus" @click="onManualStatusAction(group.primary)">{{ manualStatusAction(group.primary) }}</button>
              </td>
              <td v-if="!isSimpleViewer" class="cell-export" @click.stop>
                <button
                  v-if="group.primary.status === 'done'"
                  class="btn-export-row"
                  :disabled="exportingId === group.primary.result_id"
                  @click="exportRow(group.primary)"
                >
                  {{ exportingId === group.primary.result_id ? '…' : 'XLSX' }}
                </button>
                <span v-else>—</span>
              </td>
              <td v-if="canUploadDocument" class="cell-doc" @click.stop>
                <template v-if="group.primary.has_documents">
                  <span class="doc-uploaded">✓ Uploaded</span>
                  <span v-if="group.primary.document_uploaded_at" class="doc-time">{{ formatDate(group.primary.document_uploaded_at) }}</span>
                </template>
                <button
                  v-else
                  class="btn-doc-row"
                  :disabled="!(group.primary.document_triggers && group.primary.document_triggers.length)"
                  :title="group.primary.document_triggers && group.primary.document_triggers.length
                    ? 'Aktif karena: ' + group.primary.document_triggers.join(', ')
                    : 'Aktif hanya jika ada perubahan data di TMS: Alamat Kantor, Alamat Rumah, NPWP, atau NIK'"
                  @click="openDocModal(group.primary)"
                >
                  <span>Upload</span>
                  <span>Document</span>
                </button>
              </td>
              <td v-if="isQc" class="cell-banding" :title="appealTooltip(group.primary)">
                <template v-if="group.primary.appeal_summary">
                  <span v-if="group.primary.appeal_summary.approved" class="banding-badge badge-green">✓ {{ group.primary.appeal_summary.approved }}</span>
                  <span v-if="group.primary.appeal_summary.rejected" class="banding-badge badge-red">✗ {{ group.primary.appeal_summary.rejected }}</span>
                  <span v-if="group.primary.appeal_summary.pending" class="banding-badge badge-wait">⏳ {{ group.primary.appeal_summary.pending }}</span>
                </template>
                <span v-else>—</span>
              </td>
              <td v-if="isSpqHead" class="cell-banding" :title="groupAppealTooltip(group)">
                <template v-if="group.appeal">
                  <span v-if="group.appeal.pending" class="banding-badge badge-wait">⏳ {{ group.appeal.pending }} menunggu</span>
                  <span v-else class="banding-badge badge-gray">Selesai</span>
                </template>
                <span v-else>—</span>
              </td>
              <td v-if="isSpqHead" class="cell-delete" @click.stop>
                <button class="btn-delete-row" @click="openDeleteModal(group.primary)">Delete</button>
              </td>
              <td v-if="isTlQc" class="cell-banding" :title="appealTooltip(group.primary)">
                <template v-if="group.primary.appeal_summary">
                  <span v-if="group.primary.appeal_summary.tl_pending" class="banding-badge badge-wait">⏳ {{ group.primary.appeal_summary.tl_pending }} perlu dicek</span>
                  <span v-else-if="group.primary.appeal_summary.spq_pending" class="banding-badge badge-gray">diteruskan ke SPQ</span>
                  <span v-else class="banding-badge badge-gray">—</span>
                </template>
                <span v-else>—</span>
              </td>
              <td v-if="isPendingCheck" class="cell-timer" @click.stop>
                <span v-if="slaInfo(group.primary)" :class="['sla-badge', slaInfo(group.primary).cls]" :title="slaInfo(group.primary).title">
                  {{ slaInfo(group.primary).text }}
                </span>
                <span v-else>—</span>
              </td>
            </tr>

            <tr v-if="expandedGroupId === group.id" class="expand-row">
              <td :colspan="colCount">
                <div class="expand-content">
                  <template v-if="showAgentSummary">
                    <div v-if="loadingAgent[group.primary.result_id]" class="result-loading">
                      <span class="spinner"></span> Memuat agent summary...
                    </div>
                    <AgentErrorTable
                      v-else-if="agentSummary[group.primary.result_id]"
                      :summary="agentSummary[group.primary.result_id]"
                    />
                    <div
                      v-if="isSimpleViewer && group.primary.qc_request?.approval_status === 'approved'"
                      class="qc-approval-note"
                    >
                      <div class="qan-title">📝 Catatan QC (Disetujui SPQ Head)</div>
                      <p class="qan-reason">{{ group.primary.qc_request.reason || '—' }}</p>
                      <div class="qan-meta">
                        Status:
                        <span :class="['status-badge', group.primary.qc_request.requested_status === 'PASS' ? 'badge-green' : 'badge-red']">
                          {{ aiStatusLabel(group.primary.qc_request.requested_status) }}
                        </span>
                        <span v-if="group.primary.qc_request.reviewed_by_username" class="qan-reviewer">
                          · Disetujui oleh {{ group.primary.qc_request.reviewed_by_username }}
                          <template v-if="group.primary.qc_request.reviewed_at"> · {{ formatDate(group.primary.qc_request.reviewed_at) }}</template>
                        </span>
                      </div>
                    </div>
                  </template>
                  <div v-if="showEvaluationDetail && loadingResult[group.primary.result_id]" class="result-loading">
                    <span class="spinner"></span> Memuat hasil...
                  </div>
                  <div v-else-if="showEvaluationDetail && results[group.primary.result_id]?.status === 'done' && results[group.primary.result_id]?.result">
                    <EvaluationView
                      :result="results[group.primary.result_id].result"
                      :hide-error-code="true"
                      :result-id="group.primary.result_id"
                      :display-id="group.id"
                      @appeal-changed="reloadResult"
                    >
                      <template #after-exec-summary>
                        <DocumentsSection
                          v-if="group.primary.has_documents"
                          :result-id="group.primary.result_id"
                          :evaluation="results[group.primary.result_id]?.result?.evaluation || null"
                        />
                      </template>
                    </EvaluationView>
                  </div>
                  <div v-else-if="showEvaluationDetail && results[group.primary.result_id]?.status === 'failed'" class="result-failed">
                    ✗ Gagal: {{ results[group.primary.result_id]?.error || 'Unknown error' }}
                  </div>
                  <div v-else-if="showEvaluationDetail && results[group.primary.result_id]" class="result-pending">
                    <span class="spinner"></span>
                    Status: <strong>{{ results[group.primary.result_id]?.status }}</strong> — hasil belum tersedia.
                  </div>

                  <DocumentsSection
                    v-if="showEvaluationDetail && group.primary.has_documents && !(results[group.primary.result_id]?.status === 'done' && results[group.primary.result_id]?.result)"
                    :result-id="group.primary.result_id"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div class="pagination">
        <span class="total-info">Total: {{ totalGroups }} ID ({{ totalResults }} result)</span>
        <div class="page-controls">
          <button :disabled="page === 1" @click="goPage(page - 1)" class="page-btn">‹</button>
          <span class="page-info">Hal {{ page }} / {{ totalPages }}</span>
          <button :disabled="page >= totalPages" @click="goPage(page + 1)" class="page-btn">›</button>
        </div>
      </div>
    </div>
    <UploadDocumentModal
      v-if="docModalResultId"
      :result-id="docModalResultId"
      :doc-id="docModalId"
      :allowed-types="docModalTypes"
      @close="closeDocModal"
      @uploaded="onDocUploaded"
    />
    <ManualCheckModal
      v-if="manualCheckItem"
      :result-id="manualCheckItem.result_id"
      :display-id="manualCheckItem.id"
      :existing="manualCheckItem.qc_request"
      @close="manualCheckItem = null"
      @submitted="onQcRequestChanged"
    />
    <QcApprovalModal
      v-if="approvalItem"
      :result-id="approvalItem.result_id"
      :display-id="approvalItem.id"
      :request="approvalItem.qc_request"
      :current-ai-status="approvalItem.ai_status"
      :stage="approvalItem._stage || 'spq'"
      @close="approvalItem = null"
      @reviewed="onQcRequestChanged"
    />

    <Teleport to="body">
      <div v-if="deleteItem" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="del-modal-card" role="dialog" aria-modal="true">
          <header class="del-modal-head">
            <h2 class="del-modal-title">Hapus Record</h2>
            <button class="del-close-x" @click="closeDeleteModal">✕</button>
          </header>
          <div v-if="deleteStep === 1" class="del-modal-body">
            <p>Anda akan menghapus <strong>SEMUA entry</strong> untuk ticket <strong>{{ deleteItem.id }}</strong>.</p>
            <p class="del-warn">⚠️ Tindakan ini permanen dan tidak dapat dibatalkan.</p>
          </div>
          <div v-else class="del-modal-body">
            <p>Konfirmasi sekali lagi. Ketik ticket id <strong>{{ deleteItem.id }}</strong> untuk menghapus semua entry-nya.</p>
            <input v-model="deleteConfirmText" class="del-input" placeholder="Ketik ticket id..." @keyup.enter="confirmDelete" />
            <p v-if="deleteError" class="del-error">{{ deleteError }}</p>
          </div>
          <footer class="del-modal-foot">
            <button class="del-btn-cancel" :disabled="deleting" @click="closeDeleteModal">Batal</button>
            <button v-if="deleteStep === 1" class="del-btn-next" @click="deleteStep = 2">Lanjut</button>
            <button v-else class="del-btn-confirm" :disabled="deleting || deleteConfirmText.trim() !== deleteItem.id" @click="confirmDelete">
              <span v-if="deleting" class="spinner"></span>
              {{ deleting ? 'Menghapus...' : 'Hapus Permanen' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import EvaluationView from '../../components/EvaluationView.vue'
import UploadDocumentModal from '../../components/UploadDocumentModal.vue'
import ManualCheckModal from '../../components/ManualCheckModal.vue'
import QcApprovalModal from '../../components/QcApprovalModal.vue'
import DocumentsSection from '../../components/DocumentsSection.vue'
import AgentErrorTable from '../../components/AgentErrorTable.vue'
import ResultDetail from '../../components/ResultDetail.vue'
import apiClient from '../../api/client.js'
import { useAuthStore } from '../../stores/auth.js'
import { aiStatusLabel, AI_STATUS_VALUES } from '../../utils/aiStatus.js'

const GROUPING_MODE = import.meta.env.VITE_RESULTS_GROUPING === 'server' ? 'server' : 'client'
const LIMIT = 20
const GROUP_LIMIT = 20
const FETCH_LIMIT = 100
const MAX_FETCH_PAGES = 200

const rawItems = ref([])
const serverGroups = ref([])
const serverTotalGroups = ref(0)
const serverTotalResults = ref(0)

const route = useRoute()
const isBandingReview = route.meta?.bandingReview === true
const isPendingCheck = route.meta?.pendingCheck === true

const page = ref(1)
const loading = ref(true)
const fetchError = ref(null)

const filterAiStatus = ref('')
const filterCampaign = ref('')
const filterTicketId = ref('')
const filterDateStart = ref('')
const filterDateEnd = ref('')
const filterAm = ref('')
const filterTl = ref('')
const filterAgent = ref('')
const filterQc = ref('')
const filterQcSupport = ref('')
const hierOptions = ref({ area_managers: [], team_leaders: [], agents: [], qc_users: [], qc_support_users: [] })

const visibleTls = computed(() => (filterAm.value
  ? hierOptions.value.team_leaders.filter((t) => t.nip_am === filterAm.value)
  : hierOptions.value.team_leaders))
const visibleAgents = computed(() => {
  let list = hierOptions.value.agents
  if (filterAm.value) list = list.filter((g) => g.nip_am === filterAm.value)
  if (filterTl.value) list = list.filter((g) => g.nip_tl === filterTl.value)
  return list
})

function onAmChange() {
  filterTl.value = ''
  filterAgent.value = ''
  applyFilter()
}
function onTlChange() {
  filterAgent.value = ''
  applyFilter()
}

async function loadHierarchyOptions() {
  try {
    const res = await apiClient.get('/results/hierarchy_options')
    hierOptions.value = {
      area_managers: res.data?.area_managers || [],
      team_leaders: res.data?.team_leaders || [],
      agents: res.data?.agents || [],
      qc_users: res.data?.qc_users || [],
      qc_support_users: res.data?.qc_support_users || [],
    }
  } catch {
    hierOptions.value = { area_managers: [], team_leaders: [], agents: [], qc_users: [], qc_support_users: [] }
  }
}

const campaignOptions = ref([])

const expandedGroupId = ref(null)
const expandedResultId = ref(null)

const results = ref({})
const loadingResult = ref({})

const auth = useAuthStore()
const showAgentSummary = true
const SIMPLE_VIEWER_ROLES = ['sales_agent', 'team_leader', 'area_manager', 'telesales_head']
const isSimpleViewer = computed(() => SIMPLE_VIEWER_ROLES.includes(auth.user?.role))
const EVALUATION_DETAIL_ROLES = ['qc', 'team_leader_qc', 'qc_support', 'spq_head', 'admin', 'demo']
const showEvaluationDetail = computed(() => EVALUATION_DETAIL_ROLES.includes(auth.user?.role))
const DOCUMENT_UPLOADER_ROLES = ['team_leader', 'admin']
const canUploadDocument = computed(() => DOCUMENT_UPLOADER_ROLES.includes(auth.user?.role))
const isQc = computed(() => auth.user?.role === 'qc')
const isSpqHead = computed(() => auth.user?.role === 'spq_head')
const isTlQc = computed(() => auth.user?.role === 'team_leader_qc')
const CF_HIDDEN_ROLES = ['sales_agent', 'team_leader', 'area_manager', 'telesales_head']
const showCriticalFailure = computed(() => !CF_HIDDEN_ROLES.includes(auth.user?.role))

const showNonTolerable = false

const colCount = computed(() => {
  let n = 6
  if (isSimpleViewer.value) n += 3
  if (showCriticalFailure.value) n += 1
  if (showNonTolerable) n += 1
  if (!isSimpleViewer.value) n += 2
  if (canUploadDocument.value) n += 1
  if (isQc.value) n += 1
  if (isSpqHead.value) n += 2
  if (isTlQc.value) n += 1
  if (isPendingCheck) n += 1
  return n
})

function groupFlat(arr) {
  const map = new Map()
  arr.forEach(it => {
    if (!map.has(it.id)) map.set(it.id, { id: it.id, results: [], primary: it, appeal: it.appeal_summary || null })
    map.get(it.id).results.push(it)
  })
  return Array.from(map.values())
}

const pagedGroups = computed(() => {
  if (GROUPING_MODE === 'server') return serverGroups.value
  const start = (page.value - 1) * LIMIT
  return groupFlat(rawItems.value).slice(start, start + LIMIT)
})

const totalGroups = computed(() => GROUPING_MODE === 'server' ? serverTotalGroups.value : groupFlat(rawItems.value).length)
const totalResults = computed(() => GROUPING_MODE === 'server' ? serverTotalResults.value : rawItems.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalGroups.value / LIMIT)))

function appealTooltip(item) {
  const s = item.appeal_summary
  if (!s || !s.history?.length) return ''
  const label = { pending: 'Menunggu Approval', approved: 'Approved', rejected: 'Rejected' }
  return s.history
    .map((h) => {
      const who = h.reviewed_by_username ? ` — ${label[h.approval_status] || h.approval_status} oleh ${h.reviewed_by_username}` : ` — ${label[h.approval_status] || h.approval_status}`
      return `${h.error_code}/${h.item_code}${who}`
    })
    .join('\n')
}

const agentSummary = ref({})
const loadingAgent = ref({})
const exportingId = ref(null)

const deleteItem = ref(null)
const deleteStep = ref(1)
const deleteConfirmText = ref('')
const deleting = ref(false)
const deleteError = ref('')

function openDeleteModal(item) {
  deleteItem.value = item
  deleteStep.value = 1
  deleteConfirmText.value = ''
  deleteError.value = ''
}
function closeDeleteModal() {
  if (deleting.value) return
  deleteItem.value = null
  deleteStep.value = 1
  deleteConfirmText.value = ''
  deleteError.value = ''
}
async function confirmDelete() {
  if (!deleteItem.value) return
  const ticketId = deleteItem.value.id
  if (deleteConfirmText.value.trim() !== ticketId) {
    deleteError.value = 'Ketikan ticket id tidak cocok.'
    return
  }
  deleting.value = true
  deleteError.value = ''
  try {
    await apiClient.delete('/delete_ticket', { params: { ticket_id: ticketId } })
    deleting.value = false
    deleteItem.value = null
    deleteStep.value = 1
    deleteConfirmText.value = ''
    if (pagedGroups.value.length <= 1 && page.value > 1) page.value -= 1
    await fetchItems()
  } catch (e) {
    deleting.value = false
    if (e.response?.status === 403) deleteError.value = 'Hanya SPQ Head yang dapat menghapus record.'
    else if (e.response?.status === 404) deleteError.value = 'Ticket tidak ditemukan (mungkin sudah terhapus).'
    else deleteError.value = 'Gagal menghapus record. Coba lagi.'
  }
}

const docModalResultId = ref(null)
const docModalId = ref(null)
const docModalTypes = ref([])
const manualCheckItem = ref(null)
const approvalItem = ref(null)

let debounceTimer = null

function formatDate(iso) {
  if (!iso) return '—'
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

const SLA_HOURS = 48
const nowTs = ref(Date.now())
let slaTimer = null

function slaInfo(item) {
  const iso = item.generated_at
  if (!iso) return null
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  const gen = new Date(s).getTime()
  if (!Number.isFinite(gen)) return null
  const deadline = gen + SLA_HOURS * 3600 * 1000
  const remaining = deadline - nowTs.value
  const deadlineStr = new Date(deadline).toLocaleString('id-ID', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
  const title = `Deadline H+2: ${deadlineStr}`
  const abs = Math.abs(remaining)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor((abs % 86400000) / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const parts = []
  if (d) parts.push(`${d}h`)
  if (h || d) parts.push(`${h}j`)
  parts.push(`${m}m`)
  const dur = parts.join(' ')
  if (remaining <= 0) return { text: `Terlambat ${dur}`, cls: 'over', title }
  const cls = remaining <= 12 * 3600 * 1000 ? 'warn' : 'ok'
  return { text: `${dur} lagi`, cls, title }
}

function passingGradeDisplay(item) {
  const pg = item?.passing_grade
  const max = item?.maximum_score
  if (pg == null || max == null || max === 0) return '—'
  const pct = Math.round((pg / max) * 100)
  return `${pct}%`
}

function formatLimit(item) {
  if (!item.account_number) return '—'
  const raw = item.credit_limit
  if (!raw) return '—'
  const n = Number(String(raw).replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? `Rp ${n.toLocaleString('id-ID')}` : (raw || '—')
}

function cccItems(item) {
  const ccc = item?.critical_compliance_check
  if (!ccc || !Array.isArray(ccc.checked_items)) return []
  return ccc.checked_items.filter((it) => it.status !== 'PASS')
}

function nonTolerableItems(item) {
  return item?.non_tolerable_items || []
}

function cccRequirement(it) {
  const req = it.requirement || it.item_code || '—'
  if (it.status === 'PASS' || req === '—') return req
  const m = req.match(/^(\s*Agent\s+)(.*)$/i)
  return m ? `${m[1]}tidak ${m[2]}` : `Tidak: ${req}`
}

function aiStatusBadgeClass(status) {
  if (status === 'PASS') return 'badge-green'
  if (status === 'FAILED') return 'badge-red'
  return 'badge-gray'
}

function groupAppealTooltip(group) {
  const h = group.appeal?.history
  if (!h?.length) return ''
  const label = { pending: 'Menunggu Approval', approved: 'Approved', rejected: 'Rejected' }
  return h
    .map((x) => {
      const st = label[x.approval_status] || x.approval_status
      const who = x.reviewed_by_username ? `${st} oleh ${x.reviewed_by_username}` : st
      return `${x.error_code}/${x.item_code} — ${who}`
    })
    .join('\n')
}

function buildParams() {
  const p = {}
  if (filterAiStatus.value) p.ai_status = filterAiStatus.value
  if (filterCampaign.value) p.campaign = filterCampaign.value
  if (filterTicketId.value) p.ticket_id = filterTicketId.value.trim()
  if (filterAm.value) p.am_nip = filterAm.value
  if (filterTl.value) p.tl_nip = filterTl.value
  if (filterAgent.value) p.agent_nip = filterAgent.value
  if (filterQc.value) p.qc_username = filterQc.value
  if (filterQcSupport.value) p.qc_support_username = filterQcSupport.value
  if (filterDateStart.value) p.date_start = filterDateStart.value
  if (filterDateEnd.value) p.date_end = filterDateEnd.value
  if (isBandingReview) p.banding_pending = true
  if (isPendingCheck) p.manual_status_pending = true
  return p
}

async function fetchItems({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    if (GROUPING_MODE === 'server') {
      const res = await apiClient.get('/list_results', {
        params: { ...buildParams(), page: page.value, limit: GROUP_LIMIT, group_by: 'id' },
      })
      const itemsData = res.data.items || []
      serverGroups.value = groupFlat(itemsData)
      serverTotalGroups.value = res.data.total || 0
      serverTotalResults.value = res.data.total_results ?? itemsData.length
    } else {
      const collected = []
      let p = 1
      while (p <= MAX_FETCH_PAGES) {
        const res = await apiClient.get('/list_results', {
          params: { ...buildParams(), page: p, limit: FETCH_LIMIT },
        })
        const itemsData = res.data.items || []
        collected.push(...itemsData)
        if (collected.length >= (res.data.total || 0) || itemsData.length === 0) break
        p += 1
      }
      rawItems.value = collected
    }
    fetchError.value = null
  } catch (e) {
    console.error('Gagal memuat results:', e)
    fetchError.value = e?.message || 'Gagal memuat data. Coba refresh halaman.'
  } finally {
    if (!silent) loading.value = false
  }
  if (hasInProgress()) startPolling()
  else stopPolling()
}

async function fetchCampaigns() {
  try {
    const res = await apiClient.get('/list_campaigns')
    campaignOptions.value = (res.data.campaigns || []).filter((c) => c.is_active).map((c) => c.name)
  } catch {
    campaignOptions.value = []
  }
}

async function fetchResult(id) {
  if (!id || results.value[id]) return
  loadingResult.value[id] = true
  try {
    const res = await apiClient.get(`/result/${id}`)
    results.value[id] = res.data
  } catch {
    results.value[id] = { status: 'failed', error: 'Gagal memuat data' }
  } finally {
    loadingResult.value[id] = false
  }
}

async function fetchAgentSummary(id) {
  if (!id || agentSummary.value[id]) return
  loadingAgent.value[id] = true
  try {
    const res = await apiClient.get(`/agent_error_summary/${id}`)
    agentSummary.value[id] = res.data
  } catch {
    agentSummary.value[id] = null
  } finally {
    loadingAgent.value[id] = false
  }
}

const POLL_INTERVAL_MS = GROUPING_MODE === 'server' ? 7000 : 15000
let pollTimer = null

function hasInProgress() {
  const inProgress = (r) => r.status === 'pending' || r.status === 'processing'
  if (GROUPING_MODE === 'server') return serverGroups.value.some((g) => g.results.some(inProgress))
  return rawItems.value.some(inProgress)
}

async function refreshExpandedIfPending() {
  const id = expandedResultId.value
  if (!id || !showEvaluationDetail.value) return
  const st = results.value[id]?.status
  if (st === 'done' || st === 'failed') return
  delete results.value[id]
  await fetchResult(id)
}

async function pollTick() {
  if (document.visibilityState === 'hidden') return
  await fetchItems({ silent: true })
  await refreshExpandedIfPending()
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(pollTick, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && hasInProgress()) pollTick()
}

function applyFilter() {
  page.value = 1
  collapseAll()
  fetchItems()
}

function debouncedFilter() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(applyFilter, 400)
}

function clearFilters() {
  filterAiStatus.value = ''
  filterCampaign.value = ''
  filterTicketId.value = ''
  filterAm.value = ''
  filterTl.value = ''
  filterAgent.value = ''
  filterQc.value = ''
  filterQcSupport.value = ''
  filterDateStart.value = ''
  filterDateEnd.value = ''
  applyFilter()
}

function collapseAll() {
  expandedGroupId.value = null
  expandedResultId.value = null
}

function goPage(p) {
  page.value = p
  collapseAll()
  if (GROUPING_MODE === 'server') fetchItems()
}

async function toggleGroup(group) {
  if (expandedGroupId.value === group.id) {
    collapseAll()
    return
  }
  expandedGroupId.value = group.id
  expandedResultId.value = group.primary.result_id
  fetchAgentSummary(group.primary.result_id)
  if (showEvaluationDetail.value) await fetchResult(group.primary.result_id)
}

function reloadResult() {
  if (expandedResultId.value) {
    delete results.value[expandedResultId.value]
    fetchResult(expandedResultId.value)
  }
}

async function exportRow(item) {
  if (exportingId.value) return
  exportingId.value = item.result_id
  try {
    const res = await apiClient.get(`/export_result_xlsx/${item.result_id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(
      new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    const disposition = res.headers['content-disposition'] || ''
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
    const filename = match ? decodeURIComponent(match[1]) : `${item.id || item.result_id}.xlsx`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    alert('Gagal export XLSX.')
  } finally {
    exportingId.value = null
  }
}

function openDocModal(item) {
  docModalResultId.value = item.result_id
  docModalId.value = item.id || null
  docModalTypes.value = item.document_upload_types || []
}

function closeDocModal() {
  docModalResultId.value = null
  docModalId.value = null
  docModalTypes.value = []
}

function onDocUploaded(payload) {
  const list = GROUPING_MODE === 'server' ? serverGroups.value.flatMap((g) => g.results) : rawItems.value
  const target = list.find((it) => it.result_id === payload.resultId)
  if (target) target.has_documents = true
}

const MSTATUS_LABEL = { approve: 'Approve', reject: 'Reject', ditolak: 'Usulan Ditolak', pending: 'Pending' }
const MSTATUS_CLASS = { approve: 'badge-green', reject: 'badge-red', ditolak: 'badge-gray', pending: 'badge-wait' }

function mStatusLabel(s) { return MSTATUS_LABEL[s] || s }
function mStatusClass(s) { return MSTATUS_CLASS[s] || 'badge-gray' }
function mStatusTitle(item) {
  const s = item.manual_status
  const req = item.qc_request
  if (s === 'ditolak') {
    const c = req?.review_comment || req?.tl_qc_comment
    return c ? `Ditolak: ${c}` : 'Usulan ditolak oleh reviewer'
  }
  if (s === 'pending') return req ? 'Menunggu review hierarki' : 'Kekurangan dokumen — menunggu pemeriksaan QC'
  if ((s === 'approve' || s === 'reject') && req?.reviewed_by_username) return `Oleh ${req.reviewed_by_username}`
  return ''
}

function manualStatusAction(item) {
  if (item.status !== 'done') return null
  if (isQc.value) return item.qc_request ? 'Ubah' : 'Set'
  const req = item.qc_request
  if (!req) return null
  if (isTlQc.value && (req.tl_qc_status || 'pending') === 'pending') return 'Review'
  if (isSpqHead.value && req.tl_qc_status === 'escalated' && req.approval_status === 'pending') return 'Review'
  return null
}

function onManualStatusAction(item) {
  if (isQc.value) { manualCheckItem.value = item; return }
  if (isTlQc.value) { approvalItem.value = { ...item, _stage: 'tl' }; return }
  if (isSpqHead.value) { approvalItem.value = { ...item, _stage: 'spq' }; return }
}

function onQcRequestChanged() {
  manualCheckItem.value = null
  approvalItem.value = null
  fetchItems({ silent: true })
}

onMounted(() => {
  fetchItems()
  fetchCampaigns()
  loadHierarchyOptions()
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (isPendingCheck) slaTimer = setInterval(() => { nowTs.value = Date.now() }, 30000)
})

onBeforeUnmount(() => {
  stopPolling()
  if (slaTimer) clearInterval(slaTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
.filter-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.select-input, .text-input, .date-input {
  padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13px; color: var(--text); outline: none; background: #fff; transition: border-color 0.2s;
}
.select-input:focus, .text-input:focus, .date-input:focus { border-color: var(--blue); }
.text-input { min-width: 160px; }
.date-range { display: inline-flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.dr-label { font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.dr-sep { font-size: 13px; color: var(--text-muted); }
.btn-clear {
  padding: 8px 16px; background: #f1f5f9; border: 1.5px solid var(--border);
  border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-muted); transition: all 0.15s;
}
.btn-clear:hover { background: #e2e8f0; color: var(--text); }
.btn-export-row {
  padding: 5px 8px; background: var(--green-bg); border: 1.5px solid #16a34a;
  border-radius: 8px; font-size: 12px; font-weight: 700; color: #16a34a; transition: all 0.15s; white-space: nowrap;
}
.btn-export-row:hover:not(:disabled) { background: #16a34a; color: #fff; }
.btn-export-row:disabled { opacity: 0.5; cursor: not-allowed; }
.cell-export { text-align: left; }
.btn-doc-row {
  display: flex; flex-direction: column; align-items: center; line-height: 1.15;
  padding: 5px 10px; background: var(--blue-bg); border: 1.5px solid var(--blue);
  border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--blue);
  transition: all 0.15s; white-space: nowrap;
}
.btn-doc-row:hover:not(:disabled) { background: var(--blue); color: #fff; }
.btn-doc-row:disabled { opacity: 0.5; cursor: not-allowed; }
.cell-doc { text-align: left; }
.doc-uploaded { display: block; font-size: 12px; font-weight: 700; color: #16a34a; white-space: nowrap; }
.doc-time { display: block; font-size: 11px; color: var(--text-muted); white-space: nowrap; margin-top: 2px; }
.approval-approved { color: #16a34a; font-weight: 700; }
.approval-rejected { color: var(--red); font-weight: 700; }
.approval-pending { color: var(--yellow); font-weight: 700; }
.approval-label { white-space: normal; line-height: 1.25; word-break: break-word; text-align: left; }
.table-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.data-table th {
  background: #f8fafc; padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); text-align: left;
  word-break: break-word;
}
.data-row { cursor: pointer; }
.data-row td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; word-break: break-word; }
.data-row:hover td { background: #f8fafc; }
.data-row.expanded td { background: var(--blue-bg); }
.count-badge {
  display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
  background: var(--blue-bg); color: var(--blue); font-size: 10px; font-weight: 700; vertical-align: middle;
}
.campaign-interest-list { margin: 0; padding-left: 16px; list-style: disc; }
.campaign-interest-list li { white-space: normal; word-break: break-word; }
.ccc-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.ccc-item { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; line-height: 1.35; }
.ccc-dot { flex-shrink: 0; width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; }
.dot-green { background: #16a34a; }
.dot-red { background: var(--red); }
.ccc-req { flex: 1; word-break: break-word; color: var(--text); }
.expand-icon { margin-right: 4px; color: var(--text-muted); font-size: 10px; }
.cell-strong { font-weight: 700; word-break: break-all; }
.cell-date { color: var(--text-muted); font-size: 12px; }
.num { text-align: left; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: capitalize; white-space: nowrap; }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.cell-mstatus { white-space: nowrap; }
.mstatus-badge {
  display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px;
  border-radius: 999px; white-space: nowrap;
}
.mstatus-badge.badge-wait { background: #fef3c7; color: #b45309; }
.mstatus-dash { color: var(--text-muted); }
.btn-mstatus {
  margin-left: 6px; padding: 3px 9px; font-size: 11px; font-weight: 700; cursor: pointer;
  color: var(--blue); background: var(--blue-bg); border: 1px solid transparent; border-radius: 6px;
}
.btn-mstatus:hover { border-color: var(--blue); }
.cell-mcheck { white-space: nowrap; }
.btn-mcheck {
  padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer;
  color: #fff; background: #16a34a; border: none; border-radius: 6px;
}
.btn-mcheck:hover:not(:disabled) { background: #15803d; }
.btn-mcheck:disabled { opacity: 0.6; cursor: default; }
.mcheck-ok { display: block; font-size: 11px; font-weight: 700; color: #16a34a; }
.mcheck-time { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.cell-banding { text-align: left; }
.banding-badge {
  display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px;
  border-radius: 999px; white-space: nowrap; margin: 1px 3px 1px 0;
}
.banding-badge.badge-wait { background: #fef3c7; color: #b45309; }
.cell-timer { text-align: left; white-space: nowrap; }
.sla-badge {
  display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px;
  border-radius: 999px; white-space: nowrap;
}
.sla-badge.ok { background: #dcfce7; color: #15803d; }
.sla-badge.warn { background: #fef3c7; color: #b45309; }
.sla-badge.over { background: #fee2e2; color: #b91c1c; }
.qc-approval-note {
  background: var(--green-bg); border: 1px solid #bbf7d0; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 16px;
}
.qan-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
.qan-reason {
  background: #fff; border: 1px solid #d1fae5; border-radius: 8px; padding: 10px 12px;
  font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-wrap; word-break: break-word; margin: 0;
}
.qan-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
.qan-reviewer { color: var(--text-muted); }
.expand-row td { padding: 0; background: #fafbfc; }
.expand-content { padding: 20px 24px; border-bottom: 1px solid var(--border); }
.history-box { margin-bottom: 20px; }
.history-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
.sub-table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.sub-table th {
  background: #f8fafc; padding: 8px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); text-align: left;
}
.sub-row { cursor: pointer; }
.sub-row td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: top; word-break: break-word; }
.sub-row:last-child td { border-bottom: none; }
.sub-row:hover td { background: #f8fafc; }
.sub-row-active td { background: var(--blue-bg); }
.cell-idx { text-align: center; }
.cell-file { font-family: monospace; color: var(--blue); word-break: break-all; }
.latest-badge {
  display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
  background: var(--green-bg); color: #16a34a; font-size: 10px; font-weight: 700;
  font-family: inherit; text-transform: uppercase; letter-spacing: 0.04em;
}
.empty { text-align: center; padding: 40px; color: var(--text-muted); }
.pagination {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; font-size: 13px; color: var(--text-muted); border-top: 1px solid var(--border);
}
.page-controls { display: flex; align-items: center; gap: 10px; }
.page-btn {
  padding: 4px 12px; background: #f1f5f9; border: 1px solid var(--border);
  border-radius: 6px; font-size: 14px; font-weight: 700; color: var(--text); transition: background 0.15s;
}
.page-btn:hover:not(:disabled) { background: #e2e8f0; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-row {
  height: 52px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200%; border-radius: 8px; animation: shimmer 1.2s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.cell-delete { text-align: center; }
.btn-delete-row {
  padding: 5px 10px; background: #fef2f2; border: 1.5px solid #dc2626;
  border-radius: 8px; font-size: 12px; font-weight: 700; color: #dc2626;
  transition: all 0.15s; white-space: nowrap; cursor: pointer;
}
.btn-delete-row:hover { background: #dc2626; color: #fff; }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
}
.del-modal-card {
  background: #fff; border-radius: 14px; width: 100%; max-width: 440px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); overflow: hidden;
}
.del-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
}
.del-modal-title { font-size: 16px; font-weight: 800; color: #dc2626; margin: 0; }
.del-close-x { background: none; border: none; font-size: 16px; color: #64748b; cursor: pointer; }
.del-modal-body { padding: 18px 20px; font-size: 14px; color: #334155; line-height: 1.5; }
.del-modal-body p { margin: 0 0 10px; }
.del-warn { color: #dc2626; font-weight: 700; }
.del-input {
  width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px;
  font-size: 14px; margin-top: 4px; box-sizing: border-box;
}
.del-input:focus { outline: none; border-color: #dc2626; }
.del-error { color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 8px; }
.del-modal-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  padding: 14px 20px; border-top: 1px solid #e2e8f0;
}
.del-btn-cancel {
  padding: 8px 16px; background: #f1f5f9; border: 1.5px solid #cbd5e1;
  border-radius: 8px; font-size: 13px; font-weight: 700; color: #475569; cursor: pointer;
}
.del-btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.del-btn-next, .del-btn-confirm {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: #dc2626; border: 1.5px solid #dc2626;
  border-radius: 8px; font-size: 13px; font-weight: 800; color: #fff; cursor: pointer;
}
.del-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>