import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '../api/client.js'

// Bungkus sebuah loader async supaya hasilnya di-cache selama `ttlMs` dan
// panggilan yang tumpang tindih (mis. ResultsView + sebuah modal dibuka
// hampir bersamaan) berbagi SATU request yang sedang berjalan, bukan
// masing-masing menembakkan request sendiri (17 September 2026, improvement.md
// item 5.1). `force=true` melewati cache — dipakai pemanggil yang tahu datanya
// baru saja berubah (mis. setelah membuat campaign baru).
function fetchOnce(loader, ttlMs = 5 * 60 * 1000) {
  let cached = null
  let cachedAt = 0
  let inflight = null
  return function (force = false) {
    const now = Date.now()
    if (!force && cached !== null && (now - cachedAt) < ttlMs) return Promise.resolve(cached)
    if (!force && inflight) return inflight
    inflight = loader().then((data) => {
      cached = data
      cachedAt = Date.now()
      inflight = null
      return data
    }).catch((err) => {
      inflight = null
      throw err
    })
    return inflight
  }
}

export const useDataStore = defineStore('data', () => {
  const stats = ref(null)
  const dailyStats = ref([])
  const results = ref([])
  const campaigns = ref([])

  async function fetchStats() {
    const res = await apiClient.get('/stats')
    stats.value = res.data
    return stats.value
  }

  async function fetchDailyStats() {
    const res = await apiClient.get('/stats/daily')
    dailyStats.value = res.data.days
    return dailyStats.value
  }

  // Revamped Statistics dashboard (daily-cached snapshot on the backend).
  async function fetchStatsOverview() {
    const res = await apiClient.get('/stats/overview')
    return res.data // { overview, agents, campaigns, overview_by_campaign, agents_by_campaign }
  }

  async function fetchCampaignMonthly() {
    const res = await apiClient.get('/stats/campaigns_monthly')
    return res.data // { rows, months }
  }

  // Master Error Code catalog for the Manual Check "New Error Code" dropdown.
  // Di-cache 5 menit (17 September 2026, improvement.md item 5.1): katalog ini
  // hampir tidak pernah berubah dalam sesi kerja QC, tapi sebelum ini di-fetch
  // ulang setiap kali salah satu dari 3 modal (AddErrorCodeModal,
  // ErrorCodeManualCheckModal, CardHolderManualCheckModal) dibuka — yang dalam
  // satu sesi review tiket bisa terjadi berkali-kali berturut-turut.
  const _errorReasonsCache = fetchOnce(() => apiClient.get('/error_reasons').then(r => r.data))
  async function fetchErrorReasons() {
    return _errorReasonsCache()
  }

  // Approve/Reject proportions over time for the 100% stacked column chart.
  // params: { granularity, start?, end?, campaign? } (start/end = 'YYYY-MM-DD').
  async function fetchAiStatusTimeseries(params = {}) {
    const res = await apiClient.get('/stats/ai_status_timeseries', { params })
    return res.data // { granularity, start, end, buckets: [{ key, label, approve, return }] }
  }

  // `campaign` kosong = seluruh campaign (filter di tab Hierarki Failure Rate).
  async function fetchHierarchy(campaign = '') {
    const res = await apiClient.get('/stats/hierarchy', { params: campaign ? { campaign } : {} })
    return res.data // { all_telesales, area_managers }
  }

  // Per-QC assigned / approved / approve-rate. 403 for roles other than
  // Team Leader QC / SPQ Head / Admin.
  async function fetchQcPerformance(campaign = '') {
    const res = await apiClient.get('/stats/qc_performance', { params: campaign ? { campaign } : {} })
    return res.data // [{ qc_username, name, assigned, approved, approve_rate }]
  }

  // Sales Agent (Team Leader) scoped overview — only their agents' tickets.
  async function fetchMyOverview() {
    const res = await apiClient.get('/stats/my_overview')
    return res.data // { overview }
  }

  // Failure Reason (SPQ Head / Admin only, else 403): scorecard categories that
  // fail most often + their reasons.
  async function fetchFailureReasons(campaign = '') {
    const res = await apiClient.get('/stats/failure_reasons', { params: campaign ? { campaign } : {} })
    return res.data // { total_evaluated, categories: [{ category, fail_count, pct, top_reasons }] }
  }

  // Sub-tab "Hierarki Based": pohon AM -> TL -> Agent, tiap simpul membawa kategori
  // scorecard terbesar miliknya sendiri.
  async function fetchFailureReasonsHierarchy(campaign = '') {
    const res = await apiClient.get('/stats/failure_reasons_hierarchy', { params: campaign ? { campaign } : {} })
    return res.data // { total_evaluated, all_telesales, area_managers: [...] }
  }

  async function fetchRoleCounts() {
    const res = await apiClient.get('/stats/role_counts')
    return res.data // { sales: {...}, qc: {...} }
  }

  async function fetchResults(params = {}) {
    const res = await apiClient.get('/list_results', { params })
    return res.data
  }

  // Di-cache 5 menit sama seperti fetchErrorReasons — dropdown campaign nyaris
  // tidak berubah dalam satu sesi, tapi sebelum ini di-fetch ulang tiap ResultsView
  // dibuka (di antara panggilan lain yang lebih sering: overview, hierarchy options,
  // doc SLA — lihat komentar "4 API calls" di ResultsView.vue).
  const _campaignsCache = fetchOnce(() => apiClient.get('/list_campaigns').then(r => r.data.campaigns))
  async function fetchCampaigns(force = false) {
    campaigns.value = await _campaignsCache(force)
    return campaigns.value
  }

  return {
    stats, dailyStats, results, campaigns,
    fetchStats, fetchDailyStats, fetchResults, fetchCampaigns,
    fetchStatsOverview, fetchCampaignMonthly, fetchHierarchy, fetchQcPerformance, fetchMyOverview,
    fetchAiStatusTimeseries, fetchErrorReasons, fetchRoleCounts, fetchFailureReasons,
    fetchFailureReasonsHierarchy,
  }
})
