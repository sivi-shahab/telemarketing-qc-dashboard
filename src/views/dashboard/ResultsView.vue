<template>
  <SidebarLayout :title="isPendingCheck ? 'Pending Check' : (isBandingReview ? 'Manual Check' : 'Results')">
    <!-- Filters -->
    <div class="filter-bar">
      <select v-model="filterAiStatus" class="select-input" @change="applyFilter">
        <option value="">Semua AI Status</option>
        <option value="PASS">Qualified</option>
        <option value="FAIL">Not Qualified</option>
        <option value="PENDING">Pending</option>
      </select>
      <!-- Manual Status berdiri sendiri dari AI Status, jadi filternya juga terpisah.
           Dipakai bersamaan = irisan keduanya (mis. AI Qualified tapi human menilai
           Not Qualified = daftar tiket yang dikoreksi human). -->
      <select v-if="showManualStatus" v-model="filterManualStatus" class="select-input" @change="applyFilter">
        <option value="">Semua Manual Status</option>
        <option value="PASS">Qualified</option>
        <option value="FAIL">Not Qualified</option>
        <option value="PENDING">Pending</option>
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

    <!-- Export agregat per kategori verifikasi (SPQ Head & Admin). Berbeda dengan
         tombol XLSX per baris: ini menarik SEMUA tiket Not Qualified & Pending yang
         punya temuan pada kategori terpilih, satu baris per parameter. Filter
         Campaign di atas ikut berlaku supaya hasilnya sama dengan yang terlihat. -->
    <div v-if="canExportVerification" class="export-bar">
      <span class="export-label">Export Agregat</span>
      <select v-model="exportCategory" class="select-input">
        <option v-for="c in EXPORT_CATEGORIES" :key="c.key" :value="c.key">{{ c.label }}</option>
      </select>
      <button class="btn-export-agg" :disabled="exportingCategory" @click="exportVerification">
        {{ exportingCategory ? 'Menyiapkan…' : 'Export XLSX' }}
      </button>
      <span class="export-note">
        Not Qualified &amp; Pending<template v-if="filterCampaign"> · campaign {{ filterCampaign }}</template>
      </span>
    </div>

    <!-- [FIX] `fetchError` sebelumnya di-set tapi tidak pernah ditampilkan: kalau
         /list_results gagal, tabel hanya tampak kosong tanpa keterangan. -->
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
          <col v-if="showManualStatus" style="width: 10%" />
          <col v-if="!isSimpleViewer" style="width: 7%" />
          <col style="width: 9%" />
          <col v-if="canAppealErrorCode" style="width: 12%" />
          <col v-if="canReviewBandingSpq" style="width: 12%" />
          <col v-if="canDeleteTicket" style="width: 8%" />
          <col v-if="canReviewBandingTl" style="width: 12%" />
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
            <th v-if="showManualStatus">Manual Status</th>
            <th v-if="!isSimpleViewer">Export</th>
            <th>Document</th>
            <!-- Kolom ini SEMATA-MATA tentang banding Error Code (sumbernya
                 error_code_appeals), tidak ada hubungannya dengan Manual Status. -->
            <th v-if="canAppealErrorCode">Manual Check</th>
            <th v-if="canReviewBandingSpq">Manual Check</th>
            <th v-if="canDeleteTicket">Delete Record</th>
            <th v-if="canReviewBandingTl">Manual Check</th>
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
                <span v-if="group.primary.ai_status" :class="['status-badge', aiStatusBadgeClass(group.primary.ai_status)]">{{ aiStatusLabel(group.primary.ai_status) }}</span>
                <span v-else>—</span>
                <!-- PENDING tanpa keterangan tidak bisa ditindaklanjuti: sebutkan
                     dokumen apa yang ditunggu dan bahwa tenggatnya H+2. -->
                <div v-if="group.primary.pending_reason" class="ai-status-note">{{ group.primary.pending_reason }}</div>
                <!-- Not Qualified karena sebab yang TIDAK terbaca dari skor: saat ini
                     indikasi fraud (penyebutan verifikasi statik berubah-ubah). -->
                <div v-if="group.primary.fail_reason" class="ai-status-note note-fraud">{{ group.primary.fail_reason }}</div>
              </td>
              <!-- Manual Status (sisi QC + administrasi): verdict QC via hierarki +
                   default missing-docs. Divisi sales tidak melihat kolom ini. -->
              <td v-if="showManualStatus" class="cell-mstatus" @click.stop>
                <!-- Badge vonis + tombol aksi di baris atas, tautan Riwayat di bawahnya.
                     Tanpa vonis, selnya langsung mulai dengan tombol — tidak ada "—"
                     dan tidak ada keterangan alur kerja. -->
                <div
                  v-if="group.primary.manual_status || manualStatusAction(group.primary) || manualReviewAction(group.primary)"
                  class="mstatus-top"
                >
                  <span
                    v-if="group.primary.manual_status"
                    :class="['mstatus-badge', mStatusClass(group.primary.manual_status), { 'mstatus-inherited': !group.primary.manual_status_by_human }]"
                    :title="mStatusTitle(group.primary)"
                  >{{ mStatusLabel(group.primary.manual_status) }}</span>
                  <button v-if="manualStatusAction(group.primary)" class="btn-mstatus" @click="onManualStatusAction(group.primary)">{{ manualStatusAction(group.primary) }}</button>
                  <button v-if="manualReviewAction(group.primary)" class="btn-mstatus" @click="onManualReviewAction(group.primary)">{{ manualReviewAction(group.primary) }}</button>
                </div>
                <!-- Riwayat: tombol sungguhan (bukan tautan) agar terbaca sebagai aksi,
                     tapi bergaya sekunder supaya tidak menyaingi Set/Ubah di baris atas.
                     Tersedia untuk SEMUA role — vonis human bisa ditetapkan langsung
                     tanpa jejak review, jadi jejaknya perlu mudah dibuka. -->
                <button
                  v-if="group.primary.manual_status_history_count"
                  class="btn-mstatus btn-mstatus-ghost"
                  :title="`Lihat ${group.primary.manual_status_history_count} perubahan Manual Status`"
                  @click="openHistory(group.primary)"
                >
                  Riwayat ({{ group.primary.manual_status_history_count }})
                </button>
                <!-- Satu-satunya keterangan yang tersisa di kolom ini: kondisi SLA H+2
                     (dokumen wajib belum diunggah), yang memang perlu tindakan human dan
                     tidak terwakili oleh riwayat karena belum tentu ada kejadiannya. -->
                <span v-if="group.primary.missing_documents" class="mstatus-note">{{ missingDocNote(group.primary) }}</span>
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
              <!-- Satu kolom untuk kedua aksi: yang bisa upload DAN view mendapat dua
                   tombol bertumpuk (atas-bawah), bukan dua kolom. -->
              <td class="cell-doc" @click.stop>
                <div class="doc-actions">
                  <!-- Upload — hanya Team Leader Sales & Admin. -->
                  <template v-if="canUploadDocument">
                    <span v-if="group.primary.has_documents && !docMissing(group.primary).length" class="doc-uploaded">
                      ✓ Uploaded
                      <span v-if="group.primary.document_uploaded_at" class="doc-time">{{ formatDate(group.primary.document_uploaded_at) }}</span>
                    </span>
                    <button
                      v-else
                      class="btn-doc-row"
                      :disabled="!docMissing(group.primary).length"
                      @click="openDocModal(group.primary)"
                    >
                      <span>Upload</span>
                      <span>Document</span>
                    </button>
                  </template>
                  <!-- View — semua role, mati bila belum ada dokumen sama sekali. -->
                  <button
                    class="btn-doc-row btn-doc-view"
                    :disabled="!group.primary.has_documents"
                    :title="group.primary.has_documents ? 'Lihat dokumen yang sudah diunggah' : 'Belum ada dokumen yang diunggah'"
                    @click="openViewDocModal(group.primary)"
                  >
                    <span>View</span>
                    <span>Document</span>
                  </button>
                </div>
                <!-- Sebagian sudah diunggah, sisanya belum (mis. KTP sudah, KK belum). -->
                <span
                  v-if="canUploadDocument && group.primary.has_documents && docMissing(group.primary).length"
                  class="doc-uploaded doc-uploaded-partial"
                >
                  ✓ Sebagian diunggah
                </span>
                <!-- Kebutuhan dokumen ditulis lengkap dengan alasannya, satu baris per
                     dokumen: "Perlu Dokumen NPWP karena Perubahan NPWP". Hanya dokumen
                     yang BELUM diunggah yang disebut; tiket tanpa kebutuhan dokumen
                     meninggalkan sel ini kosong. -->
                <div v-if="canUploadDocument && docNeeds(group.primary).length" class="doc-reason">
                  <span
                    v-for="n in docNeeds(group.primary)"
                    :key="n.doc_type"
                    class="doc-reason-line"
                  >Perlu Dokumen {{ n.doc_label }} karena {{ n.reason }}</span>
                </div>
              </td>
              <!-- Kolom "Manual Check" untuk QC: ringkasan banding Error
                   Code miliknya (approved / rejected / menunggu). Murni Error Code —
                   vonis human ada di kolom Manual Status, terpisah. -->
              <td v-if="canAppealErrorCode" class="cell-banding">
                <template v-if="group.primary.appeal_summary">
                  <span v-if="group.primary.appeal_summary.approved" class="banding-badge badge-green">✓ {{ group.primary.appeal_summary.approved }}</span>
                  <span v-if="group.primary.appeal_summary.rejected" class="banding-badge badge-red">✗ {{ group.primary.appeal_summary.rejected }}</span>
                  <span v-if="group.primary.appeal_summary.pending" class="banding-badge badge-wait">{{ group.primary.appeal_summary.pending }}</span>
                </template>
                <span v-else>—</span>
                <button
                  v-if="appealHistoryCount(group.primary)"
                  class="btn-mstatus btn-mstatus-ghost"
                  :title="`Lihat ${appealHistoryCount(group.primary)} kejadian banding Error Code`"
                  @click.stop="openAppealHistory(group.primary)"
                >Riwayat ({{ appealHistoryCount(group.primary) }})</button>
              </td>
              <!-- Banding Review (reuses the old hidden QC Approval column slot for SPQ Head):
                   highlight IDs awaiting review. -->
              <td v-if="canReviewBandingSpq" class="cell-banding">
                <template v-if="group.primary.appeal_summary">
                  <span v-if="group.primary.appeal_summary.pending" class="banding-badge badge-wait">{{ group.primary.appeal_summary.pending }} menunggu</span>
                  <span v-else class="banding-badge badge-gray">Selesai</span>
                </template>
                <span v-else>—</span>
                <button
                  v-if="appealHistoryCount(group.primary)"
                  class="btn-mstatus btn-mstatus-ghost"
                  :title="`Lihat ${appealHistoryCount(group.primary)} kejadian banding Error Code`"
                  @click.stop="openAppealHistory(group.primary)"
                >Riwayat ({{ appealHistoryCount(group.primary) }})</button>
              </td>
              <td v-if="canDeleteTicket" class="cell-delete" @click.stop>
                <button class="btn-delete-row" @click="openDeleteModal(group.primary)">Delete</button>
              </td>
              <!-- Team Leader QC: flag IDs with a banding awaiting THEIR check. -->
              <td v-if="canReviewBandingTl" class="cell-banding">
                <template v-if="group.primary.appeal_summary">
                  <span v-if="group.primary.appeal_summary.tl_pending" class="banding-badge badge-wait">{{ group.primary.appeal_summary.tl_pending }} perlu dicek</span>
                  <span v-else-if="group.primary.appeal_summary.spq_pending" class="banding-badge badge-gray">diteruskan ke SPQ</span>
                  <span v-else class="banding-badge badge-gray">—</span>
                </template>
                <span v-else>—</span>
                <button
                  v-if="appealHistoryCount(group.primary)"
                  class="btn-mstatus btn-mstatus-ghost"
                  :title="`Lihat ${appealHistoryCount(group.primary)} kejadian banding Error Code`"
                  @click.stop="openAppealHistory(group.primary)"
                >Riwayat ({{ appealHistoryCount(group.primary) }})</button>
              </td>
              <!-- Pending Check: H+2 SLA timer from TMS submit_time (deadline = submit_time + 2 hari). -->
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
                      <div class="qan-title">Catatan QC (Disetujui SPQ Head)</div>
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

    <ErrorCodeHistoryModal
      v-if="appealHistoryItem"
      :history="appealHistoryItem.appeal_summary?.history || []"
      :display-id="appealHistoryItem.id"
      @close="closeAppealHistory"
    />

    <ManualStatusHistoryModal
      v-if="historyItem"
      :result-id="historyItem.result_id"
      :display-id="historyItem.id"
      @close="closeHistory"
    />

    <ViewDocumentModal
      v-if="viewDocItem"
      :result-id="viewDocItem.result_id"
      :doc-id="viewDocItem.id"
      :evaluation="results[viewDocItem.result_id]?.result?.evaluation || null"
      @close="closeViewDocModal"
    />

    <ManualCheckModal
      v-if="manualCheckItem"
      :result-id="manualCheckItem.result_id"
      :display-id="manualCheckItem.id"
      :existing="manualCheckItem.qc_request"
      :ai-status="manualCheckItem.ai_status"
      :by-human="!!manualCheckItem.manual_status_by_human"
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
            <p>Anda akan menghapus <strong>SEMUA entry</strong> untuk ticket
              <strong>{{ deleteItem.id }}</strong>.</p>
            <p class="del-warn">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import SidebarLayout from '../../components/SidebarLayout.vue'
