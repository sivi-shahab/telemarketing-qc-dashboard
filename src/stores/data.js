import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '../api/client.js'

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
  async function fetchErrorReasons() {
    const res = await apiClient.get('/error_reasons')
    return res.data // [{ code, error_type, category, risk_base, campaign, details, label }]
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

  async function fetchCampaigns() {
    const res = await apiClient.get('/list_campaigns')
    campaigns.value = res.data.campaigns
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
