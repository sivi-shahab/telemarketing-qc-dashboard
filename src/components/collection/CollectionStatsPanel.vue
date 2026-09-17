<template>
  <div class="cs-panel">
    <!-- Filter tanggal transkrip + Reset — sama untuk semua bagian di bawah karena
         semuanya diturunkan dari satu payload GET /stats/collection. -->
    <div class="toolbar">
      <div class="date-range">
        <label class="dr-label">Dari</label>
        <input type="date" v-model="dateStart" :max="dateEnd || undefined" class="date-input" @change="reload" />
        <label class="dr-label">Sampai</label>
        <input type="date" v-model="dateEnd" :min="dateStart || undefined" class="date-input" @change="reload" />
        <button class="clear-btn" @click="resetFilter">Reset</button>
      </div>
      <span class="refresh-hint">Update otomatis saat ada data baru · auto-refresh 30 detik</span>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="loading && !data" class="skeleton-wrap">
      <div class="skeleton" v-for="i in 4" :key="i"></div>
    </div>

    <template v-else-if="data">
      <div v-if="data.kpi.total === 0" class="empty-state">Belum ada data Collection pada rentang ini.</div>

      <template v-else>
        <!-- Kartu KPI -->
        <div class="kpis">
          <div class="kpi" style="--accent: var(--m-info)">
            <div class="kpi-label">Total Tiket</div>
            <div class="kpi-value mono">{{ fmtInt(data.kpi.total) }}</div>
          </div>
          <div class="kpi" style="--accent: var(--m-gray-700)">
            <div class="kpi-label">Selesai</div>
            <div class="kpi-value mono">{{ fmtInt(data.kpi.done) }}</div>
          </div>
          <div class="kpi" style="--accent: #D97706">
            <div class="kpi-label">Diproses</div>
            <div class="kpi-value mono">{{ fmtInt(data.kpi.in_progress) }}</div>
          </div>
          <div class="kpi" style="--accent: var(--m-danger)">
            <div class="kpi-label">Gagal Proses</div>
            <div class="kpi-value mono">{{ fmtInt(data.kpi.failed) }}</div>
          </div>
          <div class="kpi" style="--accent: var(--m-success)">
            <div class="kpi-label">PASS</div>
            <div class="kpi-value mono">{{ fmtInt(data.kpi.pass) }}</div>
          </div>
          <div class="kpi" style="--accent: var(--m-danger)">
            <div class="kpi-label">FAIL</div>
            <div class="kpi-value mono">{{ fmtInt(data.kpi.fail) }}</div>
          </div>
          <div class="kpi" style="--accent: var(--m-info)">
            <div class="kpi-label">PASS Rate</div>
            <div class="kpi-value mono">{{ fmtPct(data.kpi.pass_rate) }}</div>
          </div>
          <div class="kpi" style="--accent: var(--m-info)">
            <div class="kpi-label">Rata-rata Skor</div>
            <div class="kpi-value mono">{{ fmtPct(data.kpi.avg_score_percent) }}</div>
          </div>
        </div>
        <div v-if="data.kpi.without_report > 0" class="panel-hint">
          {{ fmtInt(data.kpi.without_report) }} tiket selesai tanpa laporan berbobot.
        </div>

        <!-- Tren harian -->
        <div class="panel">
          <div class="panel-title">Tren Harian PASS/FAIL</div>
          <div v-if="!data.daily.length" class="empty">Belum ada laporan berbobot pada rentang ini.</div>
          <div v-else class="stack-wrap">
            <Bar :data="chartData" :options="chartOptions" />
          </div>
        </div>

        <!-- Kategori | Indikator -->
        <div class="cs-grid-2">
          <div class="panel">
            <div class="panel-title">Kepatuhan per Kategori</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th class="num">Laporan</th>
                    <th class="num">Rata-rata Skor</th>
                    <th class="num">FAIL</th>
                    <th class="num">% FAIL</th>
                    <th class="num">Tidak Tersedia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!data.categories.length"><td colspan="6" class="empty">Belum ada data.</td></tr>
                  <tr v-for="(c, i) in data.categories" :key="`${c.category}-${i}`">
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
          </div>

          <div class="panel">
            <div class="panel-title">Indikator Paling Sering Belum Sesuai</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Requirement</th>
                    <th>Kategori</th>
                    <th class="num">Jumlah</th>
                    <th class="num">% Laporan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!data.top_failed_indicators.length"><td colspan="5" class="empty">Belum ada data.</td></tr>
                  <tr v-for="(it, i) in data.top_failed_indicators" :key="`${it.item_code}-${i}`">
                    <td class="mono">{{ it.item_code }}</td>
                    <td>{{ it.requirement }}</td>
                    <td>{{ it.category }}</td>
                    <td class="num mono">{{ fmtInt(it.belum_sesuai) }}</td>
                    <td class="num mono">{{ fmtPct(it.rate) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Critical | Error code -->
        <div class="cs-grid-2">
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
            <div class="table-scroll cs-table-gap">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Requirement</th>
                    <th class="num">FAIL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!data.critical.items.length"><td colspan="3" class="empty">Belum ada item critical yang FAIL.</td></tr>
                  <tr v-for="(it, i) in data.critical.items" :key="`${it.item_code}-${i}`">
                    <td class="mono">{{ it.item_code }}</td>
                    <td>{{ it.requirement }}</td>
                    <td class="num mono">{{ fmtInt(it.fail) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Kode Pelanggaran OJK</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th class="num">Jumlah</th>
                    <th>Contoh</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!data.error_codes.length"><td colspan="3" class="empty">Belum ada data.</td></tr>
                  <tr v-for="(ec, i) in data.error_codes" :key="`${ec.error_code}-${i}`">
                    <td class="mono">{{ ec.error_code }}</td>
                    <td class="num mono">{{ fmtInt(ec.count) }}</td>
                    <td>{{ ec.example || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Agent | Komitmen -->
        <div class="cs-grid-2">
          <div class="panel">
            <div class="panel-title">Per Agent</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th class="num">Tiket</th>
                    <th class="num">PASS</th>
                    <th class="num">FAIL</th>
                    <th class="num">PASS Rate</th>
                    <th class="num">Rata-rata Skor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!data.agents.length"><td colspan="6" class="empty">Belum ada data.</td></tr>
                  <tr v-for="(a, i) in data.agents" :key="`${a.agent}-${i}`">
                    <td>{{ a.agent }}</td>
                    <td class="num mono">{{ fmtInt(a.tickets) }}</td>
                    <td class="num mono">{{ fmtInt(a.pass) }}</td>
                    <td class="num mono">{{ fmtInt(a.fail) }}</td>
                    <td class="num mono">{{ fmtPct(a.pass_rate) }}</td>
                    <td class="num mono">{{ fmtPct(a.avg_score_percent) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Komitmen Konsumen</div>
            <ul class="commitment-list">
              <li v-for="key in COMMITMENT_KEYS" :key="key" class="commitment-row">
                <span class="rate-badge" :class="`${commitmentBadge(key).tone}`">{{ commitmentBadge(key).label }}</span>
                <span class="commitment-count mono">{{ fmtInt(data.commitment[key]) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Bar } from 'vue-chartjs'
// Registrasi elemen Chart.js (BarElement/CategoryScale/LinearScale/Tooltip/Legend)
// sudah dilakukan StatsView.vue — satu-satunya pemakai panel ini — jadi tidak
// diulang di sini (lihat interfaces di task-6-brief.md).
import apiClient from '../../api/client.js'
import { commitmentBadge, verdictLabel } from '../../utils/collectionReport.js'
import {
  fmtInt, fmtPct, dailyChartData, defaultDateRange, orderedDateRange, statsErrorMessage, shouldPollTick,
} from '../../utils/collectionStats.js'

const COMMITMENT_KEYS = ['COMMITTED_TO_PAY', 'PARTIAL_COMMITMENT', 'DISPUTE', 'REFUSED', 'NOT_STATED']

// Bawaan 30 hari terakhir (WIB) — rentang tanpa batas membuat setiap polling
// membaca seluruh tiket Collection.
const initialRange = defaultDateRange()
const dateStart = ref(initialRange.start)
const dateEnd = ref(initialRange.end)
const data = ref(null)
const loading = ref(false)
const error = ref('')

const chartData = computed(() => dailyChartData(data.value?.daily))
const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } },
    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(0,0,0,.06)' } },
  },
  plugins: { legend: { position: 'top' } },
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

  // :max/:min pada input sudah mencegah rentang terbalik di UI; ketikan manual
  // tetap ditukar di sini supaya request tidak pernah memakai awal > akhir.
  const range = orderedDateRange(dateStart.value, dateEnd.value)
  dateStart.value = range.start
  dateEnd.value = range.end

  loading.value = true
  error.value = ''
  try {
    const { data: payload } = await apiClient.get('/stats/collection', {
      params: {
        date_start: dateStart.value || undefined,
        date_end: dateEnd.value || undefined,
      },
      signal: ctrl.signal,
    })
    if (myId !== requestId) return
    data.value = payload
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

function resetFilter() {
  const range = defaultDateRange()
  dateStart.value = range.start
  dateEnd.value = range.end
  reload()
}

// Auto-refresh: tick dilewati (bukan membatalkan request) bila tab tersembunyi
// atau request sebelumnya belum selesai. Perubahan filter tetap membatalkan
// request lama lewat reload().
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
/* Kelas berikut ditiru persis dari StatsView.vue/CollectionView.vue (Step 1 brief)
   supaya tampilan konsisten dengan Stats Cashline — bukan sistem gaya baru. */
.cs-panel { display: flex; flex-direction: column; gap: 20px; }

.toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.refresh-hint { font-size: 12px; color: var(--m-fg-3); }
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

.error-box { padding: 10px 14px; background: var(--m-danger-soft); color: var(--m-danger); border: 1px solid var(--m-danger); border-radius: 8px; font-size: 13px; }
.empty-state {
  padding: 40px 20px; text-align: center; color: var(--m-fg-2); font-size: 14px;
  background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md);
}

.skeleton-wrap { display: flex; flex-direction: column; gap: 12px; }
.skeleton { background: linear-gradient(90deg, var(--m-gray-100) 25%, var(--m-gray-150) 50%, var(--m-gray-100) 75%); background-size: 200%; height: 84px; border-radius: var(--m-r-md); animation: cs-shimmer 1.2s infinite; }
@keyframes cs-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.kpis-3 { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 14px; }
.kpi {
  background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md);
  padding: 18px 20px; border-top: 3px solid var(--accent, var(--m-gray-300)); box-shadow: var(--m-shadow-card);
}
.kpi-label { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--m-gray-700); }
.kpi-value { font-size: 32px; font-weight: 800; color: var(--m-gray-900); margin-top: 6px; }
.panel-hint { font-size: 11.5px; color: var(--m-fg-2); line-height: 1.45; margin-top: -8px; }

.panel { background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md); padding: 18px 20px; box-shadow: var(--m-shadow-card); }
.panel-title { font-size: 14px; font-weight: 700; color: var(--m-gray-900); margin-bottom: 14px; }
.stack-wrap { position: relative; height: 320px; }

/* Grid dua kolom — sama lebar (brief tidak meminta rasio timpang seperti .grid-2
   StatsView), satu kolom di bawah 1100px (breakpoint sesuai brief). */
.cs-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 1100px) { .cs-grid-2 { grid-template-columns: 1fr; } }

.table-scroll { overflow-x: auto; }
.cs-table-gap { margin-top: 4px; }
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
.campaign-name { font-weight: 600; white-space: nowrap; }
.empty { text-align: center; color: var(--m-fg-3); padding: 28px; }

.rate-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: var(--m-r-pill); }
.rate-badge.danger { background: var(--m-danger-soft); color: var(--m-danger); }
.rate-badge.warning { background: var(--m-warning-soft); color: var(--m-warning); }
.rate-badge.success { background: var(--m-success-soft); color: var(--m-success); }
.rate-badge.muted { background: var(--m-gray-150); color: var(--m-fg-3); }

.commitment-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.commitment-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--m-gray-150); }
.commitment-row:last-child { border-bottom: none; }
.commitment-count { font-size: 14px; font-weight: 700; color: var(--m-gray-900); }
</style>