import EvaluationView from '../../components/EvaluationView.vue'
import UploadDocumentModal from '../../components/UploadDocumentModal.vue'
import ViewDocumentModal from '../../components/ViewDocumentModal.vue'
import ManualStatusHistoryModal from '../../components/ManualStatusHistoryModal.vue'
import ErrorCodeHistoryModal from '../../components/ErrorCodeHistoryModal.vue'
import ManualCheckModal from '../../components/ManualCheckModal.vue'
import QcApprovalModal from '../../components/QcApprovalModal.vue'
import DocumentsSection from '../../components/DocumentsSection.vue'
import AgentErrorTable from '../../components/AgentErrorTable.vue'
import apiClient from '../../api/client.js'
import { useAuthStore } from '../../stores/auth.js'
import { P } from '../../permissions.js'
import { aiStatusLabel, aiStatusBadgeClass } from '../../utils/aiStatus.js'
import { campaignsInScope } from '../../utils/campaignScope.js'

const GROUPING_MODE = import.meta.env.VITE_RESULTS_GROUPING === 'server' ? 'server' : 'client'
const GROUP_LIMIT = 20
const FETCH_LIMIT = 100
const MAX_FETCH_PAGES = 200

const rawItems = ref([])
const serverGroups = ref([])
const serverTotalGroups = ref(0)
const serverTotalResults = ref(0)

