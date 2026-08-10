<template>
  <SidebarLayout title="Statistics">
    <div class="mega-scope stats-page">

      <!-- ============ SCOPED view: Sales Agent (TL) & QC (agent) ============ -->
      <template v-if="isScopedRole">
        <div class="toolbar">
          <div class="sa-title">{{ scopeTitle }}</div>
          <span class="refresh-hint">{{ scopeHint }}</span>
        </div>

        <div v-if="loadingMine && !myOverview" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 3" :key="i"></div>
        </div>

        <template v-else-if="myOverview">
          <!-- Satu panel: KPI cards + grafik AI Status. Filter tanggal di atas ikut
               meng-apply ke KPI karena semuanya diturunkan dari time series yang sama. -->
          <div class="panel">
            <div class="panel-title">AI Status (Approve / Reject) — per waktu</div>
            <div class="chart-filter">
              <div class="gran-group">
                <button v-for="g in GRANULARITIES" :key="g.key"
                        :class="['gran-btn', { active: granularity === g.key }]"
                        @click="granularity = g.key; periodOffset = 0">{{ g.label }}</button>
              </div>
              <div class="period-nav">
                <button class="nav-btn" :disabled="hasDateFilter" @click="shiftPeriod(-1)"
                        title="Periode sebelumnya" aria-label="Periode sebelumnya">‹</button>
                <span class="nav-range">{{ currentRangeLabel || '—' }}</span>
                <button class="nav-btn" :disabled="hasDateFilter || periodOffset >= 0" @click="shiftPeriod(1)"
                        title="Periode berikutnya" aria-label="Periode berikutnya">›</button>
              </div>
              <div class="date-range">
                <label class="dr-label">Dari</label>
                <input type="date" v-model="dateStart" class="date-input" @change="periodOffset = 0" />
                <label class="dr-label">s/d</label>
                <input type="date" v-model="dateEnd" class="date-input" @change="periodOffset = 0" />
                <button v-if="dateStart || dateEnd" class="clear-btn" @click="dateStart = ''; dateEnd = ''; periodOffset = 0">Reset</button>
              </div>
            </div>

            <div class="kpis">
              <div class="kpi" style="--accent: var(--m-info)">
                <div class="kpi-label">Total Submisi Tiket</div>
                <div class="kpi-value mono">{{ fmt(myDonutSubmissions) }}</div>
                <div class="kpi-sub">{{ fmt(myDonutDone) }} selesai · {{ fmt(myDonutInProgress) }} diproses</div>
              </div>
              <div class="kpi" style="--accent: var(--m-success)">
                <div class="kpi-label">Tiket Approve</div>
                <div class="kpi-value mono">{{ fmt(myDonutApprove) }}</div>
                <div class="kpi-sub">approve dari {{ fmt(myDonutTotal) }} dinilai</div>
              </div>
              <div class="kpi" style="--accent: var(--m-danger)">
                <div class="kpi-label">Tiket Reject</div>
                <div class="kpi-value mono">{{ fmt(myDonutReturn) }}</div>
                <div class="kpi-sub">reject dari {{ fmt(myDonutTotal) }} dinilai</div>
              </div>
              <div class="kpi" :style="{ '--accent': rateColor(myDonutErrorRate) }">
                <div class="kpi-label">Error Rate</div>
                <div class="kpi-value mono" :style="{ color: rateColor(myDonutErrorRate) }">{{ myDonutErrorRate }}%</div>
                <div class="kpi-sub">{{ fmt(myDonutReturn) }} / {{ fmt(myDonutTotal) }} dinilai</div>
              </div>
            </div>

            <div class="stack-row">
              <div class="stack-wrap">
                <Bar :data="scopedChartData" :options="stackedOptions" :plugins="[barPct]" />
              </div>
              <div class="legend">
                <div class="legend-title">Persentase Hasil Penilaian AI</div>
                <div class="legend-caption">Perbandingan approve vs reject ({{ granularityLabel }}) · angka di atas batang = total submisi</div>
                <div class="legend-item legend-cols">
                  <span class="legend-dot" style="background: transparent"></span>
                  <span class="legend-label legend-cap">Status</span>
                  <span class="legend-val legend-cap">Jumlah</span>
                  <span class="legend-pct legend-cap">Persen</span>
                </div>
                <div class="legend-item" v-for="it in myDonutLegend" :key="it.label">
                  <span class="legend-dot" :style="{ background: it.color }"></span>
                  <span class="legend-label">{{ it.label }}</span>
                  <span class="legend-val mono">{{ fmt(it.value) }}</span>
                  <span class="legend-pct mono">{{ it.pct }}%</span>
                </div>
                <div class="legend-item legend-total">
                  <span class="legend-dot" style="background: transparent"></span>
                  <span class="legend-label">Total Dinilai</span>
                  <span class="legend-val mono">{{ fmt(myDonutTotal) }}</span>
                  <span class="legend-pct mono"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Team Leader: daftar sales agent yang di-assign; Sales Agent: daftar tiket -->
          <div v-if="isTeamLeader" class="panel">
            <div class="panel-title">Daftar Sales Agent Tim Anda</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Sales Agent</th>
                    <th>NIP</th>
                    <th class="num">Submissions</th>
                    <th class="num">Errors</th>
                    <th class="rate-col">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loadingMine"><td colspan="5" class="empty"><span class="spin-inline"></span> Memuat...</td></tr>
                  <tr v-else-if="!teamAgents.length"><td colspan="5" class="empty">Belum ada sales agent di tim Anda.</td></tr>
                  <tr v-for="a in teamAgents" :key="a.agent_id" :class="{ risky: a.error_rate >= 10 }">
                    <td>
                      <span class="cell-agent">
                        <span class="avatar sm" :style="{ background: 'var(--m-gray-150)', color: 'var(--m-gray-700)' }">{{ initials(a.name) }}</span>
                        {{ a.name }}
                      </span>
                    </td>
                    <td class="mono">{{ a.nip_baru || '—' }}</td>
                    <td class="num mono">{{ fmt(a.submissions) }}</td>
                    <td class="num mono" :style="{ color: a.errors ? 'var(--m-danger)' : 'var(--m-gray-400)' }">{{ fmt(a.errors) }}</td>
                    <td class="rate-col">
                      <span class="rate-badge mono" :class="rateClass(a.error_rate)">{{ a.error_rate }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="panel">
            <div class="panel-title">{{ scopeListTitle }}</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Campaign</th>
                    <th class="num">Calls</th>
                    <th>Status</th>
                    <th>AI Status</th>
                    <th>Tanggal Upload</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loadingTickets"><td colspan="6" class="empty"><span class="spin-inline"></span> Memuat...</td></tr>
                  <tr v-else-if="!tickets.length"><td colspan="6" class="empty">{{ scopeEmpty }}</td></tr>
                  <tr v-for="t in tickets" :key="t.result_id">
                    <td class="campaign-name">{{ t.id || '—' }}</td>
                    <td>{{ t.campaign || '—' }}</td>
                    <td class="num mono">{{ t.num_calls ?? '—' }}</td>
                    <td><span class="pill" :class="statusPill(t.status)">{{ t.status }}</span></td>
                    <td>
                      <span v-if="t.ai_status" class="pill" :class="t.ai_status === 'PASS' ? 'ok' : 'bad'">{{ aiStatusLabel(t.ai_status) }}</span>
                      <span v-else>—</span>
                    </td>
                    <td>{{ fmtDate(t.uploaded_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="note">Menampilkan {{ tickets.length }} dari {{ fmt(ticketsTotal) }} tiket. Detail lengkap ada di menu <b>Results</b>.</div>
          </div>
        </template>
      </template>

      <!-- ==================== QC / SPQ HEAD view ==================== -->
      <template v-else>

      <!-- Tabs -->
      <div class="toolbar">
        <div class="tab-group">
          <button :class="['tab', { active: tab === 'overview' }]" @click="tab = 'overview'">Overview</button>
          <button :class="['tab', { active: tab === 'hierarchy' }]" @click="openHierarchy">Hierarki Error Rate</button>
        </div>
        <span class="refresh-hint">Update otomatis saat ada data baru · auto-refresh 30 detik</span>
      </div>

      <!-- ============================ OVERVIEW ============================ -->
      <template v-if="tab === 'overview'">
        <div v-if="loadingOverview && !overview" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 4" :key="i"></div>
        </div>

        <template v-else-if="overview">
          <!-- Campaign filter: slices KPI cards, donut, dan tabel Performa Sales
               per campaign (kosong = seluruh campaign). -->
          <div class="cf-row">
            <label class="cf-label">Campaign</label>
            <select v-model="campaignFilter" class="month-select">
              <option value="">Semua Campaign</option>
              <option v-for="c in campaignOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <!-- Satu panel: KPI cards (Total Submissions/Approve/Reject/Error Rate) +
               grafik AI Status. Filter tanggal di atas ikut meng-apply ke KPI karena
               semuanya diturunkan dari time series yang sama (bukan snapshot). -->
          <div class="panel">
            <div class="panel-title">AI Status (Approve / Reject) — per waktu</div>
            <div class="chart-filter">
              <div class="gran-group">
                <button v-for="g in GRANULARITIES" :key="g.key"
                        :class="['gran-btn', { active: granularity === g.key }]"
                        @click="granularity = g.key; periodOffset = 0">{{ g.label }}</button>
              </div>
              <div class="period-nav">
                <button class="nav-btn" :disabled="hasDateFilter" @click="shiftPeriod(-1)"
                        title="Periode sebelumnya" aria-label="Periode sebelumnya">‹</button>
                <span class="nav-range">{{ currentRangeLabel || '—' }}</span>
                <button class="nav-btn" :disabled="hasDateFilter || periodOffset >= 0" @click="shiftPeriod(1)"
                        title="Periode berikutnya" aria-label="Periode berikutnya">›</button>
              </div>
              <div class="date-range">
                <label class="dr-label">Dari</label>
                <input type="date" v-model="dateStart" class="date-input" @change="periodOffset = 0" />
                <label class="dr-label">s/d</label>
                <input type="date" v-model="dateEnd" class="date-input" @change="periodOffset = 0" />
                <button v-if="dateStart || dateEnd" class="clear-btn" @click="dateStart = ''; dateEnd = ''; periodOffset = 0">Reset</button>
              </div>
            </div>

            <div class="kpis">
              <div class="kpi" style="--accent: var(--m-info)">
                <div class="kpi-label">Total Submissions</div>
                <div class="kpi-value mono">{{ fmt(donutSubmissions) }}</div>
                <div class="kpi-sub">{{ fmt(donutDone) }} selesai · {{ fmt(donutInProgress) }} diproses</div>
              </div>
              <div class="kpi" style="--accent: var(--m-success)">
                <div class="kpi-label">Total Approve</div>
                <div class="kpi-value mono">{{ fmt(donutApprove) }}</div>
                <div class="kpi-sub">approve dari {{ fmt(donutTotal) }} dinilai</div>
              </div>
              <div class="kpi" style="--accent: var(--m-danger)">
                <div class="kpi-label">Total Reject</div>
                <div class="kpi-value mono">{{ fmt(donutReturn) }}</div>
                <div class="kpi-sub">reject dari {{ fmt(donutTotal) }} dinilai</div>
              </div>
              <div class="kpi" :style="{ '--accent': rateColor(donutErrorRate) }">
                <div class="kpi-label">Error Rate</div>
                <div class="kpi-value mono" :style="{ color: rateColor(donutErrorRate) }">{{ donutErrorRate }}%</div>
                <div class="kpi-sub">{{ fmt(donutReturn) }} / {{ fmt(donutTotal) }} dinilai</div>
              </div>
            </div>

            <div class="stack-row">
              <div class="stack-wrap">
                <Bar :data="globalChartData" :options="stackedOptions" :plugins="[barPct]" />
              </div>
              <div class="legend">
                <div class="legend-title">Persentase Hasil Penilaian AI</div>
                <div class="legend-caption">Perbandingan approve vs reject ({{ granularityLabel }}) · angka di atas batang = total submisi</div>
                <div class="legend-item legend-cols">
                  <span class="legend-dot" style="background: transparent"></span>
                  <span class="legend-label legend-cap">Status</span>
                  <span class="legend-val legend-cap">Jumlah</span>
                  <span class="legend-pct legend-cap">Persen</span>
                </div>
                <div class="legend-item" v-for="it in donutLegend" :key="it.label">
                  <span class="legend-dot" :style="{ background: it.color }"></span>
                  <span class="legend-label">{{ it.label }}</span>
                  <span class="legend-val mono">{{ fmt(it.value) }}</span>
                  <span class="legend-pct mono">{{ it.pct }}%</span>
                </div>
                <div class="legend-item legend-total">
                  <span class="legend-dot" style="background: transparent"></span>
                  <span class="legend-label">Total Dinilai</span>
                  <span class="legend-val mono">{{ fmt(donutTotal) }}</span>
                  <span class="legend-pct mono"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- ============ PERFORMA CAMPAIGN (BULANAN) — di bawah pie chart ============ -->
          <div v-if="loadingCampaign && !campaignData" class="skeleton-wrap">
            <div class="skeleton" v-for="i in 3" :key="i" style="height:44px"></div>
          </div>
          <div v-else-if="campaignData" class="panel">
            <div class="panel-title-row">
              <div class="panel-title">Performa Campaign — Month to Month</div>
              <select v-model="filterMonth" class="month-select">
                <option value="">Semua Bulan</option>
                <option v-for="m in campaignData.months" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
            </div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th>Campaign</th>
                    <th class="num">Submission</th>
                    <th class="num">High</th>
                    <th class="num">Medium</th>
                    <th class="num">Low</th>
                    <th v-if="showRiskSystemNew" class="num">System</th>
                    <th v-if="showRiskSystemNew" class="num">New</th>
                    <th class="num">Total Risk (H+M+L)</th>
                    <th class="rate-col">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!campaignRows.length"><td :colspan="showRiskSystemNew ? 10 : 8" class="empty">Belum ada data.</td></tr>
                  <tr v-for="row in campaignRows" :key="row.campaign + row.month">
                    <td class="mono">{{ monthLabel(row.month) }}</td>
                    <td class="campaign-name">{{ row.campaign }}</td>
                    <td class="num mono">{{ fmt(row.submissions) }}</td>
                    <td class="num mono" style="color: var(--m-danger)">{{ fmt(row.high) }}</td>
                    <td class="num mono" style="color: var(--m-warning)">{{ fmt(row.medium) }}</td>
                    <td class="num mono" style="color: var(--m-info)">{{ fmt(row.low) }}</td>
                    <td v-if="showRiskSystemNew" class="num mono">{{ fmt(row.system) }}</td>
                    <td v-if="showRiskSystemNew" class="num mono">{{ fmt(row.new) }}</td>
                    <td class="num mono" style="font-weight: 700">{{ fmt(row.total_risk) }}</td>
                    <td class="rate-col">
                      <span class="rate-badge mono" :class="rateClass(row.error_rate)">{{ row.error_rate }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="note">
              Tiap tiket dihitung <b>satu</b> Risk Base tertinggi saja (urutan H &gt; M &gt; L &gt; N &gt; O).
              <b>High</b>/<b>Medium</b>/<b>Low</b> = jumlah tiket dengan risk tertinggi H/M/L<template v-if="showRiskSystemNew"> ·
              <b>System</b> = kode O ·
              <b>New</b> = kode N (Risk Base L/M yang disoftening untuk agent baru, hanya saat grace period)</template> ·
              <b>Total Risk</b> = High + Medium + Low.
            </div>
          </div>

          <!-- Sales performance table -->
          <div class="panel">
            <div class="panel-title">Performa Sales</div>
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th>Sales Agent</th>
                    <th v-if="showTeamLeaderCol">Team Leader</th>
                    <th v-if="showAreaManagerCol">Area Manager</th>
                    <th>Campaign</th>
                    <th class="num">Submissions</th>
                    <th class="num">Errors</th>
                    <th class="rate-col">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!agents.length"><td :colspan="salesColCount" class="empty">Belum ada data.</td></tr>
                  <tr v-for="a in agents" :key="a.agent_id + a.name" :class="{ risky: a.error_rate >= 10 }">
                    <td>
                      <span class="cell-agent">
                        <span class="avatar sm" :style="{ background: 'var(--m-gray-150)', color: 'var(--m-gray-700)' }">{{ initials(a.name) }}</span>
                        {{ a.name }}
                      </span>
                    </td>
                    <td v-if="showTeamLeaderCol">{{ a.team_leader || '—' }}</td>
                    <td v-if="showAreaManagerCol">{{ a.area_manager || '—' }}</td>
                    <td>{{ a.campaign }}</td>
                    <td class="num mono">{{ fmt(a.submissions) }}</td>
                    <td class="num mono" :style="{ color: a.errors ? 'var(--m-danger)' : 'var(--m-gray-400)' }">{{ fmt(a.errors) }}</td>
                    <td class="rate-col">
                      <span class="rate-badge mono" :class="rateClass(a.error_rate)">{{ a.error_rate }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </template>

      <!-- ==================== HIERARKI ERROR RATE ==================== -->
      <template v-else-if="tab === 'hierarchy'">
        <div v-if="loadingHierarchy && !hierarchy" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 4" :key="i" style="height:44px"></div>
        </div>
        <template v-else-if="hierarchy">
          <div class="kpis">
            <div class="kpi" style="--accent: var(--m-info)">
              <div class="kpi-label">All Telesales — Submissions</div>
              <div class="kpi-value mono">{{ fmt(hierarchy.all_telesales.submissions) }}</div>
            </div>
            <div class="kpi" :style="{ '--accent': rateColor(hierarchy.all_telesales.error_rate) }">
              <div class="kpi-label">All Telesales — Error Rate</div>
              <div class="kpi-value mono" :style="{ color: rateColor(hierarchy.all_telesales.error_rate) }">{{ hierarchy.all_telesales.error_rate }}%</div>
              <div class="kpi-sub">{{ fmt(hierarchy.all_telesales.errors) }} reject / {{ fmt(hierarchy.all_telesales.submissions) }} submissions</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Area Manager → Team Leader → Agent</div>
            <div class="table-scroll">
              <table class="mtable tree hier">
                <!-- Lebar dikunci eksplisit (bersama table-layout: fixed). Tanpa ini
                     browser melebarkan tiap kolom mengikuti panjang HEADER-nya, jadi
                     kolom angka punya lebar berbeda-beda dan angkanya tidak segaris. -->
                <colgroup>
                  <col />
                  <col style="width: 96px" />
                  <template v-if="showRiskBase">
                    <col style="width: 88px" />
                    <col style="width: 78px" />
                    <col style="width: 70px" />
                    <col style="width: 78px" />
                    <col style="width: 64px" />
                    <template v-if="showRiskSystemNew">
                      <col style="width: 76px" />
                      <col style="width: 64px" />
                    </template>
                    <col style="width: 82px" />
                  </template>
                  <col v-else style="width: 88px" />
                  <col style="width: 104px" />
                </colgroup>
                <thead>
                  <!-- Dua tingkat: kelima Risk Base dikelompokkan di bawah "Risk Base"
                       supaya tidak terbaca sebagai kolom sejajar Submissions/Approve.
                       Untuk sisi sales (showRiskBase = false) seluruh blok itu hilang
                       dan header cukup satu baris. -->
                  <tr>
                    <th :rowspan="showRiskBase ? 2 : 1">Nama</th>
                    <th :rowspan="showRiskBase ? 2 : 1" class="num col-n">Submissions</th>
                    <th v-if="showRiskBase" rowspan="2" class="num col-n">Approve</th>
                    <th :rowspan="showRiskBase ? 2 : 1" class="num col-n">{{ showRiskBase ? 'Reject' : 'Errors' }}</th>
                    <th v-if="showRiskBase" :colspan="showRiskSystemNew ? 5 : 3" class="grp-head">Risk Base</th>
                    <th v-if="showRiskBase" rowspan="2" class="num col-n">Total Risk</th>
                    <th :rowspan="showRiskBase ? 2 : 1" class="num rate-col">Error Rate</th>
                  </tr>
                  <tr v-if="showRiskBase">
                    <th class="num col-n grp-cell grp-first">High</th>
                    <th class="num col-n grp-cell">Medium</th>
                    <th class="num col-n grp-cell" :class="{ 'grp-last': !showRiskSystemNew }">Low</th>
                    <th v-if="showRiskSystemNew" class="num col-n grp-cell">System</th>
                    <th v-if="showRiskSystemNew" class="num col-n grp-cell grp-last">New</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!hierarchy.area_managers.length"><td :colspan="hierColCount" class="empty">Belum ada data.</td></tr>
                  <template v-for="am in hierarchy.area_managers" :key="'am'+am.name">
                    <tr class="lvl-am" @click="toggle('am', am.name)">
                      <td>
                        <span class="twist">{{ isOpen('am', am.name) ? '▾' : '▸' }}</span>
                        <span class="lvl-tag am">AM</span> {{ am.name }}
                      </td>
                      <RiskCells :n="am" />
                    </tr>
                    <template v-if="isOpen('am', am.name)">
                      <template v-for="tl in am.team_leaders" :key="'tl'+am.name+tl.name">
                        <tr class="lvl-tl" @click="toggle('tl', am.name + '|' + tl.name)">
                          <td class="pad-1">
                            <span class="twist">{{ isOpen('tl', am.name + '|' + tl.name) ? '▾' : '▸' }}</span>
                            <span class="lvl-tag tl">TL</span> {{ tl.name }}
                          </td>
                          <RiskCells :n="tl" />
                        </tr>
                        <template v-if="isOpen('tl', am.name + '|' + tl.name)">
                          <tr class="lvl-ag" v-for="ag in tl.agents" :key="'ag'+ag.agent_id+ag.name">
                            <td class="pad-2"><span class="lvl-tag tlo">TLO</span> {{ ag.name }}</td>
                            <RiskCells :n="ag" />
                          </tr>
                        </template>
                      </template>
                    </template>
                  </template>
                </tbody>
              </table>
            </div>
            <div v-if="showRiskBase" class="note">
              <b>Error Rate</b> = tiket <b>Reject</b> ÷ Submissions. Kolom Risk Base
              ({{ showRiskSystemNew ? 'High/Medium/Low/System/New' : 'High/Medium/Low' }}) bersifat konteks dan <b>tidak</b> membentuk Error Rate —
              tiap tiket dihitung satu Risk Base tertinggi saja (urutan H &gt; M &gt; L &gt; N &gt; O).
              <b>Total Risk</b> = High + Medium + Low saja<template v-if="showRiskSystemNew">; System dan New tidak ikut dijumlahkan</template>.
              Rumus Total Risk ÷ Submission dipakai di tabel <b>Performa Campaign</b>, bukan di sini.
            </div>
            <div v-else class="note">
              <b>Error Rate</b> = <b>Errors</b> ÷ Submissions. Klik baris AM atau TL untuk membuka level di bawahnya.
            </div>
          </div>

          <!-- Daftar QC — hanya untuk pengelola divisi QC (TL QC / SPQ Head / Admin). -->
          <div v-if="canSeeQcTable" class="panel">
            <div class="panel-title">Daftar QC</div>
            <div class="table-scroll">
              <table class="mtable tree">
                <thead>
                  <tr>
                    <th>QC</th>
                    <th class="num col-n">Assigned</th>
                    <th class="num col-n">Approved</th>
                    <th class="num rate-col">Approve Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loadingQcPerf"><td colspan="4" class="empty"><span class="spin-inline"></span> Memuat...</td></tr>
                  <tr v-else-if="!qcPerformance.length"><td colspan="4" class="empty">Belum ada akun QC.</td></tr>
                  <tr v-for="q in qcPerformance" :key="q.qc_username" class="lvl-ag">
                    <td><span class="lvl-tag qc">QC</span> {{ q.name }}</td>
                    <td class="num mono col-n" :class="{ zero: !q.assigned }">{{ fmt(q.assigned) }}</td>
                    <td class="num mono col-n" :class="{ zero: !q.approved }" :style="q.approved ? { color: 'var(--m-success)' } : null">{{ fmt(q.approved) }}</td>
                    <td class="rate-col">
                      <span class="rate-badge mono" :class="approveRateClass(q.approve_rate, q.assigned)">{{ q.approve_rate }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="note">
              <b>Assigned</b> = tiket yang ditugaskan ke QC tersebut · <b>Approved</b> = tiket yang sudah
              ditandai dicek manual olehnya · <b>Approve Rate</b> = Approved ÷ Assigned. Tiket yang
              dipindah ke QC lain tidak lagi dihitung untuk pemilik lama.
            </div>
          </div>
        </template>
      </template>

      </template>
      <!-- end QC/SPQ view -->

    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, h } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import SidebarLayout from '../../components/SidebarLayout.vue'
import { useDataStore } from '../../stores/data.js'
import { useAuthStore } from '../../stores/auth.js'
import { aiStatusLabel } from '../../utils/aiStatus.js'
import '../../assets/mega.css'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const dataStore = useDataStore()
const auth = useAuthStore()
const isSalesAgent = computed(() => auth.user?.role === 'sales_agent')
const isTeamLeader = computed(() => auth.user?.role === 'team_leader')
// Team Leader (team) & Sales Agent (own) get the scoped view; only labels differ.
// Area Manager & Telesales Head memakai dashboard global (Overview + tab Hierarki
// Error Rate) seperti spq_head/qc — bedanya pohon hierarki untuk AM sudah difilter
// backend ke node AM-nya sendiri (lihat stats_hierarchy di api/routers/stats.py).
const isScopedRole = computed(() => isSalesAgent.value || isTeamLeader.value)
const scopeTitle = computed(() => (isTeamLeader.value ? 'Statistik Tim Anda' : 'Statistik Anda'))
const scopeHint = computed(() => (isTeamLeader.value
  ? 'Hanya tiket agent di bawah Anda · auto-refresh 30 detik'
  : 'Hanya tiket Anda · auto-refresh 30 detik'))
const scopeListTitle = computed(() => (isTeamLeader.value ? 'Daftar Ticket ID Tim Anda' : 'Daftar Ticket ID Anda'))
const scopeEmpty = computed(() => (isTeamLeader.value ? 'Belum ada tiket untuk tim Anda.' : 'Belum ada tiket untuk Anda.'))

// Kolom Approve, Risk Base (High/Medium/Low/System/New) dan Total Risk adalah
// detail internal QC — sisi sales hanya melihat Submissions, Errors, Error Rate
// (sama seperti tampilan TLO). Berlaku juga untuk Telesales Head, yang scope-nya
// global tapi tetap sisi sales.
const SALES_SIDE_ROLES = ['sales_agent', 'team_leader', 'area_manager', 'telesales_head']
const showRiskBase = computed(() => !SALES_SIDE_ROLES.includes(auth.user?.role))

// Risk Base "System" (kode O) & "New" (kode N) adalah detail internal scoring —
// hanya untuk SPQ Head/Admin dan Team Leader QC. QC biasa dan QC Support melihat
// High/Medium/Low + Total Risk saja. Total Risk = H+M+L, jadi angkanya tetap utuh
// tanpa kedua kolom ini.
// "demo" (read-only showcase) mirrors the SPQ dashboard, incl. System/New risk cols.
const RISK_SYSTEM_NEW_ROLES = ['spq_head', 'admin', 'team_leader_qc', 'demo']
const showRiskSystemNew = computed(() => RISK_SYSTEM_NEW_ROLES.includes(auth.user?.role))

// Performa Sales: atasan perlu tahu agent ini di bawah siapa. Area Manager
// melihat kolom Team Leader (satu tingkat di bawahnya); Telesales Head melihat
// kolom Area Manager karena cakupannya lintas area.
const showTeamLeaderCol = computed(() => auth.user?.role === 'area_manager')
const showAreaManagerCol = computed(() => auth.user?.role === 'telesales_head')
const salesColCount = computed(
  () => 5 + (showTeamLeaderCol.value ? 1 : 0) + (showAreaManagerCol.value ? 1 : 0))

// Jumlah kolom tabel Hierarki Error Rate, mengikuti kedua flag di atas:
//   Nama + Submissions + Error Rate = 3 dasar
//   + Approve, Total Risk, High, Medium, Low  (showRiskBase)
//   + System, New                             (showRiskSystemNew)
const hierColCount = computed(() => {
  if (!showRiskBase.value) return 4 // Nama, Submissions, Errors, Error Rate
  return showRiskSystemNew.value ? 11 : 9
})

// ---- Sales Agent (Team Leader) scoped view ----
const myOverview = ref(null)
const loadingMine = ref(true)
const tickets = ref([])
const ticketsTotal = ref(0)
const loadingTickets = ref(false)
const teamAgents = ref([]) // Team Leader: roster of their sales agents + per-agent stats

const tab = ref('overview')
// Full /stats/overview payload; overview/agents are derived from it so the
// campaign filter can slice per-campaign without a refetch.
const snapshot = ref(null)
const campaignFilter = ref('') // '' = Semua Campaign
// Dropdown options come from the ACTIVE campaign list (/list_campaigns), not from
// whatever happens to appear in the snapshot — so an active campaign with no data
// yet is still selectable (it just shows zeroed KPIs via the fallback below).
const campaignOptions = ref([])
// Zeroed overview shown when a selected campaign has no snapshot data yet.
const EMPTY_OVERVIEW = {
  total_submissions: 0, done: 0, processing: 0, pending: 0, failed: 0,
  evaluated: 0, error_count: 0, error_rate: 0,
  status_breakdown: { done: 0, in_progress: 0, failed: 0 },
  ai_status_breakdown: { approve: 0, return: 0 },
}
// Look up a per-campaign entry by name. The snapshot keys come from Result.campaign
// (trimmed) while the dropdown value comes from the campaign list, so match exactly
// first, then fall back to a trim/case-insensitive match to survive minor name drift.
function pickByCampaign(map, name) {
  if (!map) return undefined
  if (name in map) return map[name]
  const key = String(name).trim().toLowerCase()
  const hit = Object.keys(map).find((k) => k.trim().toLowerCase() === key)
  return hit != null ? map[hit] : undefined
}
const overview = computed(() => {
  const s = snapshot.value
  if (!s) return null
  if (campaignFilter.value) return pickByCampaign(s.overview_by_campaign, campaignFilter.value) || EMPTY_OVERVIEW
  return s.overview
})
const agents = computed(() => {
  const s = snapshot.value
  if (!s) return []
  if (campaignFilter.value) return pickByCampaign(s.agents_by_campaign, campaignFilter.value) || []
  return s.agents || []
})
const campaignData = ref(null)
const hierarchy = ref(null)

// ---- AI status time series (100% stacked column) + date filter ----
// Shared by both the scoped and global chart render sites.
const GRANULARITIES = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'quarterly', label: 'Kuartal' },
  { key: 'semester', label: 'Semester' },
  { key: 'yearly', label: 'Tahunan' },
]
const granularity = ref('monthly')   // default view: monthly (last 4 months)
const dateStart = ref('')            // '' = backend default window; else 'YYYY-MM-DD'
const dateEnd = ref('')
const periodOffset = ref(0)          // Prev/Next paging: 0 = latest window, <0 = older
const globalSeries = ref(null)       // { granularity, start, end, buckets } for QC/global view
const myScopedSeries = ref(null)     // ...for Sales Agent / Team Leader scoped view
const loadingSeries = ref(false)

const loadingOverview = ref(true)
const loadingCampaign = ref(false)
const loadingHierarchy = ref(false)
let timer = null

const STATUS_COLORS = { done: '#1F8A4C', in_progress: '#C98A00', failed: '#C73838' }
// AI status donut: PASS = Approve (green), FAIL = Return (red).
const AI_COLORS = { approve: '#1F8A4C', return: '#C73838' }

// Build a 100% stacked column: X = time buckets, Y = 0–100%, two stacked series
// (Approve green / Reject red). Percentages are precomputed per bucket; the raw
// counts ride along on ``_counts`` for the tooltip.
function stackedData(series) {
  const buckets = series?.buckets || []
  const labels = buckets.map((b) => b.label)
  const approvePct = [], returnPct = [], approveCnt = [], returnCnt = []
  for (const b of buckets) {
    const a = b.approve || 0, r = b.return || 0, t = a + r
    approveCnt.push(a); returnCnt.push(r)
    approvePct.push(t ? (a / t) * 100 : 0)
    returnPct.push(t ? (r / t) * 100 : 0)
  }
  return {
    labels,
    datasets: [
      { label: 'Approve', data: approvePct, backgroundColor: AI_COLORS.approve, stack: 'ai', _counts: approveCnt, maxBarThickness: 46 },
      { label: 'Reject', data: returnPct, backgroundColor: AI_COLORS.return, stack: 'ai', _counts: returnCnt, maxBarThickness: 46 },
    ],
  }
}
const stackedOptions = {
  responsive: true, maintainAspectRatio: false,
  layout: { padding: { top: 24 } }, // ruang di atas batang untuk label total submisi
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } },
    y: { stacked: true, min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + '%' }, grid: { color: 'rgba(0,0,0,.06)' } },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const cnt = ctx.dataset._counts?.[ctx.dataIndex] ?? 0
          return ` ${ctx.dataset.label}: ${cnt.toLocaleString('id-ID')} (${(ctx.raw ?? 0).toFixed(1)}%)`
        },
      },
    },
  },
}
// Inline plugin: write each segment's percentage (white, bold) centred in its
// stacked bar. Skips segments too short/narrow to fit the label so dense views
// (e.g. 30 daily columns) or tiny slices don't turn into clutter.
const barPct = {
  id: 'barPct',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = '700 12px "Plus Jakarta Sans", Inter, system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,.35)'
    ctx.shadowBlur = 3
    // 1) percentage centred inside each Approve/Reject segment
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return
      meta.data.forEach((bar, i) => {
        const v = Number(ds.data[i]) || 0
        if (!v) return
        const height = Math.abs(bar.base - bar.y)
        if (height < 14 || bar.width < 18) return // too small to label legibly
        ctx.fillText(`${Math.round(v)}%`, bar.x, (bar.y + bar.base) / 2)
      })
    })
    // 2) total submissions (approve + reject) above each column
    const meta0 = chart.getDatasetMeta(0)
    const cA = chart.data.datasets[0]?._counts || []
    const cR = chart.data.datasets[1]?._counts || []
    const yTop = chart.chartArea.top - 9
    ctx.shadowBlur = 0
    ctx.fillStyle = '#334155'
    ctx.font = '800 12px "Plus Jakarta Sans", Inter, system-ui, -apple-system, sans-serif'
    meta0.data.forEach((bar, i) => {
      const total = (Number(cA[i]) || 0) + (Number(cR[i]) || 0)
      if (!total || bar.width < 14) return
      ctx.fillText(total.toLocaleString('id-ID'), bar.x, yTop)
    })
    ctx.restore()
  },
}

