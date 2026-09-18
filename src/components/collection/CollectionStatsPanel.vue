<template>
  <div class="cs-panel">
    <!-- Tata letak mengikuti Stats Cashline (StatsView.vue): tab, filter Campaign,
         panel "per waktu" berisi KPI + grafik 100% bertumpuk, lalu tabel dengan
         cari/urut/halaman. Istilahnya tetap Collection (Tiket, PASS/FAIL, Agent).
         Tidak ada tab hierarki: Collection tidak punya roster Area Manager → Team
         Leader → Agent. -->
    <div class="toolbar">
      <div class="tab-group" role="tablist">
        <button type="button" role="tab" :class="['tab', { active: tab === 'overview' }]"
                :aria-selected="tab === 'overview'" @click="tab = 'overview'">Data Tiket</button>
        <button type="button" role="tab" :class="['tab', { active: tab === 'failure' }]"
                :aria-selected="tab === 'failure'" @click="tab = 'failure'">Failure Reason</button>
      </div>
      <span class="refresh-hint">Update otomatis saat ada data baru · auto-refresh 30 detik</span>
    </div>

    <!-- Satu filter Campaign untuk kedua tab, sama seperti Cashline. -->
    <div class="cf-row">
      <label class="cf-label" for="cs-campaign">Campaign</label>
      <select id="cs-campaign" v-model="campaignFilter" class="month-select">
        <option value="">Semua Campaign</option>
        <option v-for="c in campaignOptions" :key="c" :value="c">{{ c }}</option>
      </select>
      <span v-if="campaignFilter" class="cf-note">
        Semua angka di tab ini dibatasi ke campaign <b>{{ campaignFilter }}</b>.
      </span>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="loading && !data" class="skeleton-wrap">
      <div class="skeleton" v-for="i in 4" :key="i"></div>
    </div>

    <template v-else-if="data">
      <!-- ============================ DATA TIKET ============================ -->
      <template v-if="tab === 'overview'">
        <div class="panel">
          <div class="panel-title">AI Status — per waktu</div>
          <div class="chart-filter">
            <div class="gran-group">
              <button v-for="g in GRANULARITIES" :key="g.key" type="button"
                      :class="['gran-btn', { active: granularity === g.key }]"
                      @click="setGranularity(g.key)">{{ g.label }}</button>
            </div>
            <div class="date-range">
              <label class="dr-label">Dari</label>
              <input type="date" v-model="dateStart" :max="dateEnd || undefined" class="date-input" @change="periodOffset = 0" />
              <label class="dr-label">s/d</label>
              <input type="date" v-model="dateEnd" :min="dateStart || undefined" class="date-input" @change="periodOffset = 0" />
              <button v-if="hasDateFilter" type="button" class="clear-btn" @click="clearDates">Reset</button>
            </div>
          </div>

          <!-- KPI dihitung atas rentang yang SAMA dengan grafik di bawahnya. -->
          <div class="kpis kpis-5">
            <div class="kpi" style="--accent: var(--m-info)">
              <div class="kpi-label">Total Tiket</div>
              <div class="kpi-value mono">{{ fmtInt(kpi.total) }}</div>
              <div class="kpi-sub">
                {{ fmtInt(kpi.done) }} selesai · {{ fmtInt(kpi.in_progress) }} diproses · {{ fmtInt(kpi.failed) }} gagal proses
              </div>
            </div>
            <div class="kpi" style="--accent: var(--m-success)">
              <div class="kpi-label">PASS</div>
              <div class="kpi-value mono">{{ fmtInt(kpi.pass) }} <span class="kpi-pct">({{ pctOf(kpi.pass, kpi.with_report) }}%)</span></div>
              <div class="kpi-sub">dari {{ fmtInt(kpi.with_report) }} dinilai</div>
            </div>
            <div class="kpi" style="--accent: var(--m-danger)">
              <div class="kpi-label">FAIL</div>
              <div class="kpi-value mono">{{ fmtInt(kpi.fail) }} <span class="kpi-pct" style="color: var(--m-danger)">({{ pctOf(kpi.fail, kpi.with_report) }}%)</span></div>
              <div class="kpi-sub">dari {{ fmtInt(kpi.with_report) }} dinilai</div>
            </div>
            <div class="kpi" style="--accent: var(--m-gray-700)">
              <div class="kpi-label">Rata-rata Skor</div>
              <div class="kpi-value mono">{{ fmtPct(kpi.avg_score_percent) }}</div>
              <div class="kpi-sub">dari skor maksimal tiap tiket</div>
            </div>
          </div>
          <div v-if="kpi.without_report > 0" class="panel-hint cs-hint">
            {{ fmtInt(kpi.without_report) }} tiket selesai tanpa laporan berbobot (tidak ikut dinilai).
          </div>

          <div class="chart-head">
            <div class="chart-sub-title">AI Status (PASS / FAIL) — per waktu</div>
            <div class="period-nav">
              <button type="button" class="nav-btn" :disabled="hasDateFilter" @click="shiftPeriod(-1)"
                      title="Periode sebelumnya" aria-label="Periode sebelumnya">‹</button>
              <span class="nav-range">{{ currentRangeLabel || '—' }}</span>
              <button type="button" class="nav-btn" :disabled="hasDateFilter || periodOffset >= 0" @click="shiftPeriod(1)"
                      title="Periode berikutnya" aria-label="Periode berikutnya">›</button>
            </div>
          </div>
          <div class="stack-wrap">
            <Bar :data="chartData" :options="stackedOptions" :plugins="[barPct]" />
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Performa Agent</div>
          <div class="panel-hint">
            Agent diambil dari nama yang disebut di rekaman. <b>—</b> pada Rata-rata Skor berarti
            skor tiketnya tidak terbaca, bukan 0.
          </div>
          <TblToolbar :v="agentView" label="Performa Agent" placeholder="Cari nama agent…" />
          <div class="table-scroll">
            <table class="mtable">
              <thead>
                <tr>
                  <th class="sortable" @click="agentView.sortBy('agent')">Agent <span class="sort-ind">{{ agentView.indicator('agent') }}</span></th>
                  <th class="num sortable" @click="agentView.sortBy('tickets')">Tiket <span class="sort-ind">{{ agentView.indicator('tickets') }}</span></th>
                  <th class="num sortable" @click="agentView.sortBy('pass')">PASS <span class="sort-ind">{{ agentView.indicator('pass') }}</span></th>
                  <th class="num sortable" @click="agentView.sortBy('fail')">FAIL <span class="sort-ind">{{ agentView.indicator('fail') }}</span></th>
                  <th class="num sortable" @click="agentView.sortBy('pass_rate')">PASS Rate <span class="sort-ind">{{ agentView.indicator('pass_rate') }}</span></th>
                  <th class="num sortable" @click="agentView.sortBy('avg_score_percent')">Rata-rata Skor <span class="sort-ind">{{ agentView.indicator('avg_score_percent') }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!agentView.total"><td colspan="6" class="empty">
                  {{ agents.length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada data.' }}
                </td></tr>
                <tr v-for="(a, i) in agentView.rows" :key="`${a.agent}-${i}`">
                  <td style="background: var(--m-gray-100)">
                    <span class="cell-agent">
                      <span class="avatar sm">{{ initials(a.agent) }}</span>
                      {{ a.agent }}
                    </span>
                  </td>
                  <td class="num mono" style="background: var(--m-gray-100)">{{ fmtInt(a.tickets) }}</td>
                  <!-- Warna sel PASS/FAIL sama persis dengan batang grafik di atas,
                       seperti kolom Qualified/Not Qualified di Performa Sales Cashline. -->
                  <td class="num mono" :style="a.pass ? { background: AI_COLORS.approve, color: AI_LABEL_COLORS.approve } : null">{{ fmtInt(a.pass) }}</td>
                  <td class="num mono" :style="a.fail ? { background: AI_COLORS.return, color: AI_LABEL_COLORS.return } : null">{{ fmtInt(a.fail) }}</td>
                  <td class="num mono">{{ fmtPct(a.pass_rate) }}</td>
                  <td class="num mono">{{ fmtPct(a.avg_score_percent) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pager :v="agentView" label="agent" />
        </div>
      </template>

      <!-- ========================= FAILURE REASON ========================= -->
      <template v-else>
        <div class="kpis">
          <div class="kpi" style="--accent: var(--m-info)">
            <div class="kpi-label">Total Tiket Dinilai</div>
            <div class="kpi-value mono">{{ fmtInt(kpi.with_report) }}</div>
            <div class="kpi-sub">tiket dengan laporan berbobot</div>
          </div>
          <div class="kpi" style="--accent: var(--m-danger)">
            <div class="kpi-label">Total Tiket FAIL</div>
            <div class="kpi-value mono">{{ fmtInt(kpi.fail) }} <span class="kpi-pct" style="color: var(--m-danger)">({{ pctOf(kpi.fail, kpi.with_report) }}%)</span></div>
            <div class="kpi-sub">dari {{ fmtInt(kpi.with_report) }} dinilai</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Kategori Scorecard yang Sering Gagal</div>
          <TblToolbar :v="categoryView" label="Kategori Scorecard yang Sering Gagal" placeholder="Cari kategori…" />
          <div class="table-scroll">
            <table class="mtable">
              <thead>
                <tr>
                  <th class="sortable" @click="categoryView.sortBy('category')">Kategori <span class="sort-ind">{{ categoryView.indicator('category') }}</span></th>
                  <th class="num sortable" @click="categoryView.sortBy('reports')">Tiket Dinilai <span class="sort-ind">{{ categoryView.indicator('reports') }}</span></th>
                  <th class="num sortable" @click="categoryView.sortBy('avg_percent')">Rata-rata Skor <span class="sort-ind">{{ categoryView.indicator('avg_percent') }}</span></th>
                  <th class="num sortable" @click="categoryView.sortBy('fail')">FAIL <span class="sort-ind">{{ categoryView.indicator('fail') }}</span></th>
                  <th class="num sortable" @click="categoryView.sortBy('fail_rate')">% FAIL <span class="sort-ind">{{ categoryView.indicator('fail_rate') }}</span></th>
                  <th class="num sortable" @click="categoryView.sortBy('unavailable')">Tidak Tersedia <span class="sort-ind">{{ categoryView.indicator('unavailable') }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!categoryView.total"><td colspan="6" class="empty">
                  {{ (data.categories || []).length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada data.' }}
                </td></tr>
                <tr v-for="(c, i) in categoryView.rows" :key="`${c.category}-${i}`">
                  <td class="campaign-name">{{ c.category }}</td>
                  <td class="num mono">{{ fmtInt(c.reports) }}</td>
                  <td class="num mono">{{ fmtPct(c.avg_percent) }}</td>
                  <td class="num mono">{{ fmtInt(c.fail) }}</td>
                  <td class="num mono">{{ fmtPct(c.fail_rate) }}</td>
                  <td class="num mono">{{ fmtInt(c.unavailable) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pager :v="categoryView" label="kategori" />
        </div>

        <div class="panel">
          <div class="panel-title">Indikator Paling Sering Belum Sesuai</div>
          <TblToolbar :v="indicatorView" label="Indikator Paling Sering Belum Sesuai" placeholder="Cari kode, requirement, atau kategori…" />
          <div class="table-scroll">
            <table class="mtable">
              <thead>
                <tr>
                  <th class="sortable" @click="indicatorView.sortBy('item_code')">Kode <span class="sort-ind">{{ indicatorView.indicator('item_code') }}</span></th>
                  <th>Requirement</th>
                  <th class="sortable" @click="indicatorView.sortBy('category')">Kategori <span class="sort-ind">{{ indicatorView.indicator('category') }}</span></th>
                  <th class="num sortable" @click="indicatorView.sortBy('belum_sesuai')">Jumlah <span class="sort-ind">{{ indicatorView.indicator('belum_sesuai') }}</span></th>
                  <th class="num sortable" @click="indicatorView.sortBy('rate')">% Tiket <span class="sort-ind">{{ indicatorView.indicator('rate') }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!indicatorView.total"><td colspan="5" class="empty">
                  {{ (data.top_failed_indicators || []).length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada data.' }}
                </td></tr>
                <tr v-for="(it, i) in indicatorView.rows" :key="`${it.item_code}-${i}`">
                  <td class="mono campaign-name">{{ it.item_code }}</td>
                  <td>{{ it.requirement }}</td>
                  <td>{{ it.category }}</td>
                  <td class="num mono">{{ fmtInt(it.belum_sesuai) }}</td>
                  <td class="num mono">{{ fmtPct(it.rate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pager :v="indicatorView" label="indikator" />
        </div>

        <div class="panel">
          <div class="panel-title">Critical Compliance</div>
          <div class="kpis kpis-3">
            <div class="kpi" style="--accent: var(--m-success)">
              <div class="kpi-label">{{ verdictLabel('PASS') }}</div>
              <div class="kpi-value mono">{{ fmtInt(data.critical.pass) }}</div>
            </div>
            <div class="kpi" style="--accent: var(--m-danger)">
              <div class="kpi-label">{{ verdictLabel('FAIL') }}</div>
              <div class="kpi-value mono">{{ fmtInt(data.critical.fail) }}</div>
            </div>
            <div class="kpi" style="--accent: var(--m-gray-700)">
              <div class="kpi-label">{{ verdictLabel('TIDAK_TERSEDIA') }}</div>
              <div class="kpi-value mono">{{ fmtInt(data.critical.unavailable) }}</div>
            </div>
          </div>
          <TblToolbar :v="criticalView" label="Critical Compliance" placeholder="Cari kode atau requirement…" />
          <div class="table-scroll">
            <table class="mtable">
              <thead>
                <tr>
                  <th class="sortable" @click="criticalView.sortBy('item_code')">Kode <span class="sort-ind">{{ criticalView.indicator('item_code') }}</span></th>
                  <th>Requirement</th>
                  <th class="num sortable" @click="criticalView.sortBy('fail')">FAIL <span class="sort-ind">{{ criticalView.indicator('fail') }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!criticalView.total"><td colspan="3" class="empty">
                  {{ (data.critical.items || []).length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada item critical yang FAIL.' }}
                </td></tr>
                <tr v-for="(it, i) in criticalView.rows" :key="`${it.item_code}-${i}`">
                  <td class="mono campaign-name">{{ it.item_code }}</td>
                  <td>{{ it.requirement }}</td>
                  <td class="num mono">{{ fmtInt(it.fail) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pager :v="criticalView" label="item" />
        </div>

        <div class="panel">
          <div class="panel-title">Kode Pelanggaran OJK</div>
          <TblToolbar :v="errorCodeView" label="Kode Pelanggaran OJK" placeholder="Cari kode atau contoh…" />
          <div class="table-scroll">
            <table class="mtable">
              <thead>
                <tr>
                  <th class="sortable" @click="errorCodeView.sortBy('error_code')">Kode <span class="sort-ind">{{ errorCodeView.indicator('error_code') }}</span></th>
                  <th class="num sortable" @click="errorCodeView.sortBy('count')">Jumlah <span class="sort-ind">{{ errorCodeView.indicator('count') }}</span></th>
                  <th>Contoh</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!errorCodeView.total"><td colspan="3" class="empty">
                  {{ (data.error_codes || []).length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada data.' }}
                </td></tr>
                <tr v-for="(ec, i) in errorCodeView.rows" :key="`${ec.error_code}-${i}`">
                  <td class="mono campaign-name">{{ ec.error_code }}</td>
                  <td class="num mono">{{ fmtInt(ec.count) }}</td>
                  <td>{{ ec.example || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pager :v="errorCodeView" label="kode" />
        </div>

        <div class="panel">
          <div class="panel-title">Komitmen Konsumen</div>
          <div class="table-scroll">
            <table class="mtable">
              <thead>
                <tr>
                  <th>Status Komitmen</th>
                  <th class="num">Jumlah</th>
                  <th class="num">% Tiket</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="key in COMMITMENT_KEYS" :key="key">
                  <td><span class="rate-badge" :class="commitmentBadge(key).tone">{{ commitmentBadge(key).label }}</span></td>
                  <td class="num mono">{{ fmtInt(data.commitment[key]) }}</td>
                  <td class="num mono">{{ pctOf(data.commitment[key], commitmentTotal) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Bar } from 'vue-chartjs'
// Registrasi elemen Chart.js (BarElement/CategoryScale/LinearScale/Tooltip/Legend)
// sudah dilakukan StatsView.vue — satu-satunya pemakai panel ini — jadi tidak
// diulang di sini.
import apiClient from '../../api/client.js'
import TblToolbar from '../TableToolbar.vue'
import Pager from '../TablePager.vue'
import { useTableView } from '../../composables/useTableView.js'
import { AI_COLORS, AI_LABEL_COLORS, stackedOptions, barPct } from '../../utils/aiStatusChart.js'
import { commitmentBadge, verdictLabel } from '../../utils/collectionReport.js'
import {
  fmtInt, fmtPct, GRANULARITIES, wibToday, defaultWindow, bucketDaily, passFailChartData,
  orderedDateRange, statsErrorMessage, shouldPollTick,
} from '../../utils/collectionStats.js'

const COMMITMENT_KEYS = ['COMMITTED_TO_PAY', 'PARTIAL_COMMITMENT', 'DISPUTE', 'REFUSED', 'NOT_STATED']

const tab = ref('overview')
const campaignFilter = ref('')
// Daftar campaign diambil dari respons TANPA filter; respons yang difilter hanya
// membawa campaign terpilih, jadi daftarnya disimpan supaya dropdown tidak menyusut.
const campaignOptions = ref([])

// Filter waktu meniru Cashline: granularitas + jendela bawaan yang bisa digeser ‹ ›,
// atau rentang tanggal manual (absolut — navigasi periode dinonaktifkan).
const granularity = ref('daily')
const periodOffset = ref(0)
const dateStart = ref('')
const dateEnd = ref('')
const hasDateFilter = computed(() => !!(dateStart.value || dateEnd.value))

// Rentang yang benar-benar diminta ke API — dipakai KPI, grafik, dan semua tabel,
// sehingga semua angka di layar selalu berasal dari rentang yang sama.
const range = computed(() => {
  if (hasDateFilter.value) {
    const today = wibToday()
    const r = orderedDateRange(dateStart.value || dateEnd.value, dateEnd.value || today)
    return r
  }
  return defaultWindow(granularity.value, wibToday(), periodOffset.value)
})

const data = ref(null)
const loading = ref(false)
const error = ref('')

const kpi = computed(() => data.value?.kpi || {})
const agents = computed(() => data.value?.agents || [])
const buckets = computed(() => bucketDaily(data.value?.daily, granularity.value, range.value.start, range.value.end))
const chartData = computed(() => passFailChartData(buckets.value))
const currentRangeLabel = computed(() => {
  const b = buckets.value
  if (!b.length) return ''
  return b.length === 1 ? b[0].label : `${b[0].label} – ${b[b.length - 1].label}`
})
const commitmentTotal = computed(() =>
  COMMITMENT_KEYS.reduce((n, k) => n + (data.value?.commitment?.[k] || 0), 0))

const agentView = useTableView(agents, { fields: ['agent'], sortKey: 'tickets' })
const categoryView = useTableView(computed(() => data.value?.categories || []), {
  fields: ['category'], sortKey: 'fail',
})
const indicatorView = useTableView(computed(() => data.value?.top_failed_indicators || []), {
  fields: ['item_code', 'requirement', 'category'], sortKey: 'belum_sesuai',
})
const criticalView = useTableView(computed(() => data.value?.critical?.items || []), {
  fields: ['item_code', 'requirement'], sortKey: 'fail',
})
const errorCodeView = useTableView(computed(() => data.value?.error_codes || []), {
  fields: ['error_code', 'example'], sortKey: 'count',
})

function pctOf(part, total) { return total ? +((part || 0) / total * 100).toFixed(1) : 0 }
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

function setGranularity(g) {
  granularity.value = g
  periodOffset.value = 0
}
function shiftPeriod(dir) {
  if (hasDateFilter.value) return
  const next = periodOffset.value + dir
  if (next > 0) return
  periodOffset.value = next
}
function clearDates() {
  dateStart.value = ''
  dateEnd.value = ''
  periodOffset.value = 0
}

// Guard anti race-condition: pola sama persis dengan CollectionView.vue —
// AbortController membatalkan request sebelumnya, requestId memastikan respons/
// error yang telat dari request lama tidak menimpa state dengan data basi.
let requestId = 0
let inFlight = null // AbortController

async function reload() {
  if (inFlight) inFlight.abort()
  const ctrl = new AbortController()
  inFlight = ctrl
  const myId = ++requestId

  loading.value = true
  error.value = ''
  try {
    const { data: payload } = await apiClient.get('/stats/collection', {
      params: {
        date_start: range.value.start,
        date_end: range.value.end,
        campaign: campaignFilter.value || undefined,
      },
      signal: ctrl.signal,
    })
    if (myId !== requestId) return
    data.value = payload
    if (!campaignFilter.value) campaignOptions.value = payload.campaigns || []
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'CanceledError') return
    if (myId !== requestId) return
    error.value = statsErrorMessage(e)
  } finally {
    if (myId === requestId) {
      loading.value = false
      inFlight = null
    }
  }
}

// Setiap perubahan rentang (granularitas, geser periode, tanggal manual) atau
// campaign memuat ulang; `range` sudah menggabungkan ketiganya.
watch([() => range.value.start, () => range.value.end, campaignFilter], reload)

// Auto-refresh: tick dilewati (bukan membatalkan request) bila tab tersembunyi
// atau request sebelumnya belum selesai.
function pollTick() {
  if (!shouldPollTick({ visibilityState: document.visibilityState, inFlight: inFlight !== null })) return
  reload()
}

let timer
onMounted(() => {
  reload()
  timer = setInterval(pollTick, 30000)
})
onUnmounted(() => {
  clearInterval(timer)
  if (inFlight) inFlight.abort()
})
</script>

<style scoped>
/* Disalin dari <style scoped> StatsView.vue (Stats Cashline) supaya kedua tampilan
   Stats identik — bukan sistem gaya baru. Style scoped tidak menembus komponen
   anak, jadi aturan yang dipakai di sini harus ada di berkas ini sendiri. */
.cs-panel { display: flex; flex-direction: column; gap: 20px; }

.toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.tab-group { display: flex; background: var(--m-gray-150); border-radius: var(--m-r-pill); padding: 4px; gap: 4px; }
.tab {
  padding: 7px 18px; border: none; background: none; border-radius: var(--m-r-pill);
  font-size: 13px; font-weight: 600; color: var(--m-fg-2); cursor: pointer; transition: all .15s;
  font-family: var(--m-font-sans);
}
.tab.active { background: #fff; color: var(--m-gray-900); box-shadow: var(--m-shadow-sm); }
.refresh-hint { font-size: 12px; color: var(--m-fg-3); }

.cf-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: -6px; }
.cf-label { font-size: 13px; font-weight: 600; color: var(--m-fg-2); }
.cf-note { font-size: 12px; color: var(--m-fg-2); }
.month-select {
  padding: 6px 10px; border: 1.5px solid var(--m-border-1); border-radius: var(--m-r-sm);
  font-size: 12px; font-weight: 600; color: var(--m-gray-900); background: #fff; outline: none;
}
.month-select:focus { border-color: var(--m-info); }

.error-box { padding: 10px 14px; background: var(--m-danger-soft); color: var(--m-danger); border: 1px solid var(--m-danger); border-radius: 8px; font-size: 13px; }

.skeleton-wrap { display: flex; flex-direction: column; gap: 12px; }
.skeleton { background: linear-gradient(90deg, var(--m-gray-100) 25%, var(--m-gray-150) 50%, var(--m-gray-100) 75%); background-size: 200%; height: 84px; border-radius: var(--m-r-md); animation: cs-shimmer 1.2s infinite; }
@keyframes cs-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.panel { background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md); padding: 18px 20px; box-shadow: var(--m-shadow-card); }
.panel-title { font-size: 14px; font-weight: 700; color: var(--m-gray-900); margin-bottom: 14px; }
.panel-hint { font-size: 11.5px; color: var(--m-fg-2); line-height: 1.45; margin: -2px 0 8px; }
.cs-hint { margin: 10px 0 0; }

.chart-filter { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.gran-group { display: flex; flex-wrap: wrap; background: var(--m-gray-150); border-radius: var(--m-r-pill); padding: 4px; gap: 4px; }
.gran-btn {
  padding: 6px 14px; border: none; background: none; border-radius: var(--m-r-pill);
  font-size: 12.5px; font-weight: 600; color: var(--m-fg-2); cursor: pointer; transition: all .15s;
  font-family: var(--m-font-sans);
}
.gran-btn:hover { color: var(--m-gray-900); }
.gran-btn.active { background: #fff; color: var(--m-info); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.date-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dr-label { font-size: 12px; font-weight: 600; color: var(--m-fg-2); }
.date-input {
  padding: 6px 10px; border: 1px solid var(--m-gray-200); border-radius: 8px;
  font-size: 12.5px; font-family: var(--m-font-sans); color: var(--m-gray-900); background: #fff;
}
.date-input:focus { border-color: var(--m-info); outline: none; }
.clear-btn {
  padding: 6px 12px; border: 1px solid var(--m-gray-200); background: #fff; border-radius: var(--m-r-pill);
  font-size: 12px; font-weight: 600; color: var(--m-fg-2); cursor: pointer;
}
.clear-btn:hover { border-color: var(--m-danger); color: var(--m-danger); }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.kpis-5 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.kpis-3 { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 14px; }
.kpi {
  background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md);
  padding: 18px 20px; border-top: 3px solid var(--accent, var(--m-gray-300)); box-shadow: var(--m-shadow-card);
}
.kpi-label { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--m-gray-700); }
.kpi-value { font-size: 32px; font-weight: 800; color: var(--m-gray-900); margin-top: 6px; }
.kpi-pct { font-size: 15px; font-weight: 700; color: var(--m-fg-2); }
.kpi-sub { font-size: 12.5px; font-weight: 600; color: var(--m-fg-2); margin-top: 4px; }

.chart-head { display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin: 18px 0 6px; }
.chart-sub-title { font-size: 12.5px; font-weight: 700; color: var(--text-muted); }
.period-nav { display: flex; align-items: center; gap: 8px; }
.nav-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: 1px solid var(--m-gray-200); background: #fff;
  border-radius: var(--m-r-pill); font-size: 16px; font-weight: 700; line-height: 1;
  color: var(--m-fg-2); cursor: pointer; transition: all .15s;
}
.nav-btn:hover:not(:disabled) { border-color: var(--m-info); color: var(--m-info); }
.nav-btn:disabled { opacity: .4; cursor: not-allowed; }
.nav-range { font-size: 12.5px; font-weight: 600; color: var(--m-gray-900); min-width: 108px; text-align: center; }
.stack-wrap { position: relative; min-width: 0; height: 320px; }

.table-scroll { overflow-x: auto; }
.mtable { width: 100%; border-collapse: collapse; border: 2px solid var(--m-border-2); }
.mtable th {
  text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .04em; color: var(--m-fg-2); border-bottom: 2px solid var(--m-border-2); background: var(--m-gray-50); white-space: nowrap;
}
.mtable td { padding: 10px 12px; font-size: 13px; color: var(--m-gray-900); border-bottom: 2px solid var(--m-border-2); vertical-align: middle; }
.mtable tr:last-child td { border-bottom: none; }
.mtable th, .mtable td { border-right: 2px solid var(--m-border-2); }
.mtable th:last-child, .mtable td:last-child { border-right: none; }
.mtable .num { text-align: right; white-space: nowrap; }
.mtable th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.mtable th.sortable:hover { color: var(--m-fg-1); }
.sort-ind { font-size: 9px; opacity: 0.55; margin-left: 2px; }
.campaign-name { font-weight: 600; white-space: nowrap; }
.empty { text-align: center; color: var(--m-fg-3); padding: 28px; }

.cell-agent { display: inline-flex; align-items: center; font-weight: 600; }
.avatar {
  display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;
  width: 26px; height: 26px; font-size: 10px; font-weight: 700; margin-right: 8px; flex-shrink: 0;
  background: var(--m-gray-150); color: var(--m-gray-700);
}

.rate-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: var(--m-r-pill); }
.rate-badge.danger { background: var(--m-danger-soft); color: var(--m-danger); }
.rate-badge.warning { background: var(--m-warning-soft); color: var(--m-warning); }
.rate-badge.success { background: var(--m-success-soft); color: var(--m-success); }
.rate-badge.info { background: var(--m-info-soft); color: var(--m-info); }
.rate-badge.muted { background: var(--m-gray-150); color: var(--m-fg-3); }
</style>