const route = useRoute()
const isBandingReview = route.meta?.bandingReview === true
// "Pending Check" queue (route meta.pendingCheck): tickets whose Manual Status is
// still pending the caller's review tier, plus an H+2 SLA timer from TMS submit_time.
const isPendingCheck = route.meta?.pendingCheck === true

const page = ref(1)
const loading = ref(true)
const fetchError = ref(null)

const filterAiStatus = ref('')
const filterManualStatus = ref('')
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
// "Simple viewer" (sales agent, team leader, area manager, telesales head):
// kolom Customer Name + Nomor Kartu, tanpa Passing Grade/Export. Sama dengan
// is_simple_viewer di api/routers/stats.py.
// Area Manager & Telesales Head memakai tampilan yang SAMA PERSIS dengan sales
// agent — termasuk detail ticket saat baris di-expand, dan sama-sama tanpa Upload
// Document / Export XLSX. Yang membedakan hanya cakupan data: mereka atasan dari
// banyak sales, jadi scope-nya lebih luas (lihat _scoped_customer_ids di
// api/routers/stats.py), bukan tampilannya.
// "Simple viewer" = role tanpa detail evaluasi (sisi sales). Diturunkan dari
// capability, bukan daftar nama role.
const isSimpleViewer = computed(() => !auth.can(P.RESULTS_EVALUATION_DETAIL))
// Detail penilaian (Executive Summary + verifikasi Ascend/TMS + dokumen) hanya
// untuk sisi QC. Sisi sales cukup Agent Error Summary — mereka tidak boleh
// membuka detail penilaian tiket agent di bawah mereka. Harus sama dengan
// get_evaluation_detail_user di api/dependencies.py, yang menegakkan ini di
// backend (GET /result/{id} balas 403).
// "demo" (read-only showcase) mirrors the SPQ view and may open evaluation detail.
const showEvaluationDetail = computed(() => auth.can(P.RESULTS_EVALUATION_DETAIL))
// Who may UPLOAD supporting documents: ONLY Team Leader Sales supplies them (+ admin
// superuser). QC, TL QC, SPQ Head, QC Support are view-only. Must match
// get_document_uploader_user in api/dependencies.py. (Viewing reuses showEvaluationDetail,
// the same role set as get_document_viewer_user, so document cards only render for those.)
const canUploadDocument = computed(() => auth.can(P.DOCUMENT_UPLOAD))
// MELIHAT dokumen terbuka untuk SEMUA role — yang membatasi bukan role melainkan
// tiketnya: backend memeriksa setiap permintaan dengan ensure_can_view_result
// (api/qc_scope.py), yang meniru cakupan daftar Results. Jadi seorang Team Leader
// hanya bisa membuka dokumen tiket timnya sendiri.
// Aksi Manual Status & banding kini murni capability. Ini juga yang membuat
// pembatasan role "admin" (menu sama dengan SPQ Head, tanpa aksi QC) berlaku di
// SATU tempat, bukan tersebar sebagai perbandingan nama role.
// Kolom Manual Status hanya untuk sisi QC + administrasi. Divisi sales (TLO,
// Team Leader Sales, Area Manager, Telesales Head) cukup AI Status — vonis human
// adalah urusan QC. Filternya ikut disembunyikan karena tanpa kolomnya, memfilter
// dengan nilai yang tidak terlihat hanya membingungkan.
const showManualStatus = computed(() => auth.can(P.MANUAL_STATUS_COLUMN))
const canSetManualStatus = computed(() => auth.can(P.MANUAL_STATUS_SET))
const canReviewManualTl = computed(() => auth.can(P.MANUAL_STATUS_REVIEW_TL))
const canReviewManualSpq = computed(() => auth.can(P.MANUAL_STATUS_REVIEW_SPQ))
const canAppealErrorCode = computed(() => auth.can(P.ERROR_CODE_APPEAL))
const canReviewBandingTl = computed(() => auth.can(P.ERROR_CODE_REVIEW_TL))
const canReviewBandingSpq = computed(() => auth.can(P.ERROR_CODE_REVIEW_SPQ))
const canDeleteTicket = computed(() => auth.can(P.ADMIN_TICKET_DELETE))
// Critical Failure(s) tampil untuk semua role KECUALI sisi sales (TLO/sales agent,
// Team Leader, Area Manager, Telesales Head) — QC, TL QC, QC Support, SPQ Head,
// dan admin tetap melihatnya.
const showCriticalFailure = computed(() => auth.can(P.RESULTS_CRITICAL_FAILURE))