// Totals across all buckets in the current range — feeds the KPI cards + legend.
function seriesTotals(series) {
  let a = 0, r = 0, s = 0, dn = 0, ip = 0
  for (const b of series?.buckets || []) {
    a += b.approve || 0; r += b.return || 0
    s += b.submissions || 0; dn += b.done || 0; ip += b.in_progress || 0
  }
  return { approve: a, return: r, total: a + r, submissions: s, done: dn, in_progress: ip }
}
function aiDonutLegend(b) {
  const a = b?.approve || 0, r = b?.return || 0
  const total = (a + r) || 1
  const pct = v => ((v / total) * 100).toFixed(1)
  return [
    { label: 'Approve', value: a, color: AI_COLORS.approve, pct: pct(a) },
    { label: 'Reject', value: r, color: AI_COLORS.return, pct: pct(r) },
  ]
}

// ---- formatting / color helpers ----
function fmt(n) { return (n ?? 0).toLocaleString('id-ID') }

function initials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

// Ambang warna error rate: 0–<3% hijau, 3–6% kuning, >6% merah.
function rateColor(r) {
  if (r > 6) return 'var(--m-danger)'
  if (r >= 3) return 'var(--m-warning)'
  return 'var(--m-success)'
}
function rateClass(r) {
  if (r > 6) return 'danger'
  if (r >= 3) return 'warning'
  return 'success'
}

