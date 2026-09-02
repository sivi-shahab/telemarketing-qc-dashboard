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
            <div class="panel-title">AI Status — per waktu</div>
            <div class="chart-filter">
              <div class="gran-group">
                <button v-for="g in GRANULARITIES" :key="g.key"
                        :class="['gran-btn', { active: granularity === g.key }]"
                        @click="granularity = g.key; periodOffset = 0">{{ g.label }}</button>
              </div>
              <div class="date-range">
                <label class="dr-label">Dari</label>
                <input type="date" v-model="dateStart" class="date-input" @change="periodOffset = 0" />
                <label class="dr-label">s/d</label>
                <input type="date" v-model="dateEnd" class="date-input" @change="periodOffset = 0" />
                <button v-if="dateStart || dateEnd" class="clear-btn" @click="dateStart = ''; dateEnd = ''; periodOffset = 0">Reset</button>
              </div>
            </div>

            <div class="kpis kpis-5">
              <div class="kpi" style="--accent: var(--m-info)">
                <div class="kpi-label">Total Submission</div>
                <div class="kpi-value mono">{{ fmt(myDonutSubmissions) }}</div>
                <div class="kpi-sub">{{ fmt(myDonutDone) }} selesai · {{ fmt(myDonutInProgress) }} diproses</div>
              </div>
              <div class="kpi" style="--accent: var(--m-success)">
                <div class="kpi-label">Total Qualified</div>
                <div class="kpi-value mono">{{ fmt(myDonutApprove) }} <span class="kpi-pct">({{ myDonutApprovePct }}%)</span></div>
                <div class="kpi-sub">dari {{ fmt(myDonutTotal) }} dinilai</div>
              </div>
              <div class="kpi" style="--accent: var(--m-danger)">
                <div class="kpi-label">Total Not Qualified</div>
                <div class="kpi-value mono">{{ fmt(myDonutReturn) }} <span class="kpi-pct">({{ myDonutReturnPct }}%)</span></div>
                <div class="kpi-sub">dari {{ fmt(myDonutTotal) }} dinilai</div>
              </div>
              <div class="kpi" style="--accent: #D97706">
                <div class="kpi-label">Total Pending</div>
                <div class="kpi-value mono">{{ fmt(myDonutPending) }} <span class="kpi-pct">({{ myDonutPendingPct }}%)</span></div>
                <div class="kpi-sub">butuh dokumen (H+2)</div>
              </div>
              <div class="kpi" :style="{ '--accent': rateColor(myDonutReturnPct) }">
                <div class="kpi-label">Not Qualified Rate</div>
                <div class="kpi-value mono" :style="{ color: rateColor(myDonutReturnPct) }">{{ myDonutReturnPct }}%</div>
                <div class="kpi-sub">{{ fmt(myDonutReturn) }} not qualified / {{ fmt(myDonutTotal) }} dinilai</div>
              </div>
            </div>

            <!-- Navigasi geser periode (‹ ›) duduk TEPAT di atas bar chart, bukan lagi
                 di baris filter paling atas panel (28 Agustus 2026). Tombolnya mengubah
                 rentang waktu batang di bawahnya, jadi jaraknya yang jauh — terpisah
                 lima KPI card — membuat hubungan sebab-akibatnya tidak terbaca.
                 Pemilih granularitas & rentang tanggal tetap di baris atas karena juga
                 mengatur KPI, bukan hanya grafik. -->
            <div class="chart-head">
              <div class="chart-sub-title">AI Status (Qualify / Not Qualify / Pending) — per waktu</div>
              <div class="period-nav">
                <button class="nav-btn" :disabled="hasDateFilter" @click="shiftPeriod(-1)"
                        title="Periode sebelumnya" aria-label="Periode sebelumnya">‹</button>
                <span class="nav-range">{{ currentRangeLabel || '—' }}</span>
                <button class="nav-btn" :disabled="hasDateFilter || periodOffset >= 0" @click="shiftPeriod(1)"
                        title="Periode berikutnya" aria-label="Periode berikutnya">›</button>
              </div>
            </div>
            <div class="stack-row">
              <div class="stack-wrap">
                <Bar :data="scopedChartData" :options="stackedOptions" :plugins="[barPct]" />
              </div>
              <div class="legend">
                <div class="legend-title">Persentase Hasil Penilaian AI</div>
                <div class="legend-caption">Qualified vs Not Qualified vs Pending ({{ granularityLabel }}) · angka di atas batang = total dinilai</div>
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
            <TblToolbar :v="teamView" label="Daftar Sales Agent Tim Anda" :modes="AGENT_MODES"
                        placeholder="Cari nama sales agent atau NIP…" />
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th class="sortable" @click="teamView.sortBy('name')">Sales Agent <span class="sort-ind">{{ teamView.indicator('name') }}</span></th>
                    <th class="sortable" @click="teamView.sortBy('nip_baru')">NIP <span class="sort-ind">{{ teamView.indicator('nip_baru') }}</span></th>
                    <th class="num sortable" @click="teamView.sortBy('submissions')">Total Recording <span class="sort-ind">{{ teamView.indicator('submissions') }}</span></th>
                    <th class="num sortable" @click="teamView.sortBy('total_risk')">Total Failure <span class="sort-ind">{{ teamView.indicator('total_risk') }}</span></th>
                    <th class="rate-col sortable" @click="teamView.sortBy('error_rate')">Avg Failure Rate <span class="sort-ind">{{ teamView.indicator('error_rate') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loadingMine"><td colspan="5" class="empty"><span class="spin-inline"></span> Memuat...</td></tr>
                  <tr v-else-if="!teamView.total"><td colspan="5" class="empty">
                    {{ agentEmptyText(teamView, teamAgents, 'Belum ada sales agent di tim Anda.') }}
                  </td></tr>
                  <!-- Ambang mengikuti avgClass ("danger" = > 3x). Sebelumnya >= 10
                       — sisa dari masa kolom ini berisi PERSEN; pada skala kelipatan
                       angka itu tak pernah tercapai sehingga tintnya tidak pernah muncul. -->
                  <tr v-for="a in teamView.rows" :key="a.agent_id" :class="{ risky: a.submissions && a.error_rate > 3 }">
                    <td>
                      <span class="cell-agent">
                        <span class="avatar sm" :style="{ background: 'var(--m-gray-150)', color: 'var(--m-gray-700)' }">{{ initials(a.name) }}</span>
                        {{ a.name }}
                      </span>
                    </td>
                    <td class="mono">{{ a.nip_baru || '—' }}</td>
                    <td class="num mono">{{ fmt(a.submissions) }}</td>
                    <td class="num mono" :style="{ color: a.total_risk ? 'var(--m-danger)' : 'var(--m-gray-900)' }">{{ fmt(a.total_risk) }}</td>
                    <td class="rate-col">
                      <span class="rate-badge mono" :class="avgClassOf(a.error_rate, a.submissions)">{{ avgText(a.error_rate, a.submissions) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Pager :v="teamView" label="agent" />
          </div>

          <div v-else class="panel">
            <div class="panel-title">{{ scopeListTitle }}</div>
            <TblToolbar :v="myTicketsView" label="Daftar Ticket ID Anda" :modes="TICKET_MODES"
                        placeholder="Cari Ticket ID, campaign, atau AI Status…" />
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th class="sortable" @click="myTicketsView.sortBy('id')">Ticket ID <span class="sort-ind">{{ myTicketsView.indicator('id') }}</span></th>
                    <th class="sortable" @click="myTicketsView.sortBy('campaign')">Campaign <span class="sort-ind">{{ myTicketsView.indicator('campaign') }}</span></th>
                    <th class="num sortable" @click="myTicketsView.sortBy('num_calls')">Calls <span class="sort-ind">{{ myTicketsView.indicator('num_calls') }}</span></th>
                    <!-- Kolom "Status" (status pemrosesan: pending/processing/done/failed)
                         dilepas 28 Agustus 2026: itu keadaan pipeline, bukan informasi yang
                         bisa ditindaklanjuti sales agent — dan tiket yang tampil di sini
                         praktis selalu "done" karena hanya tiket selesai yang punya AI Status. -->
                    <th class="sortable" @click="myTicketsView.sortBy('ai_status')">AI Status <span class="sort-ind">{{ myTicketsView.indicator('ai_status') }}</span></th>
                    <!-- Tanggal SUBMIT (tms_cashline.submit_time = saat pengajuan dikirim
                         ke TMS), bukan tanggal transkripnya diunggah ke sistem ini —
                         yang terakhir itu jadwal kerja QC, bukan jadwal kerja agent. -->
                    <th class="sortable" @click="myTicketsView.sortBy('submit_time')">Tanggal Submit <span class="sort-ind">{{ myTicketsView.indicator('submit_time') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loadingTickets"><td colspan="5" class="empty"><span class="spin-inline"></span> Memuat...</td></tr>
                  <tr v-else-if="!myTicketsView.total"><td colspan="5" class="empty">
                    {{ tickets.length ? 'Tidak ada yang cocok dengan pencarian/filter.' : scopeEmpty }}
                  </td></tr>
                  <tr v-for="t in myTicketsView.rows" :key="t.result_id">
                    <td class="campaign-name">{{ t.id || '—' }}</td>
                    <td>{{ t.campaign || '—' }}</td>
                    <td class="num mono">{{ t.num_calls ?? '—' }}</td>
                    <td>
                      <span v-if="t.ai_status" class="pill" :class="t.ai_status === 'PASS' ? 'ok' : (t.ai_status === 'PENDING' ? 'warn' : 'bad')">{{ aiStatusLabel(t.ai_status) }}</span>
                      <span v-else>—</span>
                    </td>
                    <td>{{ fmtDate(t.submit_time) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Pager :v="myTicketsView" label="tiket" />
            <div class="note">
              Memuat {{ fmt(tickets.length) }} tiket terbaru dari total {{ fmt(ticketsTotal) }} —
              pencarian dan urutan berlaku pada {{ fmt(tickets.length) }} tiket itu saja.
              <template v-if="ticketsTotal > tickets.length">Tiket yang lebih lama ada di menu <b>Results</b>.</template>
              <template v-else>Detail lengkap ada di menu <b>Results</b>.</template>
            </div>
          </div>
        </template>
      </template>

      <!-- ==================== QC / SPQ HEAD view ==================== -->
      <template v-else>

      <!-- Tabs -->
      <div class="toolbar">
        <div class="tab-group">
          <button :class="['tab', { active: tab === 'overview' }]" @click="tab = 'overview'">Overview</button>
          <button :class="['tab', { active: tab === 'hierarchy' }]" @click="openHierarchy">Hierarki Failure Rate</button>
          <button v-if="canSeeFailureReasons" :class="['tab', { active: tab === 'failure' }]" @click="openFailure">Failure Reason</button>
        </div>
        <span class="refresh-hint">Update otomatis saat ada data baru · auto-refresh 30 detik</span>
      </div>

      <!-- Filter campaign — SATU kontrol untuk ketiga tab (Overview, Hierarki Error
           Rate, Failure Reason) supaya angka yang dibandingkan selalu berasal dari
           cakupan yang sama. Kosong = seluruh campaign. -->
      <div class="cf-row">
        <label class="cf-label">Campaign</label>
        <select v-model="campaignFilter" class="month-select">
          <option value="">Semua Campaign</option>
          <option v-for="c in campaignOptions" :key="c" :value="c">{{ c }}</option>
        </select>
        <span v-if="campaignFilter" class="cf-note">
          Semua angka di tab ini dibatasi ke campaign <b>{{ campaignFilter }}</b>.
        </span>
      </div>

      <!-- ============================ OVERVIEW ============================ -->
      <template v-if="tab === 'overview'">
        <div v-if="loadingOverview && !overview" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 4" :key="i"></div>
        </div>

        <template v-else-if="overview">
          <!-- Satu panel: KPI cards (Total Submission/Qualified/Not Qualified/Pending/
               Not Qualified Rate) + grafik AI Status. Filter tanggal di atas ikut meng-apply ke
               KPI karena semuanya diturunkan dari time series yang sama (bukan snapshot). -->
          <div class="panel">
            <div class="panel-title">AI Status — per waktu</div>
            <div class="chart-filter">
              <div class="gran-group">
                <button v-for="g in GRANULARITIES" :key="g.key"
                        :class="['gran-btn', { active: granularity === g.key }]"
                        @click="granularity = g.key; periodOffset = 0">{{ g.label }}</button>
              </div>
              <div class="date-range">
                <label class="dr-label">Dari</label>
                <input type="date" v-model="dateStart" class="date-input" @change="periodOffset = 0" />
                <label class="dr-label">s/d</label>
                <input type="date" v-model="dateEnd" class="date-input" @change="periodOffset = 0" />
                <button v-if="dateStart || dateEnd" class="clear-btn" @click="dateStart = ''; dateEnd = ''; periodOffset = 0">Reset</button>
              </div>
            </div>

            <div class="kpis kpis-5">
              <div class="kpi" style="--accent: var(--m-info)">
                <div class="kpi-label">Total Submission</div>
                <div class="kpi-value mono">{{ fmt(donutSubmissions) }}</div>
                <div class="kpi-sub">{{ fmt(donutDone) }} selesai · {{ fmt(donutInProgress) }} diproses</div>
              </div>
              <div class="kpi" style="--accent: var(--m-success)">
                <div class="kpi-label">Total Qualified</div>
                <div class="kpi-value mono">{{ fmt(donutApprove) }} <span class="kpi-pct">({{ donutApprovePct }}%)</span></div>
                <div class="kpi-sub">dari {{ fmt(donutTotal) }} dinilai</div>
              </div>
              <div class="kpi" style="--accent: var(--m-danger)">
                <div class="kpi-label">Total Not Qualified</div>
                <div class="kpi-value mono">{{ fmt(donutReturn) }} <span class="kpi-pct">({{ donutReturnPct }}%)</span></div>
                <div class="kpi-sub">dari {{ fmt(donutTotal) }} dinilai</div>
              </div>
              <div class="kpi" style="--accent: #D97706">
                <div class="kpi-label">Total Pending</div>
                <div class="kpi-value mono">{{ fmt(donutPending) }} <span class="kpi-pct">({{ donutPendingPct }}%)</span></div>
                <div class="kpi-sub">butuh dokumen (H+2)</div>
              </div>
              <div class="kpi" :style="{ '--accent': rateColor(donutReturnPct) }">
                <div class="kpi-label">Not Qualified Rate</div>
                <div class="kpi-value mono" :style="{ color: rateColor(donutReturnPct) }">{{ donutReturnPct }}%</div>
                <div class="kpi-sub">{{ fmt(donutReturn) }} not qualified / {{ fmt(donutTotal) }} dinilai</div>
              </div>
            </div>

            <!-- Vonis HUMAN, dihitung TERPISAH dari vonis AI di atas: Manual Status
                 tidak pernah menimpa AI Status, jadi angkanya berdiri sendiri dan
                 penyebutnya adalah tiket yang sudah dinilai human. -->
            <!-- Navigasi geser periode (‹ ›) duduk TEPAT di atas bar chart, bukan lagi
                 di baris filter paling atas panel (28 Agustus 2026). Tombolnya mengubah
                 rentang waktu batang di bawahnya, jadi jaraknya yang jauh — terpisah
                 lima KPI card — membuat hubungan sebab-akibatnya tidak terbaca.
                 Pemilih granularitas & rentang tanggal tetap di baris atas karena juga
                 mengatur KPI, bukan hanya grafik. -->
            <div class="chart-head">
              <div class="chart-sub-title">AI Status (Qualify / Not Qualify / Pending) — per waktu</div>
              <div class="period-nav">
                <button class="nav-btn" :disabled="hasDateFilter" @click="shiftPeriod(-1)"
                        title="Periode sebelumnya" aria-label="Periode sebelumnya">‹</button>
                <span class="nav-range">{{ currentRangeLabel || '—' }}</span>
                <button class="nav-btn" :disabled="hasDateFilter || periodOffset >= 0" @click="shiftPeriod(1)"
                        title="Periode berikutnya" aria-label="Periode berikutnya">›</button>
              </div>
            </div>
            <div class="stack-row">
              <div class="stack-wrap">
                <Bar :data="globalChartData" :options="stackedOptions" :plugins="[barPct]" />
              </div>
              <div class="legend">
                <div class="legend-title">Persentase Hasil Penilaian AI</div>
                <div class="legend-caption">Qualified vs Not Qualified vs Pending ({{ granularityLabel }}) · angka di atas batang = total dinilai</div>
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
          <!-- Disembunyikan untuk sisi sales — Area Manager & Telesales Head (28 Agustus
               2026). Team Leader & Sales Agent memakai tampilan scoped di atas, yang
               memang tidak pernah merender panel ini. -->
          <template v-if="showCampaignPerformance">
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
            <TblToolbar :v="campaignView" label="Performa Campaign"
                        placeholder="Cari campaign atau bulan…" />
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th class="sortable" @click="campaignView.sortBy('month')">Bulan <span class="sort-ind">{{ campaignView.indicator('month') }}</span></th>
                    <th class="sortable" @click="campaignView.sortBy('campaign')">Campaign <span class="sort-ind">{{ campaignView.indicator('campaign') }}</span></th>
                    <th class="num sortable" @click="campaignView.sortBy('submissions')">Submission <span class="sort-ind">{{ campaignView.indicator('submissions') }}</span></th>
                    <th class="num sortable" @click="campaignView.sortBy('not_qualified')">Not Qualified <span class="sort-ind">{{ campaignView.indicator('not_qualified') }}</span></th>
                    <th class="num sortable" @click="campaignView.sortBy('high')">High <span class="sort-ind">{{ campaignView.indicator('high') }}</span></th>
                    <th class="num sortable" @click="campaignView.sortBy('medium')">Medium <span class="sort-ind">{{ campaignView.indicator('medium') }}</span></th>
                    <th class="num sortable" @click="campaignView.sortBy('low')">Low <span class="sort-ind">{{ campaignView.indicator('low') }}</span></th>
                    <th v-if="showRiskSystemNew" class="num sortable" @click="campaignView.sortBy('system')">System <span class="sort-ind">{{ campaignView.indicator('system') }}</span></th>
                    <th v-if="showRiskSystemNew" class="num sortable" @click="campaignView.sortBy('new')">New <span class="sort-ind">{{ campaignView.indicator('new') }}</span></th>
                    <th class="num sortable" @click="campaignView.sortBy('total_risk')">Total Risk (H+M+L) <span class="sort-ind">{{ campaignView.indicator('total_risk') }}</span></th>
                    <th class="rate-col sortable" @click="campaignView.sortBy('error_rate')">Error Rate <span class="sort-ind">{{ campaignView.indicator('error_rate') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!campaignView.total"><td :colspan="showRiskSystemNew ? 11 : 9" class="empty">
                    {{ campaignRows.length ? 'Tidak ada yang cocok dengan pencarian/filter.' : 'Belum ada data.' }}
                  </td></tr>
                  <tr v-for="row in campaignView.rows" :key="row.campaign + row.month">
                    <td class="mono">{{ monthLabel(row.month) }}</td>
                    <td class="campaign-name">{{ row.campaign }}</td>
                    <td class="num mono">{{ fmt(row.submissions) }}</td>
                    <td class="num mono" :style="{ color: row.not_qualified ? 'var(--m-danger)' : 'var(--m-gray-900)' }">{{ fmt(row.not_qualified || 0) }}</td>
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
            <Pager :v="campaignView" label="baris" />
            <div class="note">
              Tiap tiket dihitung <b>satu</b> Risk Base tertinggi saja (urutan H &gt; M &gt; L &gt; N &gt; O).
              <b>High</b>/<b>Medium</b>/<b>Low</b> = jumlah tiket dengan risk tertinggi H/M/L<template v-if="showRiskSystemNew"> ·
              <b>System</b> = kode O ·
              <b>New</b> = kode N (Risk Base L/M yang disoftening untuk agent baru, hanya saat grace period)</template> ·
              <b>Total Risk</b> = High + Medium + Low ·
              <b>Error Rate</b> = Total Risk ÷ <b>Submission</b> — berapa persen dari seluruh
              tiket yang berujung risk base.
              Kolom risk base hanya menghitung tiket <b>Not Qualified</b>: tiket <b>Pending</b>
              (vonisnya belum final) dan tiket <b>Qualified</b> tidak menyumbang ke
              High/Medium/Low maupun Total Risk — walau tiket Qualified bisa saja membawa
              error code (error code-nya tetap tampil di detail tiket &amp; Ringkasan Kategori).
              Jadi pembilangnya dibatasi ke tiket gagal, sementara penyebutnya SELURUH tiket.
              Kolom <b>Not Qualified</b> ditampilkan sebagai konteks: selisihnya terhadap
              Total Risk = tiket gagal yang tidak membawa risk base, mis. yang error code-nya
              hanya Risk Base L pada item scorecard <i>tolerable</i>.
            </div>
          </div>
          </template>

          <!-- Sales performance table -->
          <div class="panel">
            <div class="panel-title">Performa Sales</div>
            <div class="panel-hint">
              Memuat seluruh agent yang punya akun aktif — termasuk yang belum punya
              submission. <b>Pending</b> = tiket yang masih menunggu dokumen (H+2).
              Not Qualified Rate = <b>Not Qualified</b> ÷ Submissions — rumus yang sama
              dengan KPI Not Qualified Rate di Overview; <b>—</b> berarti belum ada tiket
              yang dinilai, bukan 0%.
            </div>
            <TblToolbar :v="salesView" label="Performa Sales" :modes="AGENT_MODES"
                        :placeholder="salesSearchHint" />
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th class="sortable" @click="salesView.sortBy('name')">Sales Agent <span class="sort-ind">{{ salesView.indicator('name') }}</span></th>
                    <th v-if="showTeamLeaderCol" class="sortable" @click="salesView.sortBy('team_leader')">Team Leader <span class="sort-ind">{{ salesView.indicator('team_leader') }}</span></th>
                    <th v-if="showAreaManagerCol" class="sortable" @click="salesView.sortBy('area_manager')">Area Manager <span class="sort-ind">{{ salesView.indicator('area_manager') }}</span></th>
                    <th class="sortable" @click="salesView.sortBy('campaign')">Campaign <span class="sort-ind">{{ salesView.indicator('campaign') }}</span></th>
                    <th class="num sortable" @click="salesView.sortBy('submissions')">Submissions <span class="sort-ind">{{ salesView.indicator('submissions') }}</span></th>
                    <th class="num sortable" @click="salesView.sortBy('pending')">Pending <span class="sort-ind">{{ salesView.indicator('pending') }}</span></th>
                    <th class="num sortable" @click="salesView.sortBy('errors')">Not Qualified <span class="sort-ind">{{ salesView.indicator('errors') }}</span></th>
                    <th class="rate-col sortable" @click="salesView.sortBy('error_rate')">Not Qualified Rate <span class="sort-ind">{{ salesView.indicator('error_rate') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!salesView.total"><td :colspan="salesColCount" class="empty">
                    {{ agentEmptyText(salesView, agents, 'Belum ada data.') }}
                  </td></tr>
                  <tr v-for="a in salesView.rows" :key="a.agent_id + a.name" :class="{ risky: a.submissions && a.error_rate >= 10 }">
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
                    <td class="num mono" :style="{ color: a.pending ? '#D97706' : 'var(--m-gray-900)' }">{{ fmt(a.pending || 0) }}</td>
                    <td class="num mono" :style="{ color: a.errors ? 'var(--m-danger)' : 'var(--m-gray-900)' }">{{ fmt(a.errors) }}</td>
                    <td class="rate-col">
                      <span class="rate-badge mono" :class="rateClassOf(a.error_rate, a.submissions)">{{ rateText(a.error_rate, a.submissions) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Pager :v="salesView" label="agent" />
          </div>
        </template>
      </template>

      <!-- ==================== HIERARKI FAILURE RATE ==================== -->
      <template v-else-if="tab === 'hierarchy'">
        <div v-if="loadingHierarchy && !hierarchy" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 4" :key="i" style="height:44px"></div>
        </div>
        <template v-else-if="hierarchy">
          <div class="kpis">
            <div class="kpi" style="--accent: var(--m-info)">
              <div class="kpi-label">All Telesales - Total Recording</div>
              <div class="kpi-value mono">{{ fmt(hierarchy.all_telesales.submissions) }}</div>
              <div class="kpi-sub">rekaman dinilai · {{ fmt(hierarchy.all_telesales.ticket_count) }} submission</div>
            </div>
            <!-- Bentuk kartunya SAMA dengan Total Recording (angka mentah, tanpa sub-line)
                 supaya pembilang & penyebut Failure Rate terbaca berdampingan; hanya
                 aksennya merah karena ini angka buruk, bukan angka volume.

                 Sampai 28 Agustus 2026 kartu ini digerbangi showRiskBase, dengan alasan
                 Total Failure ADALAH angka Risk Base sehingga sisi sales tidak boleh
                 melihatnya. Alasan itu gugur: rasionya sendiri (Failure Rate) sudah
                 lama mereka lihat, dan pembilangnya kini ikut dikirim supaya kolom
                 "Total Failure" di tabel bawah menamai angka yang benar — lihat
                 ``_HIER_RISK_FIELDS`` di api/routers/stats.py. Yang tetap ditahan dari
                 sisi sales adalah pecahannya per severity (High/Medium/Low). -->
            <div class="kpi" style="--accent: var(--m-danger)">
              <div class="kpi-label">All Telesales — Total Failure</div>
              <div class="kpi-value mono">{{ fmt(hierarchy.all_telesales.total_risk) }}</div>
            </div>
            <div class="kpi" :style="{ '--accent': avgColor(hierarchy.all_telesales.error_rate) }">
              <div class="kpi-label">ALL TELESALES - AVG FAILURE RATE</div>
              <div class="kpi-value mono" :style="{ color: hierarchy.all_telesales.submissions ? avgColor(hierarchy.all_telesales.error_rate) : null }">{{ avgText(hierarchy.all_telesales.error_rate, hierarchy.all_telesales.submissions) }}</div>
              <div class="kpi-sub">{{ fmt(hierarchy.all_telesales.total_risk) }} total failure / {{ fmt(hierarchy.all_telesales.submissions) }} total recording</div>
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
                  <col style="width: 72px" />
                  <template v-if="showRiskBase">
                    <col style="width: 88px" />
                    <col style="width: 78px" />
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
                       supaya tidak terbaca sebagai kolom sejajar Total Recording/Approve.
                       Untuk sisi sales (showRiskBase = false) seluruh blok itu hilang
                       dan header cukup satu baris. -->
                  <tr>
                    <th :rowspan="showRiskBase ? 2 : 1">Nama</th>
                    <!-- Total Recording = jumlah REKAMAN/transkrip (PDF) yang dinilai,
                         panggilan milik agent lain sudah tidak ikut; angka ini sekaligus
                         penyebut Avg Failure Rate. Submission = jumlah ticket id-nya;
                         Qualified/Pending/Not Qualified adalah vonis per TIKET dan
                         menjumlah ke kolom Submission, bukan ke Total Recording. -->
                    <th :rowspan="showRiskBase ? 2 : 1" class="num col-n" title="Jumlah rekaman (PDF) yang dinilai">Total Recording</th>
                    <th :rowspan="showRiskBase ? 2 : 1" class="num col-n" title="Jumlah ticket id">Submission</th>
                    <th v-if="showRiskBase" rowspan="2" class="num col-n">Qualified</th>
                    <th v-if="showRiskBase" rowspan="2" class="num col-n">Pending</th>
                    <!-- Sisi sales: kolom ini dulu berjudul "Errors" (28 Agustus 2026 diganti
                         "Total Failure" atas permintaan bisnis). Sisi QC tetap "Not Qualified"
                         karena di sana sudah ada kolom "Total Failure" tersendiri. -->
                    <th :rowspan="showRiskBase ? 2 : 1" class="num col-n">{{ showRiskBase ? 'Not Qualified' : 'Total Failure' }}</th>
                    <th v-if="showRiskBase" :colspan="showRiskSystemNew ? 5 : 3" class="grp-head">Risk Base</th>
                    <th v-if="showRiskBase" rowspan="2" class="num col-n">Total Failure</th>
                    <th :rowspan="showRiskBase ? 2 : 1" class="num rate-col">Avg Failure Rate</th>
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
                          <!-- Baris TLO ikut bisa dibuka: isinya satu baris per ticket id
                               yang dikerjakan agent itu, dengan KOLOM YANG SAMA persis —
                               sehingga terlihat tiket mana yang Not Qualified dan berapa
                               risk base yang dibawanya. Agent tanpa tiket tidak bisa dibuka. -->
                          <template v-for="ag in tl.agents" :key="'ag'+ag.agent_id+ag.name">
                            <tr class="lvl-ag" @click="ag.tickets && ag.tickets.length && toggle('hag', agentKey(am, tl, ag))">
                              <td class="pad-2">
                                <span v-if="ag.tickets && ag.tickets.length" class="twist">{{ isOpen('hag', agentKey(am, tl, ag)) ? '▾' : '▸' }}</span>
                                <span v-else class="twist-pad"></span>
                                <span class="lvl-tag tlo">TLO</span> {{ ag.name }}
                              </td>
                              <RiskCells :n="ag" />
                            </tr>
                            <template v-if="isOpen('hag', agentKey(am, tl, ag))">
                              <tr v-for="tk in ag.tickets" :key="'tk'+ag.agent_id+tk.ticket_id" class="lvl-tk">
                                <td class="pad-3">
                                  <span class="lvl-tag tkt">ID</span> <span class="mono">{{ tk.ticket_id }}</span>
                                </td>
                                <RiskCells :n="tk" />
                              </tr>
                            </template>
                          </template>
                        </template>
                      </template>
                    </template>
                  </template>
                </tbody>
              </table>
            </div>
            <div v-if="showRiskBase" class="note">
              <b>Avg Failure Rate</b> = <b>Total Failure</b> ÷ <b>Total Recording</b>, ditulis sebagai
              kelipatan (mis. 2.8x) dan bukan persen — lihat alinea berikutnya. <b>Total Recording</b> =
              jumlah <b>rekaman (PDF)</b> yang dinilai; panggilan milik agent lain pada tiket dua-agent
              tidak ikut dihitung. Kolom <b>Submission</b> di sebelahnya adalah jumlah ticket id;
              <b>Qualified</b> + <b>Pending</b> + <b>Not Qualified</b> menjumlah ke sana, bukan ke
              Total Recording.
              Di tabel ini kolom Risk Base menghitung <b>PELANGGARAN</b>, bukan tiket:
              satu tiket dengan empat pelanggaran High menyumbang 4 ke kolom High, bukan 1.
              Karena itu <b>Total Failure</b> bisa lebih besar dari kolom <b>Not Qualified</b> —
              itu memang tujuannya, supaya tiket yang melanggar banyak hal tidak terbaca
              sama beratnya dengan tiket yang melanggar sekali.
              Hanya tiket <b>Not Qualified</b> yang dihitung: tiket Qualified dan Pending tidak
              menyumbang apa pun ke High/Medium/Low maupun Total Failure, walau tiket Qualified
              bisa saja membawa error code.
              <b>Total Failure</b> = High + Medium + Low saja<template v-if="showRiskSystemNew">; System dan New tidak ikut dijumlahkan</template>.
              Baris Risk Base L pada item scorecard <i>tolerable</i> tidak ikut dihitung.
              Angka di tabel ini memakai definisi sendiri — tidak sebanding begitu saja dengan
              <b>Performa Campaign</b> (satu risk base tertinggi per tiket, penyebutnya
              Not Qualified) atau KPI Overview.
            </div>
            <div v-else class="note">
              <b>Avg Failure Rate</b> = <b>Total Failure</b> ÷ <b>Total Recording</b>, ditulis sebagai
              kelipatan (mis. 2.8x). <b>Total Recording</b> = jumlah <b>rekaman (PDF)</b> yang dinilai,
              bukan jumlah tiket — jumlah tiketnya ada di kolom <b>Submission</b> di sebelahnya.
              Dihitung hanya dari
              tiket Not Qualified, dan tiap pelanggaran dihitung sendiri-sendiri — bukan satu
              per tiket. Klik baris AM atau TL untuk membuka level di bawahnya.
            </div>
          </div>

          <!-- Daftar QC — hanya untuk pengelola divisi QC (TL QC / SPQ Head / Admin). -->
          <div v-if="canSeeQcTable" class="panel">
            <div class="panel-title">Daftar QC</div>
            <TblToolbar :v="qcView" label="Daftar QC" :modes="QC_MODES"
                        placeholder="Cari nama atau NIP QC…" />
            <div class="table-scroll">
              <table class="mtable tree">
                <thead>
                  <tr>
                    <th class="sortable" @click="qcView.sortBy('name')">QC <span class="sort-ind">{{ qcView.indicator('name') }}</span></th>
                    <th class="num col-n sortable" @click="qcView.sortBy('assigned')">Assigned <span class="sort-ind">{{ qcView.indicator('assigned') }}</span></th>
                    <th class="num col-n sortable" @click="qcView.sortBy('approved')">Checked <span class="sort-ind">{{ qcView.indicator('approved') }}</span></th>
                    <th class="num rate-col sortable" @click="qcView.sortBy('approve_rate')">Checked Rate <span class="sort-ind">{{ qcView.indicator('approve_rate') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loadingQcPerf"><td colspan="4" class="empty"><span class="spin-inline"></span> Memuat...</td></tr>
                  <tr v-else-if="!qcView.total"><td colspan="4" class="empty">
                    {{ qcPerformance.length ? 'Tidak ada yang cocok dengan pencarian/filter.' : 'Belum ada akun QC.' }}
                  </td></tr>
                  <tr v-for="q in qcView.rows" :key="q.qc_username" class="lvl-ag">
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
            <Pager :v="qcView" label="QC" />
            <div class="note">
              <b>Assigned</b> = tiket yang ditugaskan ke QC tersebut · <b>Checked</b> = tiket yang sudah
              ditandai dicek manual olehnya · <b>Checked Rate</b> = Checked ÷ Assigned. Tiket yang
              dipindah ke QC lain tidak lagi dihitung untuk pemilik lama.
            </div>
          </div>
        </template>
      </template>

      <!-- ========================= FAILURE REASON ========================= -->
      <!-- Hanya SPQ Head & Admin: kategori scorecard yang paling sering gagal + alasannya. -->
      <template v-else-if="tab === 'failure'">
        <!-- Dua sub-tab dengan pertanyaan berbeda: "Agregat" = kategori apa yang
             paling sering gagal secara keseluruhan; "Hierarki Based" = kegagalan
             terbesar TIAP orang (AM/TL/TLO) ada di kategori apa. -->
        <div class="subtab-group">
          <button :class="['subtab', { active: failureMode === 'aggregate' }]"
                  @click="openFailureMode('aggregate')">Agregat</button>
          <button :class="['subtab', { active: failureMode === 'hierarchy' }]"
                  @click="openFailureMode('hierarchy')">Hierarki Based</button>
        </div>

        <!-- ------------------------- 1. AGREGAT ------------------------- -->
        <template v-if="failureMode === 'aggregate'">
        <div v-if="loadingFailure && !failureData" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 5" :key="i" style="height:44px"></div>
        </div>
        <template v-else-if="failureData">
          <div class="kpis">
            <!-- Total Submission memakai bentuk kartu yang SAMA dengan Not Qualified,
                 dibedakan hanya oleh warna: biru = angka volume, merah = angka buruk. -->
            <div class="kpi" style="--accent: var(--m-info)">
              <div class="kpi-label">Total Submission</div>
              <div class="kpi-value mono">{{ fmt(failureData.total_submissions || 0) }}</div>
              <div class="kpi-sub">seluruh tiket yang dinilai</div>
            </div>
            <div class="kpi" style="--accent: var(--m-danger)">
              <div class="kpi-label">Total Ticket Not Qualified</div>
              <div class="kpi-value mono">{{ fmt(failureData.total_evaluated) }}</div>
              <div class="kpi-sub">basis persentase kegagalan kategori</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Kategori Scorecard yang Sering Gagal</div>
            <TblToolbar :v="failureView" label="Kategori Scorecard yang Sering Gagal"
                        placeholder="Cari kategori atau alasan…" />
            <div class="table-scroll">
              <table class="mtable">
                <thead>
                  <tr>
                    <th class="sortable" @click="failureView.sortBy('category')">Kategori <span class="sort-ind">{{ failureView.indicator('category') }}</span></th>
                    <th class="num sortable" @click="failureView.sortBy('fail_count')">Failure <span class="sort-ind">{{ failureView.indicator('fail_count') }}</span></th>
                    <th>Alasan Teratas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!failureView.total"><td colspan="3" class="empty">
                    {{ failureCategories.length ? 'Tidak ada yang cocok dengan pencarian.' : 'Belum ada kegagalan tercatat.' }}
                  </td></tr>
                  <tr v-for="c in failureView.rows" :key="c.category">
                    <td class="campaign-name">{{ c.category }}</td>
                    <td class="num mono">{{ fmt(c.fail_count) }}</td>
                    <td>
                      <ul class="reason-list">
                        <li v-for="(rr, i) in c.top_reasons" :key="i">
                          <span class="reason-req">{{ rr.requirement }}</span>
                          <span class="reason-count">×{{ rr.count }}</span>
                          <span v-if="rr.example" class="reason-example" :title="rr.example">— {{ rr.example }}</span>
                        </li>
                        <li v-if="!c.top_reasons.length" class="reason-empty">—</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Pager :v="failureView" label="kategori" />
            <div class="note">
              Tab ini <b>hanya memuat tiket Not Qualified</b> — tiket Qualified dan Pending tidak
              ikut, baik ke pembilang maupun penyebut. ·
              <b>Failure</b> = jumlah tiket Not Qualified dengan ≥1 item scorecard <b>BELUM_SESUAI</b>
              pada kategori itu · <b>Alasan Teratas</b> = requirement item yang paling sering gagal.
              Tidak semua tiket Not Qualified punya kategori scorecard: ada yang gagal lewat
              verifikasi data atau kekurangan dokumen, sehingga tidak menyumbang ke kategori mana pun.
            </div>
          </div>
        </template>
        </template>

        <!-- --------------------- 2. HIERARKI BASED --------------------- -->
        <template v-else>
        <div v-if="loadingFailureHier && !failureHier" class="skeleton-wrap">
          <div class="skeleton" v-for="i in 5" :key="i" style="height:44px"></div>
        </div>
        <template v-else-if="failureHier">
          <div class="kpis">
            <div class="kpi" style="--accent: var(--m-info)">
              <div class="kpi-label">Total Submission</div>
              <div class="kpi-value mono">{{ fmt(failureHier.total_submissions || 0) }}</div>
              <div class="kpi-sub">seluruh tiket yang dinilai</div>
            </div>
            <div class="kpi" style="--accent: var(--m-danger)">
              <div class="kpi-label">Total Ticket Not Qualified</div>
              <div class="kpi-value mono">{{ fmt(failureHier.all_telesales.evaluated) }}</div>
              <div class="kpi-sub">seluruh telesales</div>
            </div>
            <div class="kpi" style="--accent: var(--m-warning, #D97706)">
              <div class="kpi-label">Kategori Terbesar — All Telesales</div>
              <!-- TIGA teratas, bukan satu: peringkat 2-3 sering berselisih tipis
                   dari yang teratas, sehingga menampilkan pemenangnya saja membuat
                   satu kategori terlihat dominan padahal tidak. Fontnya sengaja
                   lebih kecil dari .kpi-value supaya tiga baris ini setinggi kartu
                   KPI lain sebarisnya — kartu KPI diregangkan grid mengikuti yang
                   tertinggi, jadi kartu ini tidak boleh menumbuhkan barisnya. -->
              <ol class="kpi-top3">
                <li v-for="(c, i) in topCategoriesOf(failureHier.all_telesales)" :key="'tc' + c.category">
                  <span class="rank">{{ i + 1 }}</span>
                  <span class="name" :title="c.category">{{ c.category }}</span>
                  <span class="count mono">{{ fmt(c.fail_count) }}</span>
                </li>
                <li v-if="!topCategoriesOf(failureHier.all_telesales).length" class="none">—</li>
              </ol>
              <div class="kpi-sub">{{ topCategorySubOf(failureHier.all_telesales) }}</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Failure Reason per Hierarki — Area Manager → Team Leader → Agent</div>
            <div class="table-scroll">
              <!-- Bentuknya sengaja dibuat sama dengan tabel Hierarki Failure Rate:
                   satu kolom angka per KATEGORI, bukan chip ringkasan. Kolomnya
                   mengikuti urutan ``conversation_phases`` di KB (dikirim backend
                   sebagai ``categories_order``), jadi tabel ini terbaca mengikuti
                   alur telepon dan otomatis menyesuaikan bila KB-nya berubah. -->
              <table class="mtable tree hier">
                <colgroup>
                  <col />
                  <col style="width: 118px" />
                  <col v-for="c in failureColumns" :key="'fc'+c" style="width: 92px" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th class="num col-n">Tiket Not Qualified</th>
                    <!-- Nama fase disingkat supaya 10 kolom muat; nama penuhnya tetap
                         tersedia lewat tooltip, karena singkatan saja bisa ambigu
                         (Penj. MC vs Penj. MUS). -->
                    <th v-for="c in failureColumns" :key="'fh'+c" class="num col-n" :title="c">{{ shortCat(c) }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!failureHier.area_managers.length"><td :colspan="failureColCount" class="empty">Belum ada kegagalan tercatat.</td></tr>
                  <tr class="lvl-all">
                    <td><span class="twist-pad"></span><span class="lvl-tag all">ALL</span> All Telesales</td>
                    <FailCells :n="failureHier.all_telesales" :cols="failureColumns" />
                  </tr>
                  <template v-for="am in failureHier.area_managers" :key="'fam'+am.name">
                    <tr class="lvl-am" @click="toggle('fam', am.name)">
                      <td>
                        <span class="twist">{{ isOpen('fam', am.name) ? '▾' : '▸' }}</span>
                        <span class="lvl-tag am">AM</span> {{ am.name }}
                      </td>
                      <FailCells :n="am" :cols="failureColumns" />
                    </tr>
                    <template v-if="isOpen('fam', am.name)">
                      <template v-for="tl in am.team_leaders" :key="'ftl'+am.name+tl.name">
                        <tr class="lvl-tl" @click="toggle('ftl', am.name + '|' + tl.name)">
                          <td class="pad-1">
                            <span class="twist">{{ isOpen('ftl', am.name + '|' + tl.name) ? '▾' : '▸' }}</span>
                            <span class="lvl-tag tl">TL</span> {{ tl.name }}
                          </td>
                          <FailCells :n="tl" :cols="failureColumns" />
                        </tr>
                        <template v-if="isOpen('ftl', am.name + '|' + tl.name)">
                          <!-- Baris TLO bisa dibuka: isinya satu baris per ticket id
                               milik agent itu, kolomnya sama persis — jadi langsung
                               terbaca "tiket XX gagal di Greeting dan Probing". -->
                          <template v-for="ag in tl.agents" :key="'fag'+ag.agent_id+ag.name">
                            <tr class="lvl-ag" @click="ag.tickets && ag.tickets.length && toggle('fag', agentKey(am, tl, ag))">
                              <td class="pad-2">
                                <span v-if="ag.tickets && ag.tickets.length" class="twist">{{ isOpen('fag', agentKey(am, tl, ag)) ? '▾' : '▸' }}</span>
                                <span v-else class="twist-pad"></span>
                                <span class="lvl-tag tlo">TLO</span> {{ ag.name }}
                              </td>
                              <FailCells :n="ag" :cols="failureColumns" />
                            </tr>
                            <template v-if="isOpen('fag', agentKey(am, tl, ag))">
                              <tr v-for="tk in ag.tickets" :key="'ftk'+ag.agent_id+tk.ticket_id" class="lvl-tk">
                                <td class="pad-3">
                                  <span class="lvl-tag tkt">ID</span> <span class="mono">{{ tk.ticket_id }}</span>
                                  <span class="tk-fails">{{ failedPhasesOf(tk) }}</span>
                                </td>
                                <FailCells :n="tk" :cols="failureColumns" />
                              </tr>
                            </template>
                          </template>
                        </template>
                      </template>
                    </template>
                  </template>
                </tbody>
              </table>
            </div>
            <div class="note">
              Klik baris AM atau TL untuk membuka level di bawahnya, lalu klik baris <b>TLO</b>
              untuk melihat <b>ticket id</b>-nya satu per satu beserta fase mana yang gagal.
              Seluruh angka di sini <b>hanya menghitung tiket Not Qualified</b>.
              <b>Tiket Not Qualified</b> = tiket Not Qualified milik simpul itu ·
              tiap <b>kolom kategori</b> = jumlah tiket yang punya ≥1 item BELUM_SESUAI pada kategori itu.
              Satu tiket bisa gagal di beberapa kategori sekaligus, jadi menjumlahkan kolom kategori
              TIDAK akan sama dengan Tiket Not Qualified.
              Urutan kolom mengikuti <b>conversation_phases</b> pada KB campaign — arahkan kursor ke
              judul kolom untuk melihat nama lengkapnya.
            </div>
          </div>
        </template>
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
// Diimpor dengan nama TblToolbar/Pager — nama yang sudah dipakai template di atas.
import TblToolbar from '../../components/TableToolbar.vue'
import Pager from '../../components/TablePager.vue'
import { useDataStore } from '../../stores/data.js'
import { useAuthStore } from '../../stores/auth.js'
import { P } from '../../permissions.js'
import { aiStatusLabel } from '../../utils/aiStatus.js'
import { campaignsInScope } from '../../utils/campaignScope.js'
import '../../assets/mega.css'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const dataStore = useDataStore()
const auth = useAuthStore()
// Posisi di hierarki sales = data_scope, bukan nama role. Role turunan per campaign
// (mis. tl_ntb dengan cakupan sales_tl) otomatis mendapat panel & judul yang sama.
const isSalesAgent = computed(() => auth.dataScope === 'sales_agent')
const isTeamLeader = computed(() => auth.dataScope === 'sales_tl')
// Team Leader (team) & Sales Agent (own) get the scoped view; only labels differ.
// Area Manager & Telesales Head memakai dashboard global (Overview + tab Hierarki
// Failure Rate) seperti spq_head/qc — bedanya pohon hierarki untuk AM sudah difilter
// backend ke node AM-nya sendiri (lihat stats_hierarchy di api/routers/stats.py).
const isScopedRole = computed(() => isSalesAgent.value || isTeamLeader.value)
const scopeTitle = computed(() => (isTeamLeader.value ? 'Statistik Tim Anda' : 'Statistik Anda'))
const scopeHint = computed(() => (isTeamLeader.value
  ? 'Hanya tiket agent di bawah Anda · auto-refresh 30 detik'
  : 'Hanya tiket Anda · auto-refresh 30 detik'))
const scopeListTitle = computed(() => (isTeamLeader.value ? 'Daftar Ticket ID Tim Anda' : 'Daftar Ticket ID Anda'))
const scopeEmpty = computed(() => (isTeamLeader.value ? 'Belum ada tiket untuk tim Anda.' : 'Belum ada tiket untuk Anda.'))

// Kolom Qualified, Pending, Risk Base (High/Medium/Low/System/New) dan Total Failure
// adalah detail internal QC — sisi sales hanya melihat Submissions, Errors,
// Failure Rate (sama seperti tampilan TLO). Berlaku juga untuk Telesales Head, yang scope-nya
// global tapi tetap sisi sales.
const showRiskBase = computed(() => auth.can(P.STATS_RISK_BASE))

// Panel "Performa Campaign — Month to Month" DISEMBUNYIKAN UNTUK SEMUA ROLE atas
// permintaan bisnis (31 Agustus 2026). Sebelumnya panel ini hanya di-takeout dari
// sisi sales (28 Agustus 2026) — Area Manager & Telesales Head — dengan capability
// yang sama seperti kolom Risk Base, karena isinya memang seluruhnya kolom Risk Base.
//
// Aturan lama sengaja DIPERTAHANKAN di bawah, tinggal dinyalakan lagi dengan
// mengembalikan nilainya ke `showRiskBase.value`. Seluruh pemuatan datanya ikut mati
// sendiri: `loadCampaignMonthly` sudah menjaga dirinya pada flag ini, jadi
// menyembunyikan panel juga menghemat satu permintaan ke backend, bukan cuma
// menyembunyikan elemen yang tetap dimuat.
const showCampaignPerformance = computed(() => false && showRiskBase.value)

// Risk Base "System" (kode O) & "New" (kode N) adalah detail internal scoring —
// hanya untuk SPQ Head/Admin dan Team Leader QC. QC biasa dan QC Support melihat
// High/Medium/Low + Total Failure saja. Total Failure = H+M+L, jadi angkanya tetap
// utuh tanpa kedua kolom ini.
// "demo" (read-only showcase) mirrors the SPQ dashboard, incl. System/New risk cols.
const showRiskSystemNew = computed(() => auth.can(P.STATS_RISK_SYSTEM_NEW))

// Toolbar (cari/saring/Reset) dan navigasi halaman dipakai SEMUA tabel di halaman ini,
// jadi keduanya tinggal di berkas komponennya sendiri. Sempat ditulis sebagai
// render-function di berkas INI, tetapi style di bawah bersifat `scoped`: elemen yang
// dibuat di dalam sebuah functional component tidak menerima atribut `data-v-…` milik
// induknya (hanya elemen akarnya yang menerima), sehingga kotak cari, dropdown, tombol
// Reset, dan tombol halaman kehilangan seluruh style-nya dan jatuh ke tampilan bawaan
// browser. Sebagai komponen berkas sendiri, style-nya ikut pindah dan pasti kena.

// --- Kendali tabel bersama: cari / saring / urutkan / halaman -------------
// Dipakai SEMUA tabel datar di halaman ini — Performa Sales, Daftar QC, Performa
// Campaign, Failure Reason, dan kedua tabel pada tampilan scoped (Daftar Sales
// Agent Tim Anda & Daftar Ticket ID Anda). Ditulis sekali sebagai factory supaya
// perilakunya tidak menyimpang antar tabel — mis. lupa mereset halaman ke 1
// setelah mencari, yang membuat tabel tampak kosong padahal datanya ada.
//
// ``extra`` menyambungkan kontrol yang HIDUP DI LUAR factory (mis. dropdown bulan
// pada Performa Campaign) ke tombol Reset. Tanpa itu Reset akan mengaku
// "mengembalikan semuanya" padahal menyisakan satu filter yang masih aktif.
function useTableView(source, { fields, sortKey, sortDir = 'desc', perPage = 10, filterFn, extra }) {
  const search = ref('')
  const mode = ref('')            // filter tambahan; '' = semua
  const key = ref(sortKey)
  const dir = ref(sortDir)
  const page = ref(1)
  // Nilai awal disimpan supaya Reset benar-benar mengembalikan SEMUANYA — termasuk
  // urutan kolom, yang gampang terlupa kalau reset hanya mengosongkan kotak cari.
  const initial = { key: sortKey, dir: sortDir }

  const filtered = computed(() => {
    let list = source.value || []
    if (filterFn && mode.value) list = list.filter((r) => filterFn(r, mode.value))
    const q = search.value.trim().toLowerCase()
    if (q) {
      // ``fields`` boleh berupa fungsi supaya kolom yang dicari mengikuti kolom yang
      // benar-benar TAMPIL. Mencari nama Team Leader padahal kolomnya disembunyikan
      // hanya menghasilkan baris yang tak jelas kenapa cocok.
      const fs = typeof fields === 'function' ? fields() : fields
      // Tiap entri boleh berupa nama kolom ATAU fungsi (r) => teks — dipakai saat yang
      // dicari adalah teks yang TAMPIL, bukan nilai mentahnya (mis. AI Status tampil
      // "Qualified" padahal datanya "PASS", dan bulan tampil "Agustus 2026" dari "2026-08").
      list = list.filter((r) => fs.some((f) => String(
        (typeof f === 'function' ? f(r) : r[f]) ?? '').toLowerCase().includes(q)))
    }
    const sign = dir.value === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = a[key.value]
      const vb = b[key.value]
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign
      return String(va ?? '').localeCompare(String(vb ?? ''), 'id') * sign
    })
  })

  const total = computed(() => filtered.value.length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / perPage)))
  const rows = computed(() => {
    const p = Math.min(page.value, pageCount.value)
    return filtered.value.slice((p - 1) * perPage, p * perPage)
  })
  const from = computed(() => (total.value ? (Math.min(page.value, pageCount.value) - 1) * perPage + 1 : 0))
  const to = computed(() => Math.min(from.value + perPage - 1, total.value))

  function sortBy(k) {
    if (key.value === k) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
    else {
      key.value = k
      dir.value = 'desc'
    }
    page.value = 1
  }
  function indicator(k) {
    if (key.value !== k) return '⇅'
    return dir.value === 'asc' ? '▲' : '▼'
  }
  function go(p) {
    page.value = Math.min(Math.max(1, p), pageCount.value)
  }

  // Tombol Reset SELALU tampil (dinonaktifkan saat bersih). Versi sebelumnya
  // menyembunyikannya sampai ada filter aktif — hasilnya tidak pernah ditemukan orang,
  // karena fitur yang hanya muncul setelah dipakai tidak bisa ditemukan sebelum dipakai.
  const isDirty = computed(
    () => !!search.value || !!mode.value || key.value !== initial.key || dir.value !== initial.dir
      || (extra ? extra.isDirty() : false))
  function reset() {
    search.value = ''
    mode.value = ''
    key.value = initial.key
    dir.value = initial.dir
    page.value = 1
    extra?.reset()
  }

  // Mencari/menyaring selalu kembali ke halaman 1; kalau datanya menyusut sampai
  // halaman aktif tidak ada lagi, mundur ke halaman terakhir yang masih ada.
  watch([search, mode, source], () => { page.value = 1 })
  watch(pageCount, (n) => { if (page.value > n) page.value = n })

  // reactive(): ref di dalamnya ikut ter-unwrap, sehingga template cukup menulis
  // ``salesView.search`` (termasuk untuk v-model) tanpa ``.value`` di mana-mana.
  return reactive({
    search, mode, page, pageCount, rows, total, from, to,
    sortBy, indicator, go, isDirty, reset,
  })
}

// Performa Sales: atasan perlu tahu agent ini di bawah siapa. Area Manager
// melihat kolom Team Leader (satu tingkat di bawahnya); Telesales Head melihat
// kolom Area Manager karena cakupannya lintas area.
const showTeamLeaderCol = computed(() => auth.dataScope === 'sales_am')
// Kolom Area Manager untuk pengawas sisi sales yang melihat SELURUH organisasi
// (Telesales Head): cakupannya 'all' tetapi tidak memegang detail evaluasi seperti
// sisi QC. Dinyatakan lewat capability supaya role sejenis ikut tercakup.
const showAreaManagerCol = computed(
  () => auth.dataScope === 'all' && !auth.can(P.RESULTS_EVALUATION_DETAIL))
// Nama + Campaign + Submissions + Pending + Not Qualified + Not Qualified Rate = 6 dasar.
const salesColCount = computed(
  () => 6 + (showTeamLeaderCol.value ? 1 : 0) + (showAreaManagerCol.value ? 1 : 0))

// Jumlah kolom tabel Hierarki Failure Rate, mengikuti kedua flag di atas:
//   Nama + Total Recording + Failure Rate = 3 dasar
//   + Qualified, Pending, Total Failure, High, Medium, Low  (showRiskBase)
//   + System, New                                           (showRiskSystemNew)
const hierColCount = computed(() => {
  // +1 sejak kolom ticket id ditambahkan (31 Agustus 2026).
  if (!showRiskBase.value) return 5 // Nama, Total Recording, Submission, Total Failure, Failure Rate
  return showRiskSystemNew.value ? 13 : 11
})

// ---- Sales Agent (Team Leader) scoped view ----
const myOverview = ref(null)
const loadingMine = ref(true)
const tickets = ref([])
const ticketsTotal = ref(0)
const loadingTickets = ref(false)
const teamAgents = ref([]) // Team Leader: roster of their sales agents + per-agent stats

// Daftar Sales Agent Tim Anda (Team Leader). Filternya sengaja sama persis dengan
// Performa Sales — pertanyaannya juga sama: dari sekian agent, siapa yang belum
// menghasilkan satu tiket pun.
const teamView = useTableView(teamAgents, {
  fields: ['name', 'nip_baru'],
  sortKey: 'submissions',
  filterFn: (r, m) => (m === 'has' ? r.submissions > 0 : !r.submissions),
})
// Dipakai Daftar Sales Agent Tim Anda DAN Performa Sales: keduanya berisi sales agent
// dan menjawab pertanyaan yang sama, jadi pilihan filternya tidak boleh berbeda bunyi.
const AGENT_MODES = [
  { value: '', label: 'Semua Agent' },
  { value: 'has', label: 'Sudah ada submission' },
  { value: 'none', label: 'Belum ada submission' },
]

// Kalimat kosong untuk tabel yang memakai AGENT_MODES. Dulu semuanya berbunyi
// "Tidak ada yang cocok dengan pencarian/filter" — benar tetapi tidak menjawab
// apa pun: pembaca sudah tahu filternya tidak menghasilkan apa-apa, yang ingin ia
// tahu adalah KENYATAAN apa yang membuatnya kosong. Dengan dropdown "Belum ada
// submission" yang kosong, kenyataannya justru kabar baik — semua agent sudah
// submit — dan itu yang sekarang tertulis (permintaan 14 Agustus 2026).
//
// Pencarian teks tetap menang: kalau kotak cari terisi, yang mengosongkan tabel
// bisa jadi kata kuncinya, bukan mode-nya.
function agentEmptyText(view, source, emptySource) {
  if (!source.length) return emptySource
  if (view.search.trim()) return 'Tidak ada yang cocok dengan pencarian.'
  if (view.mode === 'none') return 'Tidak ditemukan agent yang belum melakukan submisi'
  if (view.mode === 'has') return 'Belum ada agent yang melakukan submisi'
  return 'Tidak ada yang cocok dengan pencarian/filter.'
}

// Daftar Ticket ID Anda (Sales Agent). Dicari lewat teks yang TAMPIL: AI Status
// tersimpan sebagai PASS/FAIL/PENDING tetapi yang dibaca orang adalah
// "Qualified"/"Not Qualified"/"Pending", jadi itulah yang harus cocok saat diketik.
const myTicketsView = useTableView(tickets, {
  fields: ['id', 'campaign', (r) => (r.ai_status ? aiStatusLabel(r.ai_status) : '')],
  sortKey: 'submit_time',
  filterFn: (r, m) => (m === 'none' ? !r.ai_status : r.ai_status === m),
})
const TICKET_MODES = [
  { value: '', label: 'Semua AI Status' },
  { value: 'PASS', label: 'Qualified' },
  { value: 'FAIL', label: 'Not Qualified' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'none', label: 'Belum dinilai' },
]

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
  ai_status_breakdown: { approve: 0, return: 0, pending: 0 },
  manual_status_breakdown: { approve: 0, return: 0, pending: 0, decided: 0, belum_dinilai: 0, error_rate: 0 },
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

// Performa Sales: cari nama/TL/AM/campaign, saring berdasarkan ada-tidaknya
// submission (baris nol kini banyak setelah tabel di-seed dari roster).
const salesView = useTableView(agents, {
  fields: () => [
    'name',
    ...(showTeamLeaderCol.value ? ['team_leader'] : []),
    ...(showAreaManagerCol.value ? ['area_manager'] : []),
    'campaign',
  ],
  sortKey: 'submissions',
  filterFn: (r, m) => (m === 'has' ? r.submissions > 0 : r.submissions === 0),
})

// Placeholder menyebutkan HANYA kolom yang tampil. Tabel ini berisi sales agent;
// kolom Team Leader hanya muncul untuk Area Manager, dan kolom Area Manager hanya
// untuk Telesales Head — menjanjikan keduanya ke semua orang itu menyesatkan.
const salesSearchHint = computed(() => {
  const extra = []
  if (showTeamLeaderCol.value) extra.push('Team Leader')
  if (showAreaManagerCol.value) extra.push('Area Manager')
  return `Cari nama sales agent${extra.length ? ', ' + extra.join(', ') : ''}, atau campaign…`
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
// AI status bar chart: PASS = Qualified (hijau), FAIL = Not Qualified (merah),
// PENDING = butuh dokumen dalam tenggat H+2 (kuning).
//
// 28 Agustus 2026 — permintaan bisnis KHUSUS bar chart (tidak menyentuh KPI card,
// badge, atau tabel yang tetap memakai --m-success/--m-danger/#D97706):
//   hijau  -> hijau stabilo, tulisan hitam   (dulu #1F8A4C)
//   merah  -> digelapkan,    tulisan putih   (dulu #C73838)
//   kuning -> diterangkan,   tulisan hitam   (dulu #D97706)
// ``AI_LABEL_COLORS`` dipakai plugin ``barPct`` untuk mewarnai persentase di dalam
// tiap segmen; tanpa ini semua label tetap putih dan hilang di atas kuning terang.
const AI_COLORS = { approve: '#5CE65C', return: '#9B1C1C', pending: '#FFD93D' }
const AI_LABEL_COLORS = { approve: '#1E1F21', return: '#FFFFFF', pending: '#1E1F21' }

// Build a 100% stacked column: X = time buckets, Y = 0–100%, three stacked series
// (Qualified green / Not Qualified red / Pending amber). Percentages are precomputed
// per bucket over the total dinilai (a+r+p); raw counts ride along on ``_counts``.
// `prefix` memilih sisi mana yang digambar: '' = AI Status, 'manual_' = Manual Status.
// Keduanya memakai bucket yang SAMA dari satu respons, jadi kedua grafik sejajar
// sumbu waktunya dan bisa dibandingkan batang per batang.
function stackedData(series, prefix = '') {
  const buckets = series?.buckets || []
  const labels = buckets.map((b) => b.label)
  const approvePct = [], returnPct = [], pendingPct = [], approveCnt = [], returnCnt = [], pendingCnt = []
  for (const b of buckets) {
    const a = b[`${prefix}approve`] || 0, r = b[`${prefix}return`] || 0, p = b[`${prefix}pending`] || 0
    const t = a + r + p
    approveCnt.push(a); returnCnt.push(r); pendingCnt.push(p)
    approvePct.push(t ? (a / t) * 100 : 0)
    returnPct.push(t ? (r / t) * 100 : 0)
    pendingPct.push(t ? (p / t) * 100 : 0)
  }
  return {
    labels,
    datasets: [
      { label: 'Qualified', data: approvePct, backgroundColor: AI_COLORS.approve, _labelColor: AI_LABEL_COLORS.approve, stack: 'ai', _counts: approveCnt, maxBarThickness: 46 },
      { label: 'Not Qualified', data: returnPct, backgroundColor: AI_COLORS.return, _labelColor: AI_LABEL_COLORS.return, stack: 'ai', _counts: returnCnt, maxBarThickness: 46 },
      { label: 'Pending', data: pendingPct, backgroundColor: AI_COLORS.pending, _labelColor: AI_LABEL_COLORS.pending, stack: 'ai', _counts: pendingCnt, maxBarThickness: 46 },
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
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 1) percentage centred inside each segment, dalam warna milik dataset itu
    //    (``_labelColor``): hitam di atas hijau stabilo & kuning terang, putih di
    //    atas merah gelap. Bayangannya ikut warna label supaya kontrasnya menambah,
    //    bukan mengaburkan — label hitam dulu memakai bayangan hitam dan jadi tebal
    //    berlumur di atas kuning.
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return
      const labelColor = ds._labelColor || '#fff'
      ctx.fillStyle = labelColor
      ctx.shadowColor = labelColor === '#FFFFFF' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.55)'
      ctx.shadowBlur = 3
      meta.data.forEach((bar, i) => {
        const v = Number(ds.data[i]) || 0
        if (!v) return
        const height = Math.abs(bar.base - bar.y)
        if (height < 14 || bar.width < 18) return // too small to label legibly
        ctx.fillText(`${Math.round(v)}%`, bar.x, (bar.y + bar.base) / 2)
      })
    })
    // 2) total dinilai (qualified + not qualified + pending) above each column
    const meta0 = chart.getDatasetMeta(0)
    const cA = chart.data.datasets[0]?._counts || []
    const cR = chart.data.datasets[1]?._counts || []
    const cP = chart.data.datasets[2]?._counts || []
    const yTop = chart.chartArea.top - 9
    ctx.shadowBlur = 0
    ctx.fillStyle = '#1E1F21' // ikut aturan "semua tulisan hitam" (dulu #334155)
    ctx.font = '800 12px "Plus Jakarta Sans", Inter, system-ui, -apple-system, sans-serif'
    meta0.data.forEach((bar, i) => {
      const total = (Number(cA[i]) || 0) + (Number(cR[i]) || 0) + (Number(cP[i]) || 0)
      if (!total || bar.width < 14) return
      ctx.fillText(total.toLocaleString('id-ID'), bar.x, yTop)
    })
    ctx.restore()
  },
}

// Totals across all buckets in the current range — feeds the KPI cards + legend.
function seriesTotals(series) {
  let a = 0, r = 0, p = 0, s = 0, dn = 0, ip = 0
  for (const b of series?.buckets || []) {
    a += b.approve || 0; r += b.return || 0; p += b.pending || 0
    s += b.submissions || 0; dn += b.done || 0; ip += b.in_progress || 0
  }
  // total = Total Dinilai (Qualified + Not Qualified + Pending)
  return { approve: a, return: r, pending: p, total: a + r + p, submissions: s, done: dn, in_progress: ip }
}
function aiDonutLegend(b) {
  const a = b?.approve || 0, r = b?.return || 0, p = b?.pending || 0
  const total = (a + r + p) || 1
  const pct = v => ((v / total) * 100).toFixed(1)
  return [
    { label: 'Qualified', value: a, color: AI_COLORS.approve, pct: pct(a) },
    { label: 'Not Qualified', value: r, color: AI_COLORS.return, pct: pct(r) },
    { label: 'Pending', value: p, color: AI_COLORS.pending, pct: pct(p) },
  ]
}

// ---- formatting / color helpers ----
function fmt(n) { return (n ?? 0).toLocaleString('id-ID') }
// Persentase 1 desimal dari bagian/total (0 bila total 0).
function pctOf(part, total) { return total ? +(part / total * 100).toFixed(1) : 0 }

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
// Belum ada submission bukan berarti "0% error". Membedakan keduanya penting:
// 0% terbaca sebagai prestasi, padahal orangnya belum dinilai sama sekali.
// Failure Rate = Total Failure / Total Recording. Pembilangnya menghitung SETIAP risk
// base milik tiket Not Qualified (``risk_base_tally``, bukan satu yang tertinggi),
// sedangkan penyebutnya jumlah TRANSKRIP — jadi satu tiket bisa menyumbang lebih dari
// satu dan rasionya sah melewati 100%. Contoh nyata: 160908U5GK menyumbang 11 risk
// base atas 2 transkrip (550%).
//
// Angka seperti "550%" terbaca sebagai salah hitung, jadi yang di atas 100
// ditampilkan "100%+" (permintaan bisnis 31 Agustus 2026). Yang dibatasi HANYA
// TAMPILANNYA: nilai aslinya tetap dipakai untuk warna badge, pengurutan baris, dan
// penyorotan baris berisiko — membatasi angkanya sendiri akan membuat dua agent yang
// jauh berbeda tampak setara di urutan.
function rateText(rate, submissions) {
  if (!submissions) return '—'
  return rate > 100 ? '100%+' : `${rate}%`
}
function rateClassOf(rate, submissions) {
  return submissions ? rateClass(rate) : 'muted'
}

function rateClass(r) {
  if (r > 6) return 'danger'
  if (r >= 3) return 'warning'
  return 'success'
}

// ---- Avg Failure Rate (tab Hierarki) -------------------------------------
// Hierarki memakai Total Failure / tiket Not Qualified dan menampilkannya sebagai
// KELIPATAN ("4.5x"), bukan persen: satu tiket Not Qualified menyumbang semua risk
// base-nya, jadi angkanya rutin melewati 100% dan salah terbaca sebagai persentase.
// Sengaja terpisah dari rateText/rateClass, yang masih melayani Performa Sales &
// Performa Campaign — keduanya persentase sungguhan (<= 100%) dan tidak berubah.
function avgText(avg, submissions) {
  // Penjaganya tetap submissions: 0 submission = belum dinilai ("—"), sedangkan
  // sudah dinilai tapi tanpa tiket gagal adalah 0.0x dan itu prestasi nyata.
  return submissions ? `${avg}x` : '—'
}
// Ambang dalam satuan KELIPATAN, bukan persen (ambang 3/6 milik rateClass adalah
// persen). Diturunkan dari 3/5 ke 2/3 pada 2 September 2026 sore, mengikuti
// penyebut Avg Failure Rate yang pindah dari tiket Not Qualified ke Total Recording:
// penyebutnya jadi ~2x lebih besar, jadi seluruh skalanya ikut mengecil. Tanpa ini
// angka produksi (2.7x-2.9x) jatuh di bawah ambang lama dan SELURUH pohon tampak
// hijau — bukan karena kinerjanya membaik, melainkan karena skalanya berubah.
function avgClass(a) {
  if (a > 3) return 'danger'
  if (a >= 2) return 'warning'
  return 'success'
}
function avgColor(a) {
  if (a > 3) return 'var(--m-danger)'
  if (a >= 2) return 'var(--m-warning)'
  return 'var(--m-success)'
}
function avgClassOf(avg, submissions) {
  return submissions ? avgClass(avg) : 'muted'
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
const donutPending = computed(() => globalTotals.value.pending)
const donutSubmissions = computed(() => globalTotals.value.submissions)
const donutDone = computed(() => globalTotals.value.done)
const donutInProgress = computed(() => globalTotals.value.in_progress)
// Persentase tiap bucket AI Status atas Total Dinilai (untuk KPI cards).
// ``donutReturnPct`` dipakai dua kali: sebagai persentase di kartu "Total Not
// Qualified" dan sebagai nilai kartu "Not Qualified Rate" — satu sumber angka
// supaya keduanya tidak pernah berbeda (permintaan 28 Agustus 2026; kartu itu
// dulu bernama "Error Rate" dengan pembilang Total Risk H+M+L).
const donutApprovePct = computed(() => pctOf(donutApprove.value, donutTotal.value))
const donutReturnPct = computed(() => pctOf(donutReturn.value, donutTotal.value))
const donutPendingPct = computed(() => pctOf(donutPending.value, donutTotal.value))
const donutLegend = computed(() => aiDonutLegend({ approve: donutApprove.value, return: donutReturn.value, pending: donutPending.value }))

// ---- scoped (Sales Agent / Team Leader) KPI + legend totals ----
const scopedTotals = computed(() => seriesTotals(myScopedSeries.value))
const myDonutTotal = computed(() => scopedTotals.value.total)
const myDonutApprove = computed(() => scopedTotals.value.approve)
const myDonutReturn = computed(() => scopedTotals.value.return)
const myDonutPending = computed(() => scopedTotals.value.pending)
const myDonutSubmissions = computed(() => scopedTotals.value.submissions)
const myDonutDone = computed(() => scopedTotals.value.done)
const myDonutInProgress = computed(() => scopedTotals.value.in_progress)
const myDonutApprovePct = computed(() => pctOf(myDonutApprove.value, myDonutTotal.value))
const myDonutReturnPct = computed(() => pctOf(myDonutReturn.value, myDonutTotal.value))
const myDonutPendingPct = computed(() => pctOf(myDonutPending.value, myDonutTotal.value))
const myDonutLegend = computed(() => aiDonutLegend({ approve: myDonutApprove.value, return: myDonutReturn.value, pending: myDonutPending.value }))
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? String(v) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---- campaign performance (Submission / Risk Base breakdown / Error Rate), month-to-month ----
const filterMonth = ref('') // '' = "Semua Bulan"; defaults to the latest month once loaded
// Bulan yang dipilih otomatis saat data selesai dimuat. Disimpan supaya tombol Reset
// mengembalikan dropdown bulan ke kondisi AWAL (bulan terbaru), bukan ke "Semua Bulan"
// yang tidak pernah jadi tampilan awal tabel ini.
const defaultMonth = ref('')
const campaignRows = computed(() => {
  let rows = campaignData.value?.rows || []
  if (filterMonth.value) rows = rows.filter((r) => r.month === filterMonth.value)
  // Ikut filter campaign global supaya tabel ini sejalan dengan KPI & donut di
  // atasnya — sebelumnya ia satu-satunya tabel di Overview yang mengabaikannya.
  if (campaignFilter.value) {
    const want = campaignFilter.value.trim().toLowerCase()
    rows = rows.filter((r) => (r.campaign || '').trim().toLowerCase() === want)
  }
  return rows
})

// Performa Campaign. Dropdown bulan yang sudah ada TETAP di tempatnya (ia memilih
// cakupan data, bukan menyaring baris yang tampil), tetapi disambungkan ke Reset
// lewat ``extra`` supaya tombol itu benar-benar mengembalikan semuanya.
// Urutan awal sengaja 'month' menurun, bukan 'submissions': tabel ini terbuka pada
// SATU bulan (bulan terbaru), sehingga mengurutkan per bulan tidak mengubah apa pun —
// tampilan awalnya persis seperti sebelum ada fitur urut. Memilih 'submissions' akan
// diam-diam menata ulang tabel yang sudah dikenal orang.
const campaignView = useTableView(campaignRows, {
  fields: ['campaign', (r) => monthLabel(r.month)],
  sortKey: 'month',
  extra: {
    isDirty: () => filterMonth.value !== defaultMonth.value,
    reset: () => { filterMonth.value = defaultMonth.value },
  },
})

// Shared numeric cells for every level of the Hierarki Failure Rate tree
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
    h('span', { class: ['rate-badge', 'mono', avgClassOf(n.error_rate, n.submissions)] },
      avgText(n.error_rate, n.submissions)),
  ])
  // Sisi sales: cukup Total Recording / Total Failure / Failure Rate — lihat showRiskBase.
  //
  // Kolom tengah memakai ``total_risk``, BUKAN ``errors``. ``errors`` menghitung
  // TIKET yang gagal, sedangkan Failure Rate di sebelahnya dihitung dari total risk
  // base (``_rate_of`` di compliance/stats_aggregate.py) — memasang ``errors`` di
  // bawah judul "Total Failure" membuat kolomnya menamai angka lain, dan
  // Total Failure ÷ Total Recording ADALAH rasio yang tertera.
  // Sisi sales kini menerima ``total_risk``; lihat ``_HIER_RISK_FIELDS``.
  // Kolom "Submission" (``ticket_count``) berdiri tepat di sebelah Total Recording
  // sejak 31 Agustus 2026: Total Recording menghitung REKAMAN, sedangkan
  // Qualified/Pending/Not Qualified tetap vonis PER TIKET. Tanpa kolom ini ketiganya
  // tampak "tidak menjumlah" ke Total Recording dan tabelnya terbaca seperti salah hitung.
  if (!showRiskBase.value) {
    return [cell(n.submissions, null), cell(n.ticket_count, null),
            cell(n.total_risk, 'var(--m-danger)'), rate]
  }
  return [
    cell(n.submissions, null),
    cell(n.ticket_count, null),
    cell(n.approve, 'var(--m-success)'),
    cell(n.pending, '#D97706'),
    // Not Qualified = populasi yang menyumbang Total Failure. Ditampilkan supaya
    // pembacanya bisa melihat sendiri bahwa Total Failure <= Not Qualified.
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

// ---- Failure Reason tab (SPQ Head & Admin only) ----
const canSeeFailureReasons = computed(() => auth.can(P.STATS_FAILURE_REASON))
const failureData = ref(null)
const loadingFailure = ref(false)
// Campaign yang datanya sedang tersimpan. Tanpa penanda ini, cache "sudah ada data"
// akan menahan hasil campaign lama saat filternya diganti.
const failureCampaign = ref(null)
async function loadFailure(force = false) {
  if (!force && failureData.value && failureCampaign.value === campaignFilter.value) return
  loadingFailure.value = true
  try {
    failureData.value = await dataStore.fetchFailureReasons(campaignFilter.value)
    failureCampaign.value = campaignFilter.value
  } finally {
    loadingFailure.value = false
  }
}
function openFailure() {
  tab.value = 'failure'
  loadFailureMode()
}

// ---- Failure Reason: sub-tab Agregat vs Hierarki Based ----
// 'aggregate' = kategori tersering gagal secara keseluruhan (tampilan lama);
// 'hierarchy' = pohon AM -> TL -> Agent, kategori terbesar per orang.
const failureMode = ref('aggregate')
const failureHier = ref(null)
const loadingFailureHier = ref(false)
const failureHierCampaign = ref(null)

async function loadFailureHier(force = false) {
  if (!force && failureHier.value && failureHierCampaign.value === campaignFilter.value) return
  loadingFailureHier.value = true
  try {
    failureHier.value = await dataStore.fetchFailureReasonsHierarchy(campaignFilter.value)
    failureHierCampaign.value = campaignFilter.value
  } finally {
    loadingFailureHier.value = false
  }
}

// Hanya sub-tab yang sedang dibuka yang di-fetch — pohon hierarki jauh lebih mahal
// daripada agregatnya, dan tidak semua orang membukanya.
function loadFailureMode(force = false) {
  return failureMode.value === 'hierarchy' ? loadFailureHier(force) : loadFailure(force)
}

function openFailureMode(mode) {
  failureMode.value = mode
  loadFailureMode()
}

// Tiga kategori terbesar sebuah simpul, untuk KPI "Kategori Terbesar". Backend
// sudah mengurutkannya menurun dan mengirim 5 teratas per simpul (``_fail_node``),
// jadi di sini cukup dipotong — tidak ada pengurutan ulang di layar yang bisa
// berbeda dari tabelnya.
function topCategoriesOf(node) {
  return (node?.categories || []).slice(0, 3)
}
// Penyebutnya saja: jumlah failure tiap kategori sudah tertulis di barisnya sendiri.
function topCategorySubOf(node) {
  return (node?.categories || []).length
    ? `failure dari ${fmt(node?.evaluated || 0)} tiket Not Qualified`
    : 'belum ada kegagalan'
}

// Failure Reason: dicari lewat nama kategori DAN teks requirement-nya, karena yang
// diingat orang biasanya bunyi alasannya ("provisi", "bunga"), bukan nama kategorinya.
const failureCategories = computed(() => failureData.value?.categories || [])
// Kolom kategori pohon Failure Reason — urutannya ditentukan backend dari
// ``conversation_phases`` KB, jadi layar tidak perlu tahu nama fase apa pun.
const failureColumns = computed(() => failureHier.value?.categories_order || [])
const failureColCount = computed(() => 2 + failureColumns.value.length)
// Nama fase penuh terlalu panjang untuk 10 kolom bersebelahan ("Final Konfirmasi
// Mega Ultima Shield"). Disingkat menurut pola yang berulang di KB; nama penuhnya
// tetap ada di atribut title kolomnya.
const CAT_SHORTEN = [
  [/Mega Ultima Shield/g, 'MUS'],
  [/Mega Cashline/g, 'CLEN'],
  [/Penjelasan/g, 'Penj.'],
  [/Final Konfirmasi/g, 'Final'],
  [/Legal Statement/g, 'Legal'],
  [/Verifikasi/g, 'Verif.'],
]
function shortCat(c) {
  return CAT_SHORTEN.reduce((acc, [re, to]) => acc.replace(re, to), String(c || '')).trim()
}
// Item scorecard yang gagal untuk SATU tiket, ditulis di sebelah ticket id. Sengaja
// ITEM (SC_CL_26), bukan nama fase: fase-nya sudah tampil sebagai kolom di baris yang
// sama, jadi menyebutnya lagi tidak menambah apa pun — sedangkan item_code menunjuk
// tepat ke baris scorecard yang harus dibuka di menu Results.
function failedPhasesOf(tk) {
  const codes = tk?.item_codes || []
  return codes.length ? `— ${codes.join(', ')}` : '— tidak ada item scorecard yang gagal'
}
const failureView = useTableView(failureCategories, {
  fields: ['category', (r) => (r.top_reasons || []).map((x) => x.requirement).join(' ')],
  sortKey: 'fail_count',
})

// ---- QC table (Hierarki Failure Rate, QC-division managers only) ----
const canSeeQcTable = computed(() => auth.can(P.STATS_QC_PERFORMANCE))
const qcPerformance = ref([])
const loadingQcPerf = ref(false)

// Daftar QC: cari nama/username, saring berdasarkan ada-tidaknya tiket assigned.
const qcView = useTableView(qcPerformance, {
  fields: ['name', 'qc_username'],
  sortKey: 'assigned',
  filterFn: (r, m) => (m === 'has' ? r.assigned > 0 : r.assigned === 0),
})
const QC_MODES = [
  { value: '', label: 'Semua QC' },
  { value: 'has', label: 'Sudah ada tiket assigned' },
  { value: 'none', label: 'Belum ada tiket assigned' },
]

// Checked Rate reads the OPPOSITE way to Failure Rate: higher is better, so it
// cannot reuse rateClass() (which paints high values red). Nama fungsi & kunci
// payload (``approved`` / ``approve_rate``) sengaja tidak ikut diganti — hanya
// labelnya yang berubah (28 Agustus 2026).
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
    qcPerformance.value = await dataStore.fetchQcPerformance(campaignFilter.value)
  } catch {
    qcPerformance.value = []
  } finally {
    loadingQcPerf.value = false
  }
}

// Tiga sel kanan pada pohon Failure Reason: tiket dinilai, fail rate, dan kegagalan
// terbesar milik simpul itu. Fungsi render, sama seperti RiskCells, supaya <tr> tetap
// satu baris tanpa komponen pembungkus.
//
// Sel angka tiap level pohon Failure Reason (All/AM/TL/TLO): Tiket Not Qualified,
// lalu SATU kolom per kategori. Kolom Fail Rate dilepas 28 Agustus 2026 — nilainya
// 100% untuk hampir setiap simpul (tab ini memang hanya memuat tiket Not Qualified),
// jadi ia memakan lebar tanpa membedakan apa pun. ``cols`` dioper dari luar supaya keempat level memakai urutan
// kolom yang sama persis — urutan itu datang dari conversation_phases di KB.
const FailCells = (p) => {
  const n = p.n || {}
  const counts = n.cat_counts || {}
  return [
    h('td', { class: ['num', 'mono', 'col-n', !n.evaluated ? 'zero' : ''] }, fmt(n.evaluated)),
    // Nol dirender pudar supaya mata langsung jatuh ke kategori yang benar-benar gagal.
    ...(p.cols || []).map((c) => {
      const v = counts[c] || 0
      return h('td', {
        class: ['num', 'mono', 'col-n', !v ? 'zero' : ''],
        style: v ? { color: 'var(--m-danger)' } : null,
      }, fmt(v))
    }),
  ]
}

// ---- hierarchy expand state ----
// fam/ftl = pohon Failure Reason (sub-tab Hierarki Based); am/tl/hag = Hierarki
// Failure Rate. Dipisah supaya membuka satu pohon tidak ikut membuka pohon yang lain.
// ``fag`` = baris TLO Failure Reason yang dibuka menjadi daftar ticket id-nya.
const openState = reactive({ am: {}, tl: {}, hag: {}, fam: {}, ftl: {}, fag: {} })
// Kunci baris agent pada kedua pohon. Menyertakan AM & TL karena agent_id
// bisa kosong (agent tak dikenal jatuh ke "(Tidak diketahui)"), dan nama saja tidak
// dijamin unik antar-tim — tanpa ini, membuka satu baris bisa ikut membuka baris lain.
function agentKey(am, tl, ag) {
  return `${am.name}|${tl.name}|${ag.agent_id || ''}|${ag.name}`
}
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
watch(campaignFilter, () => {
  if (!isScopedRole.value) loadTimeseries()
  // Overview & Performa Campaign memakai data yang sudah ada di memori (di-slice di
  // sisi klien), tetapi dua tab ini dihitung di server jadi harus diambil ulang.
  if (tab.value === 'hierarchy') {
    loadHierarchy(true)
    loadQcPerformance()
  } else if (tab.value === 'failure') {
    loadFailureMode(true)
  }
})
// Performa Campaign kini tampil inline di bawah pie chart Overview (bukan tab
// tersendiri), jadi datanya di-load bersamaan dengan overview saat mount.
async function loadCampaignMonthly() {
  // Sisi sales tidak merender panelnya (lihat ``showCampaignPerformance``), jadi
  // permintaannya pun tidak perlu dikirim.
  if (!showCampaignPerformance.value) return
  if (campaignData.value) return
  loadingCampaign.value = true
  try {
    campaignData.value = await dataStore.fetchCampaignMonthly()
    // Default to the most recent month so the table opens on a manageable slice.
    const months = campaignData.value?.months || []
    defaultMonth.value = months[months.length - 1] || ''
    filterMonth.value = defaultMonth.value
  } finally {
    loadingCampaign.value = false
  }
}
// Campaign yang pohonnya sedang tersimpan (lihat catatan di failureCampaign).
const hierarchyCampaign = ref(null)
async function loadHierarchy(force = false) {
  if (!force && hierarchy.value && hierarchyCampaign.value === campaignFilter.value) return
  loadingHierarchy.value = true
  try {
    hierarchy.value = await dataStore.fetchHierarchy(campaignFilter.value)
    hierarchyCampaign.value = campaignFilter.value
  } finally {
    loadingHierarchy.value = false
  }
}
async function openHierarchy() {
  tab.value = 'hierarchy'
  // The QC table is refetched every visit: unlike the snapshot-backed tree it is
  // computed live, and an approval made minutes ago should show up.
  loadQcPerformance()
  loadHierarchy()
}

// Active campaign names for the Overview filter dropdown (source of truth =
// /list_campaigns, filtered to is_active), lalu dipersempit ke cakupan campaign
// login ini — lihat campaignsInScope().
async function loadCampaigns() {
  try {
    const list = await dataStore.fetchCampaigns()
    campaignOptions.value = campaignsInScope(
      (list || []).filter((c) => c.is_active).map((c) => c.name)
    )
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
// Daftar tiket ini kini bisa dicari & diurutkan, dan keduanya bekerja pada data yang
// SUDAH dimuat — dengan 20 baris, mencari tiket yang ada di posisi ke-25 akan menjawab
// "tidak ditemukan" padahal tiketnya ada. Diambil sebanyak yang diizinkan endpoint
// (``/list_results`` membatasi limit maksimum 100); sisanya dijelaskan di catatan bawah
// tabel supaya batasnya terlihat, bukan disembunyikan.
const MY_TICKETS_LIMIT = 100
async function loadTickets() {
  loadingTickets.value = true
  try {
    const d = await dataStore.fetchResults({ page: 1, limit: MY_TICKETS_LIMIT })
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
/* Baris 5 metrik (Total Submission/Qualified/Not Qualified/Pending/Error Rate):
   kartu lebih ramping supaya kelimanya muat sebaris di layar lebar. */
.kpis-5 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.kpi {
  background: var(--m-bg-surface); border: 1px solid var(--m-border-1); border-radius: var(--m-r-md);
  padding: 18px 20px; border-top: 3px solid var(--accent, var(--m-gray-300)); box-shadow: var(--m-shadow-card);
}
.kpi-label { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--m-gray-700); }
.kpi-value { font-size: 32px; font-weight: 800; color: var(--m-gray-900); margin-top: 6px; }
.kpi-pct { font-size: 15px; font-weight: 700; color: var(--m-fg-2); }
.kpi-sub { font-size: 12.5px; font-weight: 600; color: var(--m-fg-2); margin-top: 4px; }
/* KPI "Kategori Terbesar": tiga baris menggantikan satu angka besar.
   Tingginya dipatok agar SAMA dengan kartu ber-.kpi-value sebarisnya — kartu KPI
   diregangkan grid mengikuti isi tertinggi, jadi kartu ini harus muat di ruang
   yang sama: .kpi-value (32px + margin 6) ~= 46px, dan tiga baris 12.5px/1.25
   dengan jarak 1px ~= 49px. Nama kategori dipotong elipsis, penuhnya di tooltip. */
.kpi-top3 {
  margin: 4px 0 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 1px;
}
.kpi-top3 li {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 12.5px; line-height: 1.25; min-width: 0;
}
.kpi-top3 .rank {
  flex: none; width: 14px; text-align: center;
  font-size: 10px; font-weight: 800; color: var(--m-fg-2);
  background: var(--m-gray-100, rgba(0, 0, 0, .05)); border-radius: 3px;
}
.kpi-top3 .name {
  flex: 1 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 700; color: var(--m-gray-900);
}
.kpi-top3 .count { flex: none; font-weight: 800; color: var(--m-danger); }
.kpi-top3 .none { color: var(--m-fg-2); font-weight: 700; }
/* Failure Reason: daftar alasan teratas per kategori */
.reason-list { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; }
.reason-list li { font-size: 12.5px; line-height: 1.35; }
.reason-req { font-weight: 700; color: var(--m-gray-900); }
.reason-count { font-weight: 700; color: var(--m-danger); margin-left: 4px; }
.reason-example { color: var(--m-fg-2); margin-left: 4px; }
.reason-empty { color: var(--m-gray-900); }

/* Failure Reason: sub-tab Agregat / Hierarki Based. Sengaja lebih kecil dari .tab
   di atasnya supaya jelas ini tingkat kedua, bukan tab sejajar Overview. */
.subtab-group { display: inline-flex; gap: 4px; padding: 3px; border-radius: var(--m-r-pill); background: var(--m-gray-150); }
.subtab {
  padding: 5px 14px; border: none; background: none; border-radius: var(--m-r-pill);
  font-size: 12.5px; font-weight: 600; color: var(--m-fg-2); cursor: pointer; transition: all .15s;
  font-family: var(--m-font-sans);
}
.subtab.active { background: #fff; color: var(--m-gray-900); box-shadow: var(--m-shadow-sm); }

/* Kegagalan terbesar per simpul hierarki: bullet list
   "Kategori - xx Tiket - yy %". Angkanya menempel pada nama kategori (bukan kolom
   terpisah) supaya tetap terbaca sebagai satu kalimat saat namanya membungkus. */
/* Baris ringkasan "All Telesales" di puncak pohon Failure Reason: bukan simpul yang
   bisa dibuka, jadi ditegaskan lewat garis bawah tebal alih-alih panah. */
.mtable.tree tr.lvl-all td { background: var(--m-gray-100); font-weight: 800; border-bottom: 2px solid var(--m-border-2, var(--m-gray-300)); }
.lvl-tag.all { background: var(--m-gray-700); color: #fff; }
/* Ringkasan fase gagal di sebelah ticket id: sengaja lebih redup dari id-nya supaya
   tetap terbaca sebagai keterangan, bukan bagian dari nama. */
.tk-fails { margin-left: 8px; font-size: 11.5px; font-weight: 600; color: var(--m-fg-3); }


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
.cf-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }

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
.cf-note { font-size: 12px; color: var(--m-fg-2); }

/* Pie */
.donut-row { display: flex; align-items: center; gap: 28px; }
.donut-wrap { position: relative; width: 168px; height: 168px; flex-shrink: 0; }
.legend { display: flex; flex-direction: column; gap: 12px; flex: 1; }
.legend-title { font-size: 14px; font-weight: 800; color: var(--m-gray-900); letter-spacing: -.01em; margin-top: 50px; }
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
/* Baris TLO pada pohon Failure Reason ikut bisa diklik (membuka rincian kategori). */
.mtable.tree tr.lvl-ag:has(.twist) { cursor: pointer; }
.mtable.tree tr.lvl-ag:has(.twist):hover td { background: var(--m-gray-50); }
/* Daun ticket id (Hierarki Failure Rate): tidak bisa dibuka lagi, jadi latarnya
   dibedakan tipis supaya terbaca sebagai rincian milik baris TLO di atasnya. */
.mtable.tree tr.lvl-tk td { background: var(--m-gray-50); color: var(--m-gray-700); }
.twist { display: inline-block; width: 16px; color: var(--m-fg-3); }
/* Penjaga perataan untuk baris yang TIDAK bisa dibuka: selebar .twist, tanpa
   panah — sekaligus membuat :has(.twist) di atas tidak ikut memberi kursor pointer. */
.twist-pad { display: inline-block; width: 16px; }
.pad-1 { padding-left: 30px !important; }
.pad-2 { padding-left: 52px !important; }
.pad-3 { padding-left: 74px !important; }
.lvl-tag { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-right: 6px; vertical-align: middle; }
.lvl-tag.am { background: var(--mega-orange-soft); color: var(--mega-orange-deep); }
.lvl-tag.tl { background: var(--m-info-soft); color: var(--m-info); }
.lvl-tag.tlo { background: var(--m-gray-150); color: var(--m-gray-700); }
.lvl-tag.tkt { background: var(--m-info-soft); color: var(--m-info); }
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
/* Nilai nol dibedakan lewat bobot huruf saja — warnanya ikut hitam seperti
   teks lain (permintaan 28 Agustus 2026: tidak ada tulisan abu-abu). */
.mtable.tree :deep(.zero) { color: var(--m-gray-900); font-weight: 400; }
.mtable.tree :deep(.total-risk) { font-weight: 700; }
.mtable.tree :deep(.total-risk.zero) { font-weight: 400; }

/* Skeleton */
.skeleton-wrap { display: flex; flex-direction: column; gap: 12px; }
.skeleton { background: linear-gradient(90deg, var(--m-gray-100) 25%, var(--m-gray-150) 50%, var(--m-gray-100) 75%); background-size: 200%; height: 84px; border-radius: var(--m-r-md); animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.ms-block { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border, #e5e7eb); }
.ms-title { font-size: 12px; font-weight: 700; color: var(--text-muted, #6b7280); margin-bottom: 8px; }
.chart-head { display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin: 18px 0 6px; }
.chart-sub-title { font-size: 12.5px; font-weight: 700; color: var(--text-muted); }
.chart-sub-first { margin-top: 8px; }
.panel-hint { font-size: 11.5px; color: var(--m-fg-2); line-height: 1.45; margin: -2px 0 8px; }

/* --- toolbar & pagination tabel --- */
.mtable th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.mtable th.sortable:hover { color: var(--m-fg-1); }
.sort-ind { font-size: 9px; opacity: 0.55; margin-left: 2px; }

/* Style toolbar (.tbl-*) dan pager (.pg-*) ikut pindah ke
   components/TableToolbar.vue & components/TablePager.vue. */
</style>