const showNonTolerable = false

// Column count for empty/expand row colspan, mirroring the per-role <th> visibility:
//   5 base columns: ID, Number of Calls, Call Duration, Campaign Interest, AI Status
//   + Customer Name, Nomor Kartu, Limit Sebelumnya (simple viewer only)
//   + Passing Grade, Export (non-simple-viewer)
//   + Document (SEMUA role — View Document terbuka untuk semua; Upload menumpuk di
//     sel yang sama untuk TL Sales / Admin)
//   + Manual Check (QC / TL QC / SPQ Head) — ringkasan banding Error Code
const colCount = computed(() => {
  let n = 5 // ID, Number of Calls, Call Duration, Campaign Interest, AI Status
  if (showManualStatus.value) n += 1 // Manual Status — hanya sisi QC & administrasi
  if (isSimpleViewer.value) n += 3 // Customer Name, Nomor Kartu, Limit Sebelumnya
  if (showCriticalFailure.value) n += 1 // Critical Failure(s)
  if (showNonTolerable) n += 1 // Non-Tolerable
  if (!isSimpleViewer.value) n += 2 // Passing Grade, Export
  n += 1 // kolom Document (Upload dan/atau View) — selalu ada
  if (canAppealErrorCode.value) n += 1 // Manual Check — pengaju banding
  if (canReviewBandingSpq.value) n += 1 // Banding Review tahap SPQ Head
  if (canDeleteTicket.value) n += 1 // Delete Record
  if (canReviewBandingTl.value) n += 1 // Banding Review tahap Team Leader QC
  if (isPendingCheck) n += 1 // Sisa Waktu (H+2) timer
  return n
})

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
// Tiket yang sedang dibuka di modal "View Document".
const viewDocItem = ref(null)
// Tiket yang sedang dibuka di modal riwayat Manual Status.
const historyItem = ref(null)
// Tiket yang sedang dibuka di modal riwayat banding Error Code.
const appealHistoryItem = ref(null)