function monthLabel(m) {
  if (!m) return m
  const [y, mm] = m.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${names[parseInt(mm, 10) - 1] || mm} ${y}`
}

// ---- chart data (100% stacked column) + KPI/legend totals over the date range ----
const globalChartData = computed(() => stackedData(globalSeries.value))
const scopedChartData = computed(() => stackedData(myScopedSeries.value))
const granularityLabel = computed(() =>
  GRANULARITIES.find((g) => g.key === granularity.value)?.label || 'Bulanan')

// Global (QC / SPQ Head / Area Manager / Telesales Head) KPI + legend totals —
// summed over the selected date range so the cards match the chart.
const globalTotals = computed(() => seriesTotals(globalSeries.value))
const donutTotal = computed(() => globalTotals.value.total)
const donutApprove = computed(() => globalTotals.value.approve)
const donutReturn = computed(() => globalTotals.value.return)
const donutSubmissions = computed(() => globalTotals.value.submissions)
const donutDone = computed(() => globalTotals.value.done)
const donutInProgress = computed(() => globalTotals.value.in_progress)
const donutErrorRate = computed(() =>
  donutTotal.value ? +(donutReturn.value / donutTotal.value * 100).toFixed(1) : 0)
const donutLegend = computed(() => aiDonutLegend({ approve: donutApprove.value, return: donutReturn.value }))

// ---- scoped (Sales Agent / Team Leader) KPI + legend totals ----
const scopedTotals = computed(() => seriesTotals(myScopedSeries.value))
const myDonutTotal = computed(() => scopedTotals.value.total)
const myDonutApprove = computed(() => scopedTotals.value.approve)
const myDonutReturn = computed(() => scopedTotals.value.return)
const myDonutSubmissions = computed(() => scopedTotals.value.submissions)
const myDonutDone = computed(() => scopedTotals.value.done)
const myDonutInProgress = computed(() => scopedTotals.value.in_progress)
const myDonutErrorRate = computed(() =>
  myDonutTotal.value ? +(myDonutReturn.value / myDonutTotal.value * 100).toFixed(1) : 0)
const myDonutLegend = computed(() => aiDonutLegend({ approve: myDonutApprove.value, return: myDonutReturn.value }))
function statusPill(s) {
  return { done: 'ok', processing: 'info', pending: 'warn', failed: 'bad' }[s] || 'muted'
}
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? String(v) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---- campaign performance (Submission / Risk Base breakdown / Error Rate), month-to-month ----
const filterMonth = ref('') // '' = "Semua Bulan"; defaults to the latest month once loaded
const campaignRows = computed(() => {
  const rows = campaignData.value?.rows || []
  return filterMonth.value ? rows.filter((r) => r.month === filterMonth.value) : rows
})

// Shared numeric cells for every level of the Hierarki Error Rate tree
// (AM / TL / TLO) — the payload carries the same field block at each level, so
// one renderer keeps the three rows from drifting apart.
const RiskCells = (p) => {
  const n = p.n || {}
  // A zero is noise, not a finding — render it muted so the eye lands on the
  // counts that actually matter. Colour is only applied to non-zero values.
  const cell = (v, color, extra = []) => h(
    'td',
    { class: ['num', 'mono', 'col-n', ...extra, !v ? 'zero' : ''], style: v ? { color } : null },
    fmt(v),
  )
  const rate = h('td', { class: 'rate-col' }, [
    h('span', { class: ['rate-badge', 'mono', rateClass(n.error_rate)] }, `${n.error_rate}%`),
  ])
  // Sisi sales: cukup Submissions / Errors / Error Rate — lihat showRiskBase.
  if (!showRiskBase.value) {
    return [cell(n.submissions, null), cell(n.errors, 'var(--m-danger)'), rate]
  }
  return [
    cell(n.submissions, null),
    cell(n.approve, 'var(--m-success)'),
    // Reject = pembilang Error Rate. Ditampilkan supaya persentasenya bisa
    // dicek langsung dari kolom yang terlihat (errors = tiket AI Status FAIL).
    cell(n.errors, 'var(--m-danger)'),
    cell(n.risk_high, 'var(--m-danger)', ['grp-cell', 'grp-first']),
    cell(n.risk_medium, 'var(--m-warning)', ['grp-cell']),
    cell(n.risk_low, 'var(--m-info)', showRiskSystemNew.value ? ['grp-cell'] : ['grp-cell', 'grp-last']),
    ...(showRiskSystemNew.value ? [
      cell(n.risk_system, null, ['grp-cell']),
      cell(n.risk_new, null, ['grp-cell', 'grp-last']),
    ] : []),
    h('td', { class: ['num', 'mono', 'col-n', 'total-risk', !n.total_risk ? 'zero' : ''] }, fmt(n.total_risk)),
    rate,
  ]
}

// ---- QC table (Hierarki Error Rate, QC-division managers only) ----
const canSeeQcTable = computed(() =>
  ['team_leader_qc', 'spq_head', 'admin'].includes(auth.user?.role))
const qcPerformance = ref([])
const loadingQcPerf = ref(false)

// Approve Rate reads the OPPOSITE way to Error Rate: higher is better, so it
// cannot reuse rateClass() (which paints high values red).
function approveRateClass(rate, assigned) {
  if (!assigned) return 'muted'
  if (rate >= 90) return 'success'
  if (rate >= 60) return 'warning'
  return 'danger'
}

async function loadQcPerformance() {
  if (!canSeeQcTable.value) return
  loadingQcPerf.value = true
  try {
    qcPerformance.value = await dataStore.fetchQcPerformance()
  } catch {
    qcPerformance.value = []
  } finally {
    loadingQcPerf.value = false
  }
}

// ---- hierarchy expand state ----
const openState = reactive({ am: {}, tl: {} })
function toggle(level, key) { openState[level][key] = !openState[level][key] }
function isOpen(level, key) { return !!openState[level][key] }

// ---- loaders ----
async function loadOverview() {
  try {
    snapshot.value = await dataStore.fetchStatsOverview()
  } finally {
    loadingOverview.value = false
  }
}

// ---- AI status time series (100% stacked column) ----
// A manual date filter is absolute; Prev/Next paging (periodOffset) only applies to
// the default window, so the two never conflict.
const hasDateFilter = computed(() => !!(dateStart.value || dateEnd.value))

function timeseriesParams(campaign) {
  const p = { granularity: granularity.value }
  if (dateStart.value) p.start = dateStart.value
  if (dateEnd.value) p.end = dateEnd.value
  else if (periodOffset.value) p.offset = periodOffset.value
  if (campaign) p.campaign = campaign
  return p
}

// The series feeding whichever view is on screen (scoped vs global).
const activeSeries = computed(() => (isScopedRole.value ? myScopedSeries.value : globalSeries.value))
// Human-friendly label of the window currently shown, from the bucket labels the
// backend already produced (e.g. "16 Jul – 22 Jul", "W27 2026 – W30 2026").
const currentRangeLabel = computed(() => {
  const b = activeSeries.value?.buckets || []
  if (!b.length) return ''
  return b.length === 1 ? b[0].label : `${b[0].label} – ${b[b.length - 1].label}`
})
// Prev (dir -1 = older) / Next (dir +1 = newer). Can't page past the latest window.
function shiftPeriod(dir) {
  if (hasDateFilter.value) return
  const next = periodOffset.value + dir
  if (next > 0) return
  periodOffset.value = next
}
async function loadTimeseries() {
  loadingSeries.value = true
  try {
    globalSeries.value = await dataStore.fetchAiStatusTimeseries(timeseriesParams(campaignFilter.value))
  } finally {
    loadingSeries.value = false
  }
}
async function loadMyTimeseries() {
  loadingSeries.value = true
  try {
    myScopedSeries.value = await dataStore.fetchAiStatusTimeseries(timeseriesParams())
  } finally {
    loadingSeries.value = false
  }
}
// Reload the chart when the granularity, date range, or paging offset changes; the
// campaign filter (global view only) also re-slices the series. Granularity and
// date-filter changes reset paging to the latest window at their call sites, so both
// refs move together and this watcher reloads once.
watch([granularity, dateStart, dateEnd, periodOffset], () => {
  if (isScopedRole.value) loadMyTimeseries()
  else loadTimeseries()
})
watch(campaignFilter, () => { if (!isScopedRole.value) loadTimeseries() })
// Performa Campaign kini tampil inline di bawah pie chart Overview (bukan tab
// tersendiri), jadi datanya di-load bersamaan dengan overview saat mount.
async function loadCampaignMonthly() {
  if (campaignData.value) return
  loadingCampaign.value = true
  try {
    campaignData.value = await dataStore.fetchCampaignMonthly()
    // Default to the most recent month so the table opens on a manageable slice.
    const months = campaignData.value?.months || []
    filterMonth.value = months[months.length - 1] || ''
  } finally {
    loadingCampaign.value = false
  }
}
async function openHierarchy() {
  tab.value = 'hierarchy'
  // The QC table is refetched every visit: unlike the snapshot-backed tree it is
  // computed live, and an approval made minutes ago should show up.
  loadQcPerformance()
  if (hierarchy.value) return
  loadingHierarchy.value = true
  try { hierarchy.value = await dataStore.fetchHierarchy() } finally { loadingHierarchy.value = false }
}

// Active campaign names for the Overview filter dropdown (source of truth =
// /list_campaigns, filtered to is_active).
async function loadCampaigns() {
  try {
    const list = await dataStore.fetchCampaigns()
    campaignOptions.value = (list || []).filter((c) => c.is_active).map((c) => c.name)
  } catch {
    campaignOptions.value = []
  }
}

// ---- sales-agent loaders ----
async function loadMine() {
  try {
    const d = await dataStore.fetchMyOverview()
    myOverview.value = d.overview
    teamAgents.value = d.agents || []
  } finally {
    loadingMine.value = false
  }
}
async function loadTickets() {
  loadingTickets.value = true
  try {
    const d = await dataStore.fetchResults({ page: 1, limit: 20 })
    tickets.value = d.items || []
    ticketsTotal.value = d.total || 0
  } catch {
    tickets.value = []
  } finally {
    loadingTickets.value = false
  }
}

onMounted(async () => {
  if (isScopedRole.value) {
    // Team Leader sees a team-agent roster (from loadMine); Sales Agent sees a ticket list.
    const tasks = [loadMine(), loadMyTimeseries()]
    if (isSalesAgent.value) tasks.push(loadTickets())
    await Promise.all(tasks)
    timer = setInterval(() => { loadMine(); loadMyTimeseries(); if (isSalesAgent.value) loadTickets() }, 30000)
  } else {
    await Promise.all([loadOverview(), loadCampaigns(), loadCampaignMonthly(), loadTimeseries()])
    timer = setInterval(() => { loadOverview(); loadTimeseries() }, 30000)
  }
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.stats-page { display: flex; flex-direction: column; gap: 20px; background: var(--m-bg-app); }

/* Tabs */
.toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.tab-group { display: flex; background: var(--m-gray-150); border-radius: var(--m-r-pill); padding: 4px; gap: 4px; }
.tab {
  padding: 7px 18px; border: none; background: none; border-radius: var(--m-r-pill);
  font-size: 13px; font-weight: 600; color: var(--m-fg-2); cursor: pointer; transition: all .15s;
  font-family: var(--m-font-sans);
}
.tab.active { background: #fff; color: var(--m-gray-900); box-shadow: var(--m-shadow-sm); }
.refresh-hint { font-size: 12px; color: var(--m-fg-3); }
.sa-title { font-size: 16px; font-weight: 700; color: var(--m-gray-900); }

/* Sales-agent enlarged pie */
.sa-donut-row { gap: 44px; padding: 8px 0; }
.sa-donut { width: 240px; height: 240px; }

/* status / AI pills */
.pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: var(--m-r-pill); text-transform: capitalize; white-space: nowrap; }
.pill.ok { background: var(--m-success-soft); color: var(--m-success); }
.pill.bad { background: var(--m-danger-soft); color: var(--m-danger); }
.pill.warn { background: var(--m-warning-soft); color: var(--m-warning); }
.pill.info { background: var(--m-info-soft); color: var(--m-info); }
.pill.muted { background: var(--m-gray-150); color: var(--m-fg-2); }
.spin-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--m-gray-200); border-top-color: var(--m-info); border-radius: 50%; animation: shimmer-spin .7s linear infinite; vertical-align: middle; }
@keyframes shimmer-spin { to { transform: rotate(360deg); } }

/* KPI cards */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.kpi {
  background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md);
  padding: 18px 20px; border-top: 3px solid var(--accent, var(--m-gray-300)); box-shadow: var(--m-shadow-card);
}
.kpi-label { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--m-gray-700); }
.kpi-value { font-size: 32px; font-weight: 800; color: var(--m-gray-900); margin-top: 6px; }
.kpi-sub { font-size: 12.5px; font-weight: 600; color: var(--m-fg-2); margin-top: 4px; }

/* Panels */
.grid-2 { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(340px, 1.2fr); gap: 16px; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
.panel { background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md); padding: 18px 20px; box-shadow: var(--m-shadow-card); }
.panel-title { font-size: 14px; font-weight: 700; color: var(--m-gray-900); margin-bottom: 14px; }
.panel-cap { font-weight: 500; font-size: 12px; color: var(--m-fg-3); }
.panel-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.panel-title-row .panel-title { margin-bottom: 0; }
.month-select {
  padding: 6px 10px; border: 1.5px solid var(--m-border-1); border-radius: var(--m-r-sm);
  font-size: 12px; font-weight: 600; color: var(--m-gray-900); background: #fff; outline: none;
}
.month-select:focus { border-color: var(--m-info); }

/* Overview campaign filter */
.cf-row { display: flex; align-items: center; gap: 10px; }

/* --- 100% stacked column chart + date filter --- */
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
.stack-row { display: flex; align-items: stretch; gap: 28px; }
.stack-wrap { position: relative; flex: 2; min-width: 0; height: 320px; }
@media (max-width: 860px) {
  .stack-row { flex-direction: column; }
  .stack-wrap { width: 100%; flex: none; }
}
.cf-label { font-size: 13px; font-weight: 600; color: var(--m-fg-2); }

/* Pie */
.donut-row { display: flex; align-items: center; gap: 28px; }
.donut-wrap { position: relative; width: 168px; height: 168px; flex-shrink: 0; }
.legend { display: flex; flex-direction: column; gap: 12px; flex: 1; }
.legend-title { font-size: 14px; font-weight: 800; color: var(--m-gray-900); letter-spacing: -.01em; }
.legend-caption { font-size: 12px; font-weight: 500; color: var(--m-fg-2); margin-top: -8px; }
.legend-cols { padding-bottom: 8px; border-bottom: 1px solid var(--m-gray-150); }
.legend-cap { font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: .05em; color: var(--m-fg-3) !important; }
.legend-total { border-top: 1px solid var(--m-gray-150); padding-top: 12px; margin-top: 2px; }
.legend-total .legend-label { font-weight: 700; color: var(--m-gray-900); }
.legend-item { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.legend-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.legend-label { flex: 1; font-weight: 500; color: var(--m-gray-700); }
.legend-val { font-weight: 700; color: var(--m-gray-900); min-width: 48px; text-align: right; }
.legend-pct { font-size: 15px; font-weight: 800; color: var(--m-gray-900); min-width: 54px; text-align: right; }

/* Sorotan */
.sorotan { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 720px) { .sorotan { grid-template-columns: 1fr; } }
.sorotan-head { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 10px; }
.sorotan-head.danger { color: var(--m-danger); }
.sorotan-head.success { color: var(--m-success); }
.sorotan-empty { font-size: 12px; color: var(--m-fg-3); }
.agent-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--m-gray-150); }
.agent-row:last-child { border-bottom: none; }
.agent-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.agent-name { font-size: 13px; font-weight: 600; color: var(--m-gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-meta { font-size: 11px; color: var(--m-fg-3); }

.avatar { width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.avatar.sm { width: 26px; height: 26px; font-size: 10px; margin-right: 8px; vertical-align: middle; }
.avatar.xs { width: 22px; height: 22px; font-size: 9px; margin-right: 8px; background: var(--m-gray-150); color: var(--m-gray-700); }
.avatar.danger { background: var(--m-danger-soft); color: var(--m-danger); }
.avatar.success { background: var(--m-success-soft); color: var(--m-success); }

.rate-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: var(--m-r-pill); }
.rate-badge.danger { background: var(--m-danger-soft); color: var(--m-danger); }
.rate-badge.warning { background: var(--m-warning-soft); color: var(--m-warning); }
.rate-badge.success { background: var(--m-success-soft); color: var(--m-success); }
/* Neutral badge: a QC with nothing assigned has no rate to judge. */
.rate-badge.muted { background: var(--m-gray-150); color: var(--m-fg-3); }

/* Tables */
.table-scroll { overflow-x: auto; }
.mtable { width: 100%; border-collapse: collapse; }
.mtable th {
  text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .04em; color: var(--m-fg-2); border-bottom: 2px solid var(--m-gray-150); background: var(--m-gray-50); white-space: nowrap;
}
.mtable td { padding: 10px 12px; font-size: 13px; color: var(--m-gray-900); border-bottom: 1px solid var(--m-gray-150); vertical-align: middle; }
.mtable tr:last-child td { border-bottom: none; }
.mtable .num { text-align: right; white-space: nowrap; }
.mtable tr.risky td { background: #FDF7F7; }
.cell-agent { display: inline-flex; align-items: center; font-weight: 600; }
.rate-col { min-width: 150px; }
.rate-cell { display: flex; align-items: center; gap: 10px; }
.bar { flex: 1; height: 6px; background: var(--m-gray-150); border-radius: var(--m-r-pill); overflow: hidden; min-width: 60px; }
.bar-fill { display: block; height: 100%; border-radius: var(--m-r-pill); }
.empty { text-align: center; color: var(--m-fg-3); padding: 28px; }
.campaign-name { font-weight: 600; white-space: nowrap; }
.note { font-size: 12px; color: var(--m-fg-3); margin-top: 12px; }

/* Hierarchy tree */
.mtable.tree tr.lvl-am, .mtable.tree tr.lvl-tl { cursor: pointer; }
.mtable.tree tr.lvl-am td { background: var(--m-gray-100); font-weight: 700; }
.mtable.tree tr.lvl-am:hover td { background: var(--m-gray-150); }
.mtable.tree tr.lvl-tl td { background: #fff; font-weight: 600; }
.mtable.tree tr.lvl-tl:hover td { background: var(--m-gray-50); }
.mtable.tree tr.lvl-ag td { background: #fff; color: var(--m-gray-700); }
.twist { display: inline-block; width: 16px; color: var(--m-fg-3); }
.pad-1 { padding-left: 30px !important; }
.pad-2 { padding-left: 52px !important; }
.lvl-tag { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-right: 6px; vertical-align: middle; }
.lvl-tag.am { background: var(--mega-orange-soft); color: var(--mega-orange-deep); }
.lvl-tag.tl { background: var(--m-info-soft); color: var(--m-info); }
.lvl-tag.tlo { background: var(--m-gray-150); color: var(--m-gray-700); }
.lvl-tag.qc { background: var(--m-warning-soft); color: var(--m-warning); }

/* --- Hierarchy numeric columns -------------------------------------------
   Sebelumnya angka terasa "melayang": kolom Error Rate kiri-rata di dalam sel
   selebar 150px sementara semua kolom angka di kirinya kanan-rata, dan header
   "Total Risk (H+M+L)" memaksa kolomnya jauh lebih lebar dari isinya. */

/* table-layout: fixed -> lebar dari <colgroup> dipatuhi persis, tidak lagi
   ditentukan panjang teks header. Ini yang membuat digit antar kolom & antar
   level (AM / TL / TLO) benar-benar segaris. min-width menjaga tabel tetap
   terbaca; .table-scroll menyediakan geser horizontal di layar sempit. */
.mtable.tree.hier { table-layout: fixed; min-width: 1020px; }

/* PENTING — kenapa semua aturan di bawah memakai :deep().
   Sel angka di BODY tabel ini dirender oleh RiskCells lewat render function
   (h()), bukan lewat template. Vue hanya menempelkan atribut scope `data-v-*`
   pada elemen yang berasal dari template, jadi <td> hasil h() TIDAK punya
   atribut itu dan selektor scoped biasa (`.mtable.tree td.col-n[data-v-x]`)
   tidak akan pernah cocok — sel jatuh ke default browser, yaitu rata kiri.
   :deep() memindahkan atribut scope ke elemen INDUK (tabelnya, yang memang
   dari template), sehingga anak-anaknya ikut kena apa pun asal-usulnya.
   Jangan hapus :deep() di blok ini tanpa mengubah RiskCells jadi template. */

/* Angka rata TENGAH. Lebar kolom sudah dikunci colgroup, jadi digit tetap
   segaris antar baris & antar level tanpa perlu rata kanan. */
.mtable.tree :deep(td.col-n),
.mtable.tree th.col-n { text-align: center; padding-left: 6px; padding-right: 6px; }

/* Header boleh membungkus ke 2 baris — dengan lebar terkunci, nowrap justru
   memaksa kolom melebar dan merusak kesejajaran. */
.mtable.tree.hier th { white-space: normal; line-height: 1.25; vertical-align: bottom; }
.mtable.tree.hier th:first-child { vertical-align: middle; }
/* Nama: kolom fleksibel, potong dengan ellipsis alih-alih mendorong kolom angka. */
.mtable.tree.hier td:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Error Rate ikut rata tengah seperti kolom angka lain. */
.mtable.tree :deep(td.rate-col),
.mtable.tree th.rate-col { text-align: center; padding-left: 6px; padding-right: 6px; }

/* Badge Error Rate: dirender lewat h() juga, jadi ikut butuh :deep() —
   tanpa ini badge tampil sebagai teks polos tanpa pil & tanpa warna. */
.mtable.tree :deep(.rate-badge) {
  display: inline-block; font-size: 12px; font-weight: 700;
  padding: 3px 10px; border-radius: var(--m-r-pill);
}
.mtable.tree :deep(.rate-badge.danger) { background: var(--m-danger-soft); color: var(--m-danger); }
.mtable.tree :deep(.rate-badge.warning) { background: var(--m-warning-soft); color: var(--m-warning); }
.mtable.tree :deep(.rate-badge.success) { background: var(--m-success-soft); color: var(--m-success); }
.mtable.tree :deep(.rate-badge.muted) { background: var(--m-gray-150); color: var(--m-fg-3); }

/* Grup Risk Base: latar tipis + garis batas supaya High/Medium/Low/System/New
   terbaca sebagai satu kesatuan, bukan kolom sejajar Submissions/Approve. */
.mtable.tree .grp-head {
  text-align: center; background: var(--m-gray-100);
  border-bottom: 1px solid var(--m-gray-150); font-size: 10px;
}
.mtable.tree :deep(.grp-cell) { background: rgba(0, 0, 0, .012); }
.mtable.tree :deep(.grp-first) { border-left: 1px solid var(--m-gray-150); }
.mtable.tree :deep(.grp-last) { border-right: 1px solid var(--m-gray-150); }
.mtable.tree tr.lvl-am :deep(.grp-cell) { background: rgba(0, 0, 0, .03); }

/* Nol = tidak ada temuan; redam agar mata tertuju ke angka yang berarti. */
.mtable.tree :deep(.zero) { color: var(--m-gray-400); font-weight: 400; }
.mtable.tree :deep(.total-risk) { font-weight: 700; }
.mtable.tree :deep(.total-risk.zero) { font-weight: 400; }

/* Skeleton */
.skeleton-wrap { display: flex; flex-direction: column; gap: 12px; }
.skeleton { background: linear-gradient(90deg, var(--m-gray-100) 25%, var(--m-gray-150) 50%, var(--m-gray-100) 75%); background-size: 200%; height: 84px; border-radius: var(--m-r-md); animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