const manualCheckItem = ref(null)
const approvalItem = ref(null)

let debounceTimer = null

function formatDate(iso) {
  if (!iso) return '—'
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

// --- Grouping per ticket id ------------------------------------------------
// [FIX] `groupFlat`, `groups`, `pagedGroups`, `totalGroups`, `totalResults` dan
// `totalPages` hilang saat merge padahal dipakai template -> layar kosong /
// ReferenceError. Satu `id` bisa punya beberapa result (tiket di-reprocess);
// `primary` = result TERBARU, yaitu yang ditampilkan di baris induk.
function groupFlat(list) {
  const map = new Map()
  for (const it of list) {
    const key = it.id ?? it.result_id
    let g = map.get(key)
    if (!g) {
      g = { id: key, results: [] }
      map.set(key, g)
    }
    g.results.push(it)
  }
  const arr = Array.from(map.values())
  for (const g of arr) {
    g.results.sort((a, b) => resultTs(b) - resultTs(a))
    g.primary = g.results[0]
  }
  arr.sort((a, b) => resultTs(b.primary) - resultTs(a.primary))
  return arr
}

function resultTs(item) {
  if (!item) return 0
  const raw = item.generated_at
  if (!raw) return 0
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + 'Z'
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? t : 0
}

const groups = computed(() =>
  (GROUPING_MODE === 'server' ? serverGroups.value : groupFlat(rawItems.value))
)

// Server mode sudah memaginasi per grup, jadi halamannya diiris backend.
const pagedGroups = computed(() => {
  if (GROUPING_MODE === 'server') return groups.value
  const start = (page.value - 1) * GROUP_LIMIT
  return groups.value.slice(start, start + GROUP_LIMIT)
})

const totalGroups = computed(() =>
  (GROUPING_MODE === 'server' ? serverTotalGroups.value : groups.value.length)
)
const totalResults = computed(() =>
  (GROUPING_MODE === 'server' ? serverTotalResults.value : rawItems.value.length)
)
const totalPages = computed(() => Math.max(1, Math.ceil(totalGroups.value / GROUP_LIMIT)))

// Cari satu result di state (mode client maupun server) — dipakai setelah upload
// dokumen supaya barisnya bisa ditandai tanpa fetch ulang.
function findResult(resultId) {
  if (GROUPING_MODE === 'server') {
    for (const g of serverGroups.value) {
      const hit = g.results.find((r) => r.result_id === resultId)
      if (hit) return hit
    }
    return null
  }
  return rawItems.value.find((it) => it.result_id === resultId) || null
}

// --- Pending Check SLA timer (H+2 after TMS submit_time) ---
// A ticking clock so the countdown updates live; only wired up in Pending Check mode.
const SLA_HOURS = 48 // "H+2" = 2 hari setelah submit_time (cashline TMS)
const nowTs = ref(Date.now())
let slaTimer = null
// Parse a TMS submit_time ("2026-06-17 15:24:53", naive WIB) into an epoch ms.
function parseSubmitWib(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return NaN
  const [, Y, Mo, D, H, Mi, S] = m
  return Date.parse(`${Y}-${Mo}-${D}T${H}:${Mi}:${S || '00'}+07:00`)
}
function slaInfo(item) {
  // Basis = TMS submit_time (disbursement submission, WIB). Fall back to the
  // transcript's generated_at only when a ticket has no submit_time.
  let base = NaN
  if (item.submit_time) {
    base = parseSubmitWib(item.submit_time)
  } else if (item.generated_at) {
    // Same UTC->WIB convention as formatDate: append 'Z' when the string is naive.
    const iso = item.generated_at
    const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
    base = new Date(s).getTime()
  }
  if (!Number.isFinite(base)) return null
  const deadline = base + SLA_HOURS * 3600 * 1000
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

// Requirement text per bullet. The backend now sends a per-item `reason` that names
// the ACTUAL cause — important for the static verification items, where "Agent tidak
// memverifikasi tanggal lahir" is simply false when the agent DID ask and the answer
// merely failed to match Ascend (compliance/error_codes.py:
// annotate_critical_compliance_reasons). The local negation below is only a fallback
// for results fetched before that field existed.
function cccRequirement(it) {
  if (it.reason) return it.reason
  const req = it.requirement || it.item_code || '—'
  if (it.status === 'PASS' || req === '—') return req
  const m = req.match(/^(\s*Agent\s+)(.*)$/i)
  return m ? `${m[1]}tidak ${m[2]}` : `Tidak: ${req}`
}

// [FIX] Definisi lokal `aiStatusBadgeClass` DIHAPUS — namanya bentrok dengan yang
// di-import dari utils/aiStatus.js (penyebab "Identifier has already been
// declared"). Versi lokal juga mencocokkan 'FAILED', padahal filter di halaman ini
// memakai 'FAIL'; utils yang jadi sumber kebenaran untuk label + warna badge.

function buildParams() {
  const p = {}
  if (filterAiStatus.value) p.ai_status = filterAiStatus.value
  // [FIX] filter Manual Status hilang dari buildParams saat merge — dropdown-nya
  // ada di layar tapi tidak pernah dikirim ke backend.
  if (filterManualStatus.value) p.manual_status = filterManualStatus.value
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

// [FIX] Ada DUA `fetchItems` setelah merge; versi kedua memakai `items`/`total`
// yang sudah tidak ada di komponen ini (peninggalan sebelum grouping). Yang
// dipertahankan versi grouping di bawah ini.
// `silent` polling refreshes must not flip `loading` — the skeleton would flash
// and collapse the expanded row every few seconds.
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
  // Auto-start/stop polling: run only while some row is still being processed.
  if (hasInProgress()) startPolling()
  else stopPolling()
}

// Active campaign names for the Campaign filter dropdown, dipersempit ke cakupan
// campaign login ini (campaignsInScope) — campaign di luar cakupan selalu memberi
// hasil kosong, jadi tidak ditawarkan.
// [FIX] Versi duplikat tanpa campaignsInScope dihapus.
async function fetchCampaigns() {
  try {
    const res = await apiClient.get('/list_campaigns')
    campaignOptions.value = campaignsInScope(
      (res.data.campaigns || []).filter((c) => c.is_active).map((c) => c.name)
    )
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

// --- Auto-refresh (polling) ------------------------------------------------
// The backend has no push channel, so we poll /list_results while any row is
// pending/processing and stop once everything is done/failed.
const POLL_INTERVAL_MS = 7000
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
  filterManualStatus.value = ''
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

// --- Export agregat per kategori verifikasi (SPQ Head & Admin) -------------
const canExportVerification = computed(() => auth.can(P.RESULTS_EXPORT_VERIFICATION))
// Key-nya harus sama persis dengan VERIFICATION_EXPORT_CATEGORIES di
// compliance/stats_aggregate.py — backend menolak key yang tidak dikenal (422).
const EXPORT_CATEGORIES = [
  { key: 'verifikasi_statik', label: 'Verifikasi Statik' },
  { key: 'verifikasi_dinamik', label: 'Verifikasi Dinamik' },
  { key: 'cashline_verification', label: 'Cashline Verification' },
  { key: 'cardholder_verification', label: 'Cardholder Verification' },
]
const exportCategory = ref(EXPORT_CATEGORIES[0].key)
const exportingCategory = ref(false)

async function exportVerification() {
  if (exportingCategory.value) return
  exportingCategory.value = true
  try {
    const params = { category: exportCategory.value }
    if (filterCampaign.value) params.campaign = filterCampaign.value
    const res = await apiClient.get('/export_verification_xlsx', { params, responseType: 'blob' })
    downloadBlob(res, `${exportCategory.value}.xlsx`)
  } catch {
    alert('Gagal export XLSX agregat.')
  } finally {
    exportingCategory.value = false
  }
}

// Simpan respons blob sebagai unduhan, memakai nama file dari Content-Disposition
// bila ada (backend mengirim "<kategori>_<timestamp>.xlsx").
function downloadBlob(res, fallbackName) {
  const url = URL.createObjectURL(
    new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  )
  const disposition = res.headers['content-disposition'] || ''
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  const a = document.createElement('a')
  a.href = url
  a.download = match ? decodeURIComponent(match[1]) : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function exportRow(item) {
  if (exportingId.value) return
  exportingId.value = item.result_id
  try {
    const res = await apiClient.get(`/export_result_xlsx/${item.result_id}`, {
      responseType: 'blob',
    })
    // Nama file datang dari backend (ID_timestamp.xlsx); fallback bila tidak ada.
    downloadBlob(res, `${item.id || item.result_id}.xlsx`)
  } catch {
    alert('Gagal export XLSX.')
  } finally {
    exportingId.value = null
  }
}

// Jenis dokumen yang dipicu tapi BELUM diunggah. Satu tiket bisa memicu dua
// dokumen berbeda (mis. KTP karena alamat berubah + KK karena Nama Ibu Kandung
// mirip 80–89%), dan boleh diunggah di kunjungan terpisah.
function docMissing(item) {
  if (item.document_missing_types) return item.document_missing_types
  // Fallback untuk payload lama (tanpa field baru).
  return item.has_documents ? [] : item.document_upload_types || []
}

// Kebutuhan dokumen yang masih HARUS dipenuhi, satu entri per dokumen dengan
// alasannya digabung: { doc_type, doc_label, reason }. Satu dokumen bisa dipicu
// lebih dari satu hal (mis. KTP karena Perubahan NIK sekaligus Perubahan Alamat
// Rumah) — alasannya dirangkai dengan "dan" supaya tetap satu kalimat.
function docNeeds(item) {
  const missing = docMissing(item) || []
  if (!missing.length) return []
  const reqs = item.document_requirements || []
  const byType = new Map()
  for (const r of reqs) {
    if (!missing.includes(r.doc_type)) continue
    const hit = byType.get(r.doc_type)
    if (hit) hit.reasons.push(r.reason)
    else byType.set(r.doc_type, { doc_type: r.doc_type, doc_label: r.doc_label, reasons: [r.reason] })
  }
  return missing
    .filter((t) => byType.has(t))
    .map((t) => {
      const e = byType.get(t)
      return { doc_type: e.doc_type, doc_label: e.doc_label, reason: e.reasons.join(' dan ') }
    })
}

function openDocModal(item) {
  docModalResultId.value = item.result_id
  docModalId.value = item.id || null
  docModalTypes.value = docMissing(item)
}

function appealHistoryCount(item) {
  return (item.appeal_summary?.history || []).length
}
function openAppealHistory(item) {
  appealHistoryItem.value = item
}
function closeAppealHistory() {
  appealHistoryItem.value = null
}

function openHistory(item) {
  historyItem.value = item
}

function closeHistory() {
  historyItem.value = null
}

function openViewDocModal(item) {
  viewDocItem.value = item
}

function closeViewDocModal() {
  viewDocItem.value = null
}

function closeDocModal() {
  docModalResultId.value = null
  docModalId.value = null
  docModalTypes.value = []
}

function onDocUploaded(payload) {
  // Mark the row as uploaded (button -> "Uploaded") and surface the documents in
  // the expanded section if the row is open. Only the types just uploaded are
  // cleared — a still-missing type keeps the button active.
  // [FIX] dulu mencari di `items.value` yang sudah tidak ada; sekarang lewat
  // findResult() supaya jalan di mode client maupun server.
  const item = findResult(payload.resultId)
  if (!item) return
  item.has_documents = true
  const uploaded = (payload.documents || []).map((d) => d.doc_type)
  item.document_missing_types = (docMissing(item) || []).filter((t) => !uploaded.includes(t))
}

// --- Manual Status column (semua role) ---
// Manual Status = VONIS HUMAN, nilainya sejajar AI Status (Qualified / Not
// Qualified / Pending) dan berdiri sendiri — tidak pernah menimpa AI Status.
const MSTATUS_LABEL = { PASS: 'QUALIFIED', FAIL: 'NOT QUALIFIED', PENDING: 'PENDING' }
const MSTATUS_CLASS = { PASS: 'badge-green', FAIL: 'badge-red', PENDING: 'badge-wait' }
function mStatusLabel(s) { return MSTATUS_LABEL[s] || s }
// Catatan SLA H+2 di kolom Manual Status: sebutkan dokumennya ("Cek Dokumen NPWP"),
// bukan sekadar "Cek Dokumen" — QC perlu tahu apa yang harus dicek tanpa membuka baris.
function missingDocNote(item) {
  const labels = item.document_missing_labels || []
  return labels.length ? `Cek Dokumen ${labels.join(', ')}` : 'Cek Dokumen'
}
function mStatusClass(s) { return MSTATUS_CLASS[s] || 'badge-gray' }
// Keadaan ALUR KERJA-nya (menunggu review / usulan ditolak / perlu dicek) TIDAK
// ditampilkan di kolom ini — tautan "Riwayat" sudah mewakilkannya, dan payload
// masih membawa `manual_review_state` bila suatu saat dibutuhkan lagi.
// Tooltip badge vonis: siapa yang menetapkannya + alasannya. (Cabang lama untuk
// nilai 'approve'/'reject'/'ditolak' dihapus — manual_status kini PASS/FAIL/PENDING.)
function mStatusTitle(item) {
  if (!item.manual_status_by_human) return 'Mengikuti AI Status — belum diubah human'
  const req = item.qc_request
  if (!req) return ''
  const who = req.tl_qc_status === 'escalated' ? req.reviewed_by_username : req.tl_qc_username
  const parts = []
  if (who) parts.push(`Ditetapkan oleh ${who}`)
  if (req.reason) parts.push(`Alasan: ${req.reason}`)
  return parts.join(' · ')
}
// Aksi per role: QC set/ubah verdict (ManualCheckModal); TL QC / SPQ Head review
// sesuai tahap hierarki (QcApprovalModal, stage 'tl'/'spq').
// Aksi utama per role. QC mengusulkan; TL QC & SPQ Head boleh MENETAPKAN sendiri
// (tanpa approval) — jadi keduanya selalu punya tombol Set/Ubah, dan tombol Review
// tambahan hanya muncul saat ada usulan QC yang menunggu giliran mereka.
function manualStatusAction(item) {
  if (item.status !== 'done') return null
  if (canSetManualStatus.value) {
    // "Ubah" hanya bila vonisnya memang sudah ditetapkan human; kalau masih
    // mengikuti AI Status, ini penetapan pertama -> "Set".
    return item.manual_status_by_human ? 'Ubah' : 'Set'
  }
  return null
}
function manualReviewAction(item) {
  if (item.status !== 'done') return null
  const req = item.qc_request
  if (!req) return null
  if (canReviewManualTl.value && (req.tl_qc_status || 'pending') === 'pending') return 'Review'
  if (canReviewManualSpq.value && req.tl_qc_status === 'escalated' && req.approval_status === 'pending') return 'Review'
  return null
}

function onManualStatusAction(item) {
  manualCheckItem.value = item
}
function onManualReviewAction(item) {
  if (canReviewManualTl.value) { approvalItem.value = { ...item, _stage: 'tl' }; return }
  if (canReviewManualSpq.value) { approvalItem.value = { ...item, _stage: 'spq' }; return }
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
  clearTimeout(debounceTimer)
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

/* Pesan gagal muat data (fetchError). */
.error-box {
  padding: 10px 14px; margin-bottom: 12px; background: var(--red-bg); color: var(--red);
  border: 1px solid var(--red); border-radius: 8px; font-size: 13px;
}

/* Export agregat per kategori verifikasi (baris sendiri di bawah filter). */
.export-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.export-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.btn-export-agg {
  padding: 8px 16px; background: var(--green-bg); border: 1.5px solid #16a34a;
  border-radius: 8px; font-size: 13px; font-weight: 700; color: #16a34a; transition: all 0.15s;
}
.btn-export-agg:hover:not(:disabled) { background: #16a34a; color: #fff; }
.btn-export-agg:disabled { opacity: 0.5; cursor: not-allowed; }
.export-note { font-size: 12px; color: var(--text-muted); }

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
/* Sebagian dokumen sudah masuk tapi masih ada yang kurang — amber, bukan hijau. */
.doc-uploaded-partial { margin-top: 4px; font-size: 11px; color: #b45309; }
.doc-time { display: block; font-size: 11px; color: var(--text-muted); white-space: nowrap; margin-top: 2px; }
/* Kebutuhan dokumen + alasannya — tampil langsung, tanpa hover. Satu baris per
   dokumen ("Perlu Dokumen NPWP karena Perubahan NPWP"). */
.doc-reason { margin-top: 5px; display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
.doc-reason-line {
  font-size: 10.5px; font-weight: 600; color: var(--blue);
  background: var(--blue-bg); border: 1px solid var(--blue);
  border-radius: 6px; padding: 1px 6px; line-height: 1.35; white-space: normal;
}
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
.status-badge.badge-wait { background: #fef3c7; color: #b45309; }

/* Manual Status column (semua role): badge verdict + tombol aksi per role. */
.cell-mstatus { white-space: nowrap; }
/* Baris atas: badge vonis + tombol, berdampingan dan rata kiri. */
.mstatus-top { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.mstatus-badge {
  display: inline-block; font-size: 10px; font-weight: 800; padding: 3px 8px;
  border-radius: 999px; white-space: nowrap; letter-spacing: 0.02em;
}
.mstatus-badge.badge-wait { background: #fef3c7; color: #b45309; }
.btn-mstatus {
  margin-left: 6px; padding: 3px 9px; font-size: 11px; font-weight: 700; cursor: pointer;
  color: var(--blue); background: var(--blue-bg); border: 1px solid transparent; border-radius: 6px;
}
.btn-mstatus:hover { border-color: var(--blue); }

/* Sisa gaya kolom audit "sudah dicek manual" yang sudah di-deprecate (digantikan
   kolom Manual Status). Dipertahankan karena masih dipakai badge di sel banding. */
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
/* Kolom Document: dua aksi bertumpuk (atas-bawah) supaya tetap satu kolom. */
.doc-actions { display: flex; flex-direction: column; gap: 4px; align-items: stretch; }
.btn-doc-view { background: transparent; }
/* Tombol sekunder: bentuknya tetap tombol, tapi lebih redup daripada Set/Ubah. */
.btn-mstatus-ghost {
  display: block; margin-top: 4px; font-size: 10.5px; padding: 2px 8px;
  color: var(--text-muted); border-color: var(--border);
}
.btn-mstatus-ghost:hover { color: var(--blue); border-color: var(--blue); }
.mstatus-note { display: block; margin-top: 3px; font-size: 10.5px; font-weight: 600; color: #b45309; white-space: normal; }
/* Keterangan kenapa AI Status = PENDING (dokumen apa yang ditunggu + SLA H+2). */
.ai-status-note { margin-top: 3px; font-size: 10.5px; font-weight: 600; color: #b45309; line-height: 1.3; white-space: normal; }
/* Indikasi fraud dibedakan dari catatan Pending: merah, bukan amber. */
.ai-status-note.note-fraud { color: var(--red); font-weight: 700; }
/* Masih mengikuti AI Status (belum disentuh human) — dibuat lebih redup. */
.mstatus-inherited { opacity: 0.55; font-weight: 600; }
</style>