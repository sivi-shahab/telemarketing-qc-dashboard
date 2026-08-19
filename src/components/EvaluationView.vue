<template>
  <div class="eval">
    <!-- Ringkasan penilaian AI (perhitungan skor, dibuat mudah dipahami) — hidden for role user -->
    <div v-if="!isSimpleViewer" class="block">
      <div class="block-title">Ringkasan Penilaian AI</div>
      <table class="calc-tbl">
        <thead>
          <tr>
            <th>Keterangan</th>
            <th class="num">Perubahan</th>
            <th class="num">Hasil</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1) Pengurangan penilaian scorecard (tabel langsung mulai di sini;
                  rincian Skor Maksimal per produk sengaja tidak ditampilkan) -->
          <tr class="row-section row-head">
            <td class="ct-label">
              <span class="ct-name">Pengurangan – Penilaian scorecard</span>
              <span class="info" tabindex="0">ⓘ<span class="tip">Skor maksimal dikurangi bobot tiap item scorecard yang tidak dipenuhi agen.</span></span>
              <div v-if="!belumSesuai.length" class="ct-reason">Semua item scorecard terpenuhi.</div>
            </td>
            <td class="ct-change"></td>
            <td class="ct-result"></td>
          </tr>
          <tr v-for="(it, i) in belumSesuai" :key="'sc' + i" class="row-sub">
            <td class="ct-label">
              <span class="ct-sub-name"><strong>{{ scorecardErrorCode(it) }}</strong> - {{ deductionCategory(it) }} - <strong>{{ it.item_code || '—' }}</strong> - {{ negatedRequirement(it) }}</span>
            </td>
            <td class="ct-change deduct">{{ negWeight(it.weight) }}</td>
            <td class="ct-result"></td>
          </tr>
          <tr class="row-subtotal">
            <td class="ct-label"><span class="ct-name">Skor awal (penilaian scorecard)</span></td>
            <td class="ct-change" :class="deltaClass(scorecardDelta)">{{ deltaText(scorecardDelta) }}</td>
            <td class="ct-result">{{ fmtScore(phase2) }}</td>
          </tr>

          <!-- 3) Pengurangan verifikasi data — hanya tampil bila ADA pengurangan
                  (kegagalan verifikasi card holder kini muncul di "Penilaian scorecard"
                  sebagai B17/B16; bagian ini menyisakan mismatch cashline B02/B03/B05). -->
          <template v-if="verificationDeductions.length">
          <tr class="row-section row-head">
            <td class="ct-label">
              <span class="ct-name">Pengurangan – Verifikasi data</span>
              <span class="info" tabindex="0">ⓘ<span class="tip">Nilai dikurangi karena data yang disebut agen tidak cocok dengan data nasabah (mis. data finansial pencairan).</span></span>
            </td>
            <td class="ct-change"></td>
            <td class="ct-result"></td>
          </tr>
          <tr v-for="(v, i) in verificationDeductions" :key="'vd' + i" class="row-sub">
            <td class="ct-label">
              <span class="ct-sub-name"><strong>{{ v.error_code }}</strong> - {{ titleizeField(v.field) }}<template v-if="v.reason"> - {{ v.reason }}</template></span>
            </td>
            <td class="ct-change deduct">{{ fmtScore(v.item_score) }}</td>
            <td class="ct-result"></td>
          </tr>
          <tr class="row-subtotal">
            <td class="ct-label"><span class="ct-name">Setelah verifikasi data</span></td>
            <td class="ct-change" :class="deltaClass(ev?.ai_score_verification)">{{ deltaText(ev?.ai_score_verification) }}</td>
            <td class="ct-result">{{ fmtScore(runAfterVerif) }}</td>
          </tr>
          </template>

          <!-- 4) Pengurangan pelanggaran kritis -->
          <tr class="row-section row-head">
            <td class="ct-label">
              <span class="ct-name">Pengurangan – Pelanggaran kritis</span>
              <span class="info" tabindex="0">ⓘ<span class="tip">Nilai dikurangi karena ada langkah wajib yang tidak dilakukan agen (mis. verifikasi identitas atau konfirmasi persetujuan).</span></span>
              <div v-if="criticalFails.length" class="ct-reason">
                <!-- Bukan selalu "tidak dilakukan": verifikasi statik bisa gagal justru
                     karena agent SUDAH bertanya tapi jawabannya tidak cocok Ascend. -->
                Pelanggaran kritis yang terjadi:
                <ul class="calc-reason-list">
                  <li v-for="(it, i) in criticalFails" :key="i">
                    <strong>{{ it.item_code || '—' }}</strong> — {{ cccReason(it) }}
                  </li>
                </ul>
              </div>
              <div v-else class="ct-reason">Tidak ada pengurangan; tidak ada pelanggaran kritis.</div>
            </td>
            <td class="ct-change" :class="deltaClass(ev?.ai_score_critical_compliance_check)">{{ deltaText(ev?.ai_score_critical_compliance_check) }}</td>
            <td class="ct-result"></td>
          </tr>

          <!-- 5) Skor Akhir -->
          <tr class="row-total">
            <td class="ct-label">
              <span class="ct-name">Skor Akhir</span>
              <span class="info" tabindex="0">ⓘ<span class="tip">Skor awal setelah dikurangi semua pengurangan. Angka inilah yang menentukan lulus atau tidak.</span></span>
            </td>
            <td class="ct-change"></td>
            <td class="ct-result">{{ fmtScore(phase3) }}</td>
          </tr>

          <tr>
            <td class="ct-label">
              <span class="ct-name">Batas Lulus (90% × {{ fmtScore(ev?.maximum_score) }})</span>
              <span class="info" tabindex="0">ⓘ<span class="tip">Skor minimal agar LULUS, yaitu 90% dari Skor Maksimal.</span></span>
            </td>
            <td class="ct-change"></td>
            <td class="ct-result">{{ fmtScore(ev?.passing_grade) }}</td>
          </tr>

          <tr>
            <td class="ct-label">
              <span class="ct-name">Hasil</span>
              <span class="info" tabindex="0">ⓘ<span class="tip">LULUS bila Skor Akhir ≥ Batas Lulus; jika kurang, TIDAK LULUS.</span></span>
              <div class="ct-reason">
                Skor Akhir {{ fmtScore(phase3) }} {{ lulus ? '≥' : '<' }} Batas Lulus {{ fmtScore(ev?.passing_grade) }}.
              </div>
            </td>
            <td class="ct-change"></td>
            <td class="ct-result">
              <span :class="['badge', lulus ? 'badge-green' : 'badge-red']">{{ lulus ? 'LULUS' : 'TIDAK LULUS' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Error Code (role user only): standalone table, item_code column hidden -->
    <div v-if="ev && isSimpleViewer && !hideErrorCode" class="block">
      <div class="block-title">Error Code</div>
      <table v-if="errorCodeRows.length" class="tbl">
        <thead>
          <tr>
            <th>Sumber</th>
            <th>Error Code</th>
            <th>Error Type</th>
            <th>Error Category</th>
            <th>Details Error</th>
            <th>Reason</th>
            <th>Evidence</th>
            <th>Ticket ID</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(group, gi) in errorCodeGroups" :key="gi">
            <tr class="group-row">
              <td colspan="8">{{ group.sumber }} ({{ group.rows.length }})</td>
            </tr>
            <tr v-for="(row, i) in group.rows" :key="gi + '-' + i">
              <td class="src-cell">{{ row.sumber || '—' }}</td>
              <td><span class="badge badge-red">{{ row.error_code || '—' }}</span></td>
              <td>{{ row.error_type || '—' }}</td>
              <td>{{ row.error_category || '—' }}</td>
              <td>{{ row.details_error || '—' }}</td>
              <td class="reason">{{ row.reason || '—' }}</td>
              <td class="exec-evidence">{{ row.evidence || '—' }}</td>
              <td class="ticket-cell">{{ row.ticket_id || '—' }}</td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-else class="empty-inline">Tidak ada error code.</div>
    </div>

    <!-- Executive Summary -->
    <div v-if="ev && !isSimpleViewer" class="block exec-summary">
      <div class="block-title">Executive Summary</div>

      <!-- Critical Compliance Check -->
      <div class="exec-sub">
        <div class="exec-sub-head">
          <span class="exec-sub-title">Critical Compliance Check</span>
          <span
            v-if="ev.critical_compliance_check?.status"
            :class="['badge', ev.critical_compliance_check.status === 'PASS' ? 'badge-green' : 'badge-red']"
          >
            {{ ev.critical_compliance_check.status }}
          </span>
        </div>
        <table v-if="ev.critical_compliance_check?.checked_items?.length" class="tbl">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Requirement</th>
              <th>Status</th>
              <th>Alasan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in ev.critical_compliance_check.checked_items" :key="i">
              <td class="strong">{{ it.item_code || '—' }}</td>
              <td>{{ it.requirement || '—' }}</td>
              <td>
                <span :class="['badge', it.status === 'PASS' ? 'badge-green' : 'badge-red']">
                  {{ it.status || '—' }}
                </span>
              </td>
              <!-- Alasan gagal: dihitung backend agar seragam di semua tampilan, dan
                   membedakan "agent tidak bertanya" dari "agent bertanya tapi data
                   mismatch dengan Ascend". -->
              <td class="muted reason">{{ it.status === 'PASS' ? '—' : cccReason(it) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-inline">Tidak ada item.</div>
      </div>

      <!-- Ringkasan Kategori — hasil per kategori DIGABUNG dengan item scorecard
           yang belum sesuai di kategori itu, sehingga terlihat langsung item_code
           mana yang menjatuhkan tiap kategori. -->
      <div class="exec-sub">
        <div class="exec-sub-head">
          <span class="exec-sub-title">Ringkasan Kategori</span>
          <span class="badge badge-gray">{{ belumSesuai.length }} item belum sesuai</span>
        </div>
        <table v-if="categoryBreakdown.length" class="tbl">
          <thead>
            <tr>
              <th>Kategori</th>
              <!-- Bobot & Skor disembunyikan untuk role QC (lihat showCategoryScore). -->
              <th v-if="showCategoryScore" class="num">Bobot</th>
              <th v-if="showCategoryScore" class="num">Skor</th>
              <th>Hasil</th>
              <th>Item Belum Sesuai</th>
              <!-- Kosakata sheet QC per item yang gagal: kategori scorecard
                   ("Greeting") menjawab DI MANA gagalnya, Error Type/Category
                   ("Error - Human" / "Probbing") menjawab kesalahan JENIS apa itu
                   menurut sheet. Ditambahkan, bukan menggantikan judul kategori —
                   beberapa kategori scorecard memetakan ke error category yang sama,
                   jadi menggantinya justru menghapus pembeda (14 Agustus 2026). -->
              <th>Error Type</th>
              <th>Error Category</th>
              <th>Requirement</th>
              <th>Alasan</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(c, i) in categoryBreakdown" :key="i">
              <tr v-for="(it, j) in (c.items.length ? c.items : [null])" :key="`${i}-${j}`">
                <td v-if="j === 0" :rowspan="c.rowspan" class="strong">{{ categoryLabel(c.category) || '—' }}</td>
                <td v-if="showCategoryScore && j === 0" :rowspan="c.rowspan" class="num">
                  {{ categoryWeightPct(c.total_weight) }}
                </td>
                <td v-if="showCategoryScore && j === 0" :rowspan="c.rowspan" class="num">
                  {{ c.earned_score ?? '—' }}
                </td>
                <td v-if="j === 0" :rowspan="c.rowspan">
                  <span :class="['badge', c.category_result === 'PASS' ? 'badge-green' : 'badge-red']">
                    {{ c.category_result || '—' }}
                  </span>
                </td>
                <td class="strong">{{ it?.item_code || '—' }}</td>
                <td>{{ it ? scorecardErrorType(it) : '—' }}</td>
                <td>{{ it ? scorecardErrorCategory(it) : '—' }}</td>
                <td>{{ it?.requirement || '—' }}</td>
                <td v-if="j === 0" :rowspan="c.rowspan" class="muted reason">{{ c.fail_reason || '—' }}</td>
              </tr>
            </template>
          </tbody>
        </table>
        <div v-else class="empty-inline">Tidak ada ringkasan kategori.</div>
      </div>

      <!-- Campaign Interest Verification -->
      <div class="exec-sub">
        <div class="exec-sub-head">
          <span class="exec-sub-title">Campaign Interest Verification</span>
          <span class="badge badge-gray">{{ ev.campaign_interest_verification?.length || 0 }}</span>
        </div>
        <table v-if="ev.campaign_interest_verification?.length" class="tbl">
          <thead>
            <tr>
              <th>Field</th>
              <th>TMS</th>
              <th>Transkrip</th>
              <th>Match</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, i) in ev.campaign_interest_verification" :key="i">
              <td class="strong">{{ v.field ? titleizeField(v.field) : '—' }}</td>
              <td>{{ v.reference_value ?? '—' }}</td>
              <td>{{ v.extracted_value ?? '—' }}</td>
              <td><span :class="['badge', matchBadgeClass(v.match)]">{{ v.match || '—' }}</span></td>
              <td class="reason">{{ v.reason || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-inline">Tidak ada data verifikasi campaign interest.</div>
      </div>

      <!-- Card Holder Verification -->
      <div class="exec-sub">
        <div class="exec-sub-head">
          <span class="exec-sub-title">Card Holder Verification</span>
          <span class="badge badge-gray">{{ ev.card_holder_verification?.length || 0 }}</span>
        </div>
        <table v-if="ev.card_holder_verification?.length" class="tbl">
          <thead>
            <tr>
              <th>Field</th>
              <th>Tipe Verifikasi</th>
              <th>Ascend</th>
              <th>Transkrip</th>
              <th>Match</th>
              <th>Reason</th>
              <th>Similarity</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, i) in ev.card_holder_verification" :key="i">
              <td class="strong">{{ v.field ? titleizeField(v.field) : '—' }}</td>
              <td>
                <span :class="['badge', verificationTypeBadgeClass(cardHolderVerificationType(v.field))]">
                  {{ cardHolderVerificationType(v.field) }}
                </span>
              </td>
              <td>{{ v.reference_value ?? '—' }}</td>
              <!-- Verifikasi STATIK boleh diulang sampai 3 kali. Kalau hanya nilai
                   terpilih yang ditampilkan, alasan "penyebutan tidak konsisten antar
                   pengulangan" mustahil diperiksa QC — jadi SEMUA penyebutan nasabah
                   ditampilkan, dengan yang dipakai untuk pencocokan ditandai. -->
              <td>
                <ol v-if="mentionsOf(v).length > 1" class="mention-list">
                  <li
                    v-for="(mn, mi) in mentionsOf(v)"
                    :key="mi"
                    :class="{ 'mention-used': mn.value === v.extracted_value }"
                  >
                    <span v-if="mn.ts" class="mention-ts">{{ mn.ts }}</span>{{ mn.value }}
                  </li>
                </ol>
                <template v-else>{{ v.extracted_value ?? '—' }}</template>
              </td>
              <td><span :class="['badge', matchBadgeClass(v.match)]">{{ v.match || '—' }}</span></td>
              <td class="reason">{{ v.reason || '—' }}</td>
              <td>{{ v.similarity_percent != null ? v.similarity_percent + '%' : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-inline">Tidak ada data verifikasi card holder.</div>
      </div>

      <!-- Cashline Data Verification -->
      <div class="exec-sub">
        <div class="exec-sub-head">
          <span class="exec-sub-title">Cashline Data Verification</span>
          <span class="badge badge-gray">{{ ev.cashline_data_verification?.length || 0 }}</span>
        </div>
        <table v-if="ev.cashline_data_verification?.length" class="tbl">
          <thead>
            <tr>
              <th>Field</th>
              <th>TMS</th>
              <th title="Syarat & ketentuan produk dari dokumen RIPLAY Bank Mega">TnC Product</th>
              <th>Transkrip</th>
              <th>Match</th>
              <th>Reason</th>
              <th>Similarity</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, i) in ev.cashline_data_verification" :key="i">
              <td class="strong">{{ v.field ? titleizeField(v.field) : '—' }}</td>
              <td>{{ v.reference_value ?? '—' }}</td>
              <td class="tnc">{{ v.tnc_product ?? '—' }}</td>
              <td>{{ v.extracted_value ?? '—' }}</td>
              <td><span :class="['badge', matchBadgeClass(v.match)]">{{ v.match || '—' }}</span></td>
              <td class="reason">{{ v.reason || '—' }}</td>
              <td>{{ v.similarity_percent != null ? v.similarity_percent + '%' : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-inline">Tidak ada data verifikasi cashline.</div>
      </div>

      <!-- Error Code (dikelompokkan per sumber) -->
      <div class="exec-sub">
        <div class="exec-sub-head">
          <span class="exec-sub-title">Error Code</span>
          <span class="badge badge-gray">{{ errorCodeRows.length }}</span>
          <button v-if="showManualCheckCol || showDirectEditCol" class="add-ec-btn" @click="showAddModal = true">+ Tambah Error Code</button>
        </div>
        <table v-if="errorCodeRows.length" class="tbl">
          <thead>
            <tr>
              <th>Sumber</th>
              <th>Error Code</th>
              <!-- Kosakata sheet QC ("Error Reason - Telemarketing QC"), dibawa apa
                   adanya oleh backend. Ditambahkan sebagai pembeda antar kode, bukan
                   pengganti Details Error (permintaan 14 Agustus 2026). -->
              <th>Error Type</th>
              <th>Error Category</th>
              <th>Risk Base</th>
              <th>Item Code</th>
              <th>Details Error</th>
              <th>Reason</th>
              <th>Evidence</th>
              <th>Ticket ID</th>
              <th v-if="showHistoryCol">Riwayat</th>
              <th v-if="showManualCheckCol">Manual Check</th>
              <th v-if="showDirectEditCol">Manual Check</th>
              <th v-if="showReviewCol">Review Banding</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, gi) in errorCodeGroups" :key="gi">
              <tr class="group-row">
                <td :colspan="errorColCount">{{ group.sumber }} ({{ group.rows.length }})</td>
              </tr>
              <template v-for="(row, i) in group.rows" :key="gi + '-' + i">
              <tr>
                <td class="src-cell">{{ row.sumber || '—' }}</td>
                <td><span class="badge badge-red">{{ row.error_code || '—' }}</span></td>
                <td>{{ row.error_type || '—' }}</td>
                <td>{{ row.error_category || '—' }}</td>
                <td>{{ row.risk_base || '—' }}</td>
                <td class="strong">{{ row.item_code || '—' }}</td>
                <td>{{ row.details_error || '—' }}</td>
                <td class="reason">{{ row.reason || '—' }}</td>
                <td class="exec-evidence">{{ row.evidence || '—' }}</td>
                <td class="ticket-cell">{{ row.ticket_id || '—' }}</td>
                <td v-if="showHistoryCol" class="hist-cell">
                  <button v-if="row.appeal && (row.appeal.history || []).length"
                          class="hist-toggle" @click="toggleHistory(gi + '-' + i)">
                    Riwayat {{ isHistoryOpen(gi + '-' + i) ? '▾' : '▸' }}
                  </button>
                  <span v-else>—</span>
                </td>

                <!-- QC: Manual Check (riwayat kini di kolom Riwayat, bukan tooltip) -->
                <td v-if="showManualCheckCol" class="mc-cell">
                  <template v-if="row.appealable && resultId">
                    <span v-if="rowStatus(row) === 'pending'" class="mc-waiting" :title="`Menunggu persetujuan ${pendingReviewer(row)}`">
                      Menunggu<br />{{ pendingReviewerShort(row) }}
                    </span>
                    <div v-else class="mc-stack">
                      <button class="mc-btn" @click="openManualCheck(row)">Manual Check</button>
                      <span v-if="rowStatus(row) === 'rejected'" class="mc-rejected">rejected</span>
                    </div>
                  </template>
                  <span v-else>—</span>
                </td>

                <!-- Team Leader QC / SPQ Head: direct edit (no hierarchy, applies at once) -->
                <td v-if="showDirectEditCol" class="mc-cell">
                  <template v-if="row.appealable && resultId && rowStatus(row) !== 'pending'">
                    <button class="mc-btn" @click="openManualCheck(row)">Manual Check</button>
                  </template>
                  <span v-else :title="rowStatus(row) === 'pending' ? 'Ada banding QC menunggu — gunakan Review Banding' : ''">—</span>
                </td>

                <!-- Team Leader QC (cek) / SPQ Head (final): Review Banding -->
                <td v-if="showReviewCol" class="mc-cell">
                  <template v-if="row.appeal && resultId">
                    <button class="mc-btn" @click="openReview(row)">{{ isTlQc ? 'Cek Banding' : 'Review Banding' }}</button>
                  </template>
                  <span v-else>—</span>
                </td>
              </tr>
              <tr v-if="showHistoryCol && isHistoryOpen(gi + '-' + i)" class="history-row">
                <td :colspan="errorColCount">
                  <ul class="timeline">
                    <li v-for="(e, ei) in rowTimeline(row)" :key="ei" class="tl-item">
                      <span class="tl-time">{{ fmtTs(e.at) }}</span>
                      <span class="tl-role">{{ e.role }}<template v-if="e.who"> ({{ e.who }})</template></span>
                      <span class="tl-action">{{ e.action }}</span>
                      <span v-if="e.note" class="tl-note">— “{{ e.note }}”</span>
                    </li>
                  </ul>
                </td>
              </tr>
              </template>
            </template>
          </tbody>
        </table>
        <div v-else class="empty-inline">Tidak ada error code.</div>
      </div>
    </div>

    <!-- Slot rendered directly below the Executive Summary -->
    <template v-if="!isSimpleViewer"><slot name="after-exec-summary" /></template>

    <!-- Error Code appeal (banding) modals -->
    <CardHolderManualCheckModal
      v-if="manualCheckRow && resultId && manualCheckIsVerification"
      :result-id="resultId"
      :display-id="displayId"
      :row="manualCheckRow"
      :direct="isReviewer"
      @close="manualCheckRow = null"
      @submitted="onAppealChanged"
    />
    <ErrorCodeManualCheckModal
      v-else-if="manualCheckRow && resultId"
      :result-id="resultId"
      :display-id="displayId"
      :row="manualCheckRow"
      :direct="isReviewer"
      @close="manualCheckRow = null"
      @submitted="onAppealChanged"
    />
    <ErrorCodeReviewModal
      v-if="reviewRow && resultId"
      :result-id="resultId"
      :display-id="displayId"
      :row="reviewRow"
      :stage="reviewStage"
      @close="reviewRow = null"
      @reviewed="onAppealChanged"
    />
    <AddErrorCodeModal
      v-if="showAddModal && resultId"
      :result-id="resultId"
      :display-id="displayId"
      :evaluation="ev"
      :direct="isReviewer"
      @close="showAddModal = false"
      @submitted="onAddSubmitted"
    />

    <!-- Source files -->
    <div v-if="result.source_files?.length && !isSimpleViewer" class="block">
      <div class="block-title">File Sumber ({{ result.source_files.length }})</div>
      <div class="chips">
        <span v-for="(f, i) in result.source_files" :key="i" class="chip chip-blue">{{ f }}</span>
      </div>
    </div>

    <!-- Transcript PDF viewers (sorted by filename) -->
    <div v-if="result.result_id && result.source_files?.length && !isSimpleViewer" class="block">
      <div class="block-title">Transkrip PDF ({{ result.source_files.length }} file)</div>
      <PdfViewer
        v-for="fn in sortedFiles(result.source_files)"
        :key="fn"
        :result-id="result.result_id"
        :filename="fn"
      />
    </div>

    <template v-if="ev && !isSimpleViewer">
      <!-- Extracted data -->
      <div class="block">
        <div class="block-title">Data Terekstrak</div>
        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Nama Nasabah</div>
            <div class="meta-value">{{ ev.customer_full_name || '—' }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Bank Tujuan</div>
            <div class="meta-value">{{ ev.bank_name || '—' }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Nominal Pencairan</div>
            <div class="meta-value">{{ ev.disbursement_amount != null ? formatRupiah(ev.disbursement_amount) : '—' }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Tenor</div>
            <div class="meta-value">{{ ev.tenor_months != null ? ev.tenor_months + ' bulan' : '—' }}</div>
          </div>
        </div>
      </div>

      <!-- Interest -->
      <div class="block">
        <div class="block-title">Minat Nasabah</div>
        <div class="interest-grid">
          <div class="interest-card">
            <div class="interest-head">
              <span class="interest-name">Mega Cashline</span>
              <span :class="['badge', interestClass(ev.cashline_interest?.status)]">
                {{ ev.cashline_interest?.status || 'NOT_STATED' }}
              </span>
            </div>
            <Evidence :evidence="ev.cashline_interest?.evidence" />
            <div v-if="ev.cashline_interest?.reason" class="interest-reason">
              <span class="reason-label">Alasan</span> {{ ev.cashline_interest.reason }}
            </div>
          </div>
          <div class="interest-card">
            <div class="interest-head">
              <span class="interest-name">Mega Ultima Shield</span>
              <span :class="['badge', interestClass(ev.mus_interest?.status)]">
                {{ ev.mus_interest?.status || 'NOT_STATED' }}
              </span>
            </div>
            <Evidence :evidence="ev.mus_interest?.evidence" />
            <div v-if="ev.mus_interest?.reason" class="interest-reason">
              <span class="reason-label">Alasan</span> {{ ev.mus_interest.reason }}
            </div>
          </div>
          <div class="interest-card">
            <div class="interest-head">
              <span class="interest-name">
                Mega Ultima Shield <span class="interest-tag interest-tag-strong">Kartu Kredit Non-Cashline</span>
              </span>
              <span :class="['badge', interestClass(ev.mus_cc_interest?.status)]">
                {{ ev.mus_cc_interest?.status || 'NOT_STATED' }}
              </span>
            </div>
            <Evidence :evidence="ev.mus_cc_interest?.evidence" />
            <div v-if="ev.mus_cc_interest?.reason" class="interest-reason">
              <span class="reason-label">Alasan</span> {{ ev.mus_cc_interest.reason }}
            </div>
          </div>
        </div>
      </div>

      <!-- Ringkasan Kategori dipindah ke Executive Summary (digabung dengan
           "Scorecard Belum Sesuai") — lihat blok di atas. -->

      <!-- Scorecard result -->
      <div v-if="ev.scorecard_result?.length" class="block">
        <div class="block-title">Hasil Scorecard ({{ ev.scorecard_result.length }} item)</div>
        <div class="tbl-scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Requirement</th>
              <th>Tolerable Error</th>
              <th class="num">Bobot</th>
              <th>Status</th>
              <th class="num skor-col">Skor</th>
              <th>Evidence</th>
              <th class="reason-col">Reason</th>
              <th>Ticket ID</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(it, i) in ev.scorecard_result" :key="i">
              <tr>
                <td class="strong">{{ it.item_code || '—' }}<div class="cat-sub">{{ categoryLabel(it.category) }}</div></td>
                <td>{{ it.requirement || '—' }}</td>
                <td>
                  <span :class="['badge', it.tolerable === 'NO' ? 'badge-red' : 'badge-gray']">
                    {{ it.tolerable || '—' }}
                  </span>
                </td>
                <td class="num">{{ weightPct(it.weight) }}</td>
                <td>
                  <span :class="['badge', it.status === 'SESUAI' ? 'badge-green' : 'badge-red']">
                    {{ it.status || '—' }}
                  </span>
                </td>
                <td class="num skor-col">{{ it.item_score ?? '—' }}</td>
                <td><Evidence :evidence="it.evidence" compact /></td>
                <td class="reason reason-cell">{{ it.reason || '—' }}</td>
                <td class="ticket-cell">{{ it.evidence?.ticket_id || it.ticket_id || '—' }}</td>
              </tr>
              <!-- Verifikasi Dinamis: satu baris per verified_parameter -->
              <template v-if="it.category === 'Verifikasi Dinamis' && dvdParams(it).length">
                <tr class="dvd-summary-row">
                  <td colspan="9">
                    <div class="dvd">
                      <strong>Verifikasi Dinamis:</strong>
                      {{ it.dynamic_verification_detail?.detected_count ?? 0 }} /
                      {{ it.dynamic_verification_detail?.min_required ?? 0 }} terpenuhi
                      <span v-if="it.dynamic_verification_detail?.reason" class="dvd-reason">— {{ it.dynamic_verification_detail.reason }}</span>
                    </div>
                  </td>
                </tr>
                <tr v-for="(p, pi) in dvdParams(it)" :key="`${i}-dvd-${pi}`" class="dvd-param-row">
                  <td class="strong">{{ it.item_code || '—' }}</td>
                  <td>{{ p.param_name || '—' }}</td>
                  <td></td>
                  <td class="num"></td>
                  <td></td>
                  <td class="num"></td>
                  <td class="dvd-evidence">{{ dvdEvidence(p) }}</td>
                  <td></td>
                  <td class="ticket-cell">{{ p.agent_question?.ticket_id || '—' }}</td>
                </tr>
              </template>
              <tr v-else-if="it.dynamic_verification_detail" class="dvd-row">
                <td colspan="9">
                  <div class="dvd">
                    <strong>Verifikasi Dinamis:</strong>
                    {{ it.dynamic_verification_detail.detected_count ?? 0 }} /
                    {{ it.dynamic_verification_detail.min_required ?? 0 }} terpenuhi
                    <span v-if="it.dynamic_verification_detail.reason" class="dvd-reason">— {{ it.dynamic_verification_detail.reason }}</span>
                    <div
                      v-for="(p, pi) in (it.dynamic_verification_detail.verified_parameters || [])"
                      :key="pi"
                      class="dvd-param"
                    >
                      • {{ p.param_name || p.param_code }}
                      <span v-if="p.customer_answer?.quote" class="muted">— "{{ p.customer_answer.quote }}"</span>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        </div>
      </div>

    </template>

    <div v-else class="empty-inline">Tidak ada data evaluasi.</div>
  </div>
</template>

<script setup>
import { computed, h, ref } from 'vue'
import PdfViewer from './PdfViewer.vue'
import ErrorCodeManualCheckModal from './ErrorCodeManualCheckModal.vue'
import CardHolderManualCheckModal from './CardHolderManualCheckModal.vue'
import ErrorCodeReviewModal from './ErrorCodeReviewModal.vue'
import AddErrorCodeModal from './AddErrorCodeModal.vue'
import { useAuthStore } from '../stores/auth.js'
import { P } from '../permissions.js'
import { appealTimeline } from '../utils/appealTimeline.js'

const props = defineProps({
  // The full final result JSON: { campaign, passing_grade, ..., evaluation: {...} }
  result: { type: Object, required: true },
  // Hide the role-"sales_agent" Error Code table (used in the Results dropdown, where the
  // Agent Error Summary already covers it); other usages keep showing it.
  hideErrorCode: { type: Boolean, default: false },
  // Result UUID + display id — needed for the Error Code appeal (banding) flow.
  resultId: { type: String, default: null },
  displayId: { type: String, default: null },
})
const emit = defineEmits(['appeal-changed'])

const ev = computed(() => props.result?.evaluation || null)

// Role "sales_agent" only sees the Error Code table (item_code column hidden); all other detail blocks are hidden.
const auth = useAuthStore()
// "Simple viewer" roles (individual agent + team leader) see the simplified
// Results detail (Error Code table only; no Executive Summary / scores).
// Semua gate di bawah memakai capability, bukan nama role — supaya role buatan
// operator (menu Manage Role) ikut mendapat kolom yang sesuai.
const isSimpleViewer = computed(() => !auth.can(P.RESULTS_EVALUATION_DETAIL))
const canAppeal = computed(() => auth.can(P.ERROR_CODE_APPEAL))
const canDirectEdit = computed(() => auth.can(P.ERROR_CODE_DIRECT_EDIT))
const canReviewTl = computed(() => auth.can(P.ERROR_CODE_REVIEW_TL))
const canReviewSpq = computed(() => auth.can(P.ERROR_CODE_REVIEW_SPQ))

// The appeal columns only make sense when a resultId is available (Results page).
// "Ringkasan Kategori": kolom Bobot & Skor disembunyikan khusus untuk QC —
// QC menilai lolos/tidaknya kategori, bukan angka bobot/skornya.
const showCategoryScore = computed(() => auth.can(P.RESULTS_CATEGORY_SCORE))

const showManualCheckCol = computed(() => canAppeal.value && !!props.resultId)
// Both reviewers see a review column: Team Leader QC does the intermediate check
// (approve/reject/escalate), SPQ Head the final approval of escalated bandings.
const showReviewCol = computed(() => (canReviewSpq.value || canReviewTl.value) && !!props.resultId)
const reviewStage = computed(() => (canReviewTl.value ? 'tl' : 'spq'))

// Team Leader QC & SPQ Head may edit an error code DIRECTLY (no approval
// hierarchy) — a per-row Manual Check that applies immediately. This is separate
// from the Review Banding column (which acts on QC-submitted appeals).
const showDirectEditCol = computed(() => canDirectEdit.value && !!props.resultId)

// Error Code table column count (base 10 + Riwayat + role-specific action columns).
// Base 10 = Sumber, Error Code, Error Type, Error Category, Risk Base, Item Code,
// Details Error, Reason, Evidence, Ticket ID.
// QC: [Manual Check]. Reviewer: [Manual Check (direct)] + [Review Banding].
const showHistoryCol = computed(
  () => showManualCheckCol.value || showReviewCol.value || showDirectEditCol.value)
const errorColCount = computed(() =>
  10 + (showHistoryCol.value ? 1 : 0)
    + (showManualCheckCol.value ? 1 : 0)
    + (showDirectEditCol.value ? 1 : 0)
    + (showReviewCol.value ? 1 : 0))

// Per-row expand state for the history timeline (keyed by "groupIndex-rowIndex").
const openHistory = ref(new Set())
function toggleHistory(key) {
  const s = new Set(openHistory.value)
  s.has(key) ? s.delete(key) : s.add(key)
  openHistory.value = s
}
function isHistoryOpen(key) { return openHistory.value.has(key) }

function fmtTs(iso) {
  if (!iso) return '—'
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
}

// Flatten an error-code row's appeal history into a chronological event timeline:
// each banding contributes a submit event (QC) + a TL QC decision + an SPQ Head
// decision, with the reason/comment as the note.
function rowTimeline(row) {
  // Wording timeline dipusatkan di utils/appealTimeline.js — dipakai juga oleh
  // modal Riwayat di kolom Results supaya kedua tampilan tidak berbeda kata.
  return appealTimeline(row?.appeal?.history || [])
}

// --- Error Code appeal (banding) ------------------------------------------
const manualCheckRow = ref(null)
const reviewRow = ref(null)
const showAddModal = ref(false)

// Data-verification rows (Card Holder B17 / Cashline B02/B03/B05) use a dedicated
// modal with 3 free-text fields (alasan / reference value / extracted value).
const manualCheckIsVerification = computed(() => {
  const ec = (manualCheckRow.value?.error_code || '').toUpperCase()
  return ec === 'B17' || ['B02', 'B03', 'B05'].some((x) => ec.includes(x))
})

function rowStatus(row) {
  // Effective (tiered) status: a Team Leader QC approve/reject is FINAL, so use it
  // — approval_status (latest_status) stays 'pending' unless it reached SPQ Head.
  return row?.appeal?.effective_status || row?.appeal?.latest_status || null
}

// Who a pending banding is currently waiting on: Team Leader QC (belum diproses) vs
// SPQ Head (sudah di-escalate TL QC). Dipakai di kolom Manual Check agar QC tahu
// persetujuan sedang menunggu siapa.
function pendingReviewer(row) {
  return (row?.appeal?.tl_qc_status === 'escalated') ? 'SPQ Head' : 'Team Leader QC'
}
function pendingReviewerShort(row) {
  return (row?.appeal?.tl_qc_status === 'escalated') ? 'SPQ Head' : 'TL QC'
}

// Effective (tiered) status of a single appeal entry — mirrors the backend
// effective_appeal_status: a TL QC approve/reject is final; only an escalated one
// waits on SPQ Head's approval_status.
function effEntryStatus(h) {
  const tl = h?.tl_qc_status || 'pending'
  if (tl === 'approved') return 'approved'
  if (tl === 'rejected') return 'rejected'
  if (tl === 'escalated') return ['approved', 'rejected'].includes(h?.approval_status) ? h.approval_status : 'pending'
  return 'pending'
}
function rowHistoryTip(row) {
  const hist = row?.appeal?.history || []
  if (!hist.length) return ''
  const label = { pending: 'Menunggu Approval', approved: 'Approved', rejected: 'Rejected' }
  return hist
    .map((h, i) => `${i + 1}. ${label[effEntryStatus(h)] || effEntryStatus(h)}: ${h.qc_reason || '—'}`)
    .join('\n')
}

function openManualCheck(row) {
  manualCheckRow.value = row
}
function openReview(row) {
  reviewRow.value = row
}
function onAppealChanged() {
  manualCheckRow.value = null
  reviewRow.value = null
  emit('appeal-changed', props.resultId)
}
function onAddSubmitted() {
  showAddModal.value = false
  emit('appeal-changed', props.resultId)
}

// Format a score value for display (Indonesian locale, up to 2 decimals); "—" if missing.
function fmtScore(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

// Like fmtScore but prefixes a "+" for non-negative numbers (used for the starting score).
function signed(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + fmtScore(n)
}

// Render a (failed item) weight as a negative deduction, e.g. 5 -> "−5".
function negWeight(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return '−' + fmtScore(Math.abs(n))
}

function numOr0(v) {
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

// Signed change for the "Perubahan" column, e.g. 108.75 -> "+108,75", -15 -> "−15".
function deltaText(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return ''
  return (n >= 0 ? '+' : '−') + fmtScore(Math.abs(n))
}
function deltaClass(v) {
  const n = Number(v)
  if (Number.isNaN(n) || n === 0) return ''
  return n < 0 ? 'deduct' : 'add'
}

// Skor scorecard deterministik (sumber tunggal, sama dengan backend):
// phase2 = skor maksimal − bobot tiap item BELUM_SESUAI; phase3 = phase2 + verif + kritis.
const maxScore = computed(() =>
  maxScoreBreakdown.value.length ? maxScoreTotal.value : numOr0(ev.value?.maximum_score)
)
const phase2 = computed(() => {
  const belum = (ev.value?.scorecard_result || [])
    .filter((it) => it?.status === 'BELUM_SESUAI')
    .reduce((s, it) => s + numOr0(it?.weight), 0)
  return maxScore.value - belum
})
const verifScore = computed(() => numOr0(ev.value?.ai_score_verification))
const criticalScore = computed(() => numOr0(ev.value?.ai_score_critical_compliance_check))
const phase3 = computed(() => phase2.value + verifScore.value + criticalScore.value)

// Running balance checkpoints (Hasil column): max -> phase2 -> +verif -> phase3.
const runAfterVerif = computed(() => phase2.value + verifScore.value)
// Net change of the scorecard section (= phase2 - skor maksimal), always <= 0.
const scorecardDelta = computed(() => phase2.value - maxScore.value)

// PASS/FAIL: skor akhir deterministik vs batas lulus.
const lulus = computed(() => {
  const pass = Number(ev.value?.passing_grade)
  if (Number.isNaN(pass)) return false
  return phase3.value >= pass
})

// Executive summary: scorecard items flagged BELUM_SESUAI.
const belumSesuai = computed(() =>
  (ev.value?.scorecard_result || []).filter((it) => it?.status === 'BELUM_SESUAI')
)

// "Ringkasan Kategori": hasil per kategori + item scorecard BELUM_SESUAI yang jatuh
// di kategori itu, satu baris per item (sel kategori di-rowspan). Kategori yang lolos
// tetap ditampilkan dengan satu baris kosong, supaya tabel ini tetap menjadi ringkasan
// LENGKAP seperti tabel Ringkasan Kategori yang lama.
const categoryBreakdown = computed(() => {
  const failsByCat = new Map()
  for (const it of belumSesuai.value) {
    const key = it?.category || '—'
    if (!failsByCat.has(key)) failsByCat.set(key, [])
    failsByCat.get(key).push(it)
  }
  const rows = (ev.value?.category_summary || []).map((c) => ({
    ...c,
    items: failsByCat.get(c.category) || [],
  }))
  // Item yang kategorinya tidak ada di category_summary tidak boleh hilang.
  const known = new Set(rows.map((r) => r.category))
  for (const [category, items] of failsByCat) {
    if (!known.has(category)) rows.push({ category, items, category_result: 'FAIL' })
  }
  return rows.map((r) => ({ ...r, rowspan: Math.max(1, r.items.length) }))
})

// Derived error code for a scorecard BELUM_SESUAI item, mirroring the backend
// (compliance/error_codes.py CATEGORY_ERROR_CODES). Falls back to the per-item
// code from the server-built error_code_table, else "—".
// Cermin dari CATEGORY_ERROR_CODES di compliance/error_codes.py — ubah keduanya
// bersamaan. ('Probing Cashline' yang dulu tertulis di sini bukan nama kategori yang
// ada di data; yang benar 'Penjelasan Mega Cashline'.)
const SCORECARD_CATEGORY_CODES = [
  {
    categories: [
      'Penjelasan Mega Cashline',
      'Final Konfirmasi Mega Cashline',
      'Final Konfirmasi Mega Ultima Shield',
    ],
    code: 'B10',
  },
  { categories: ['Greeting'], code: 'B12' },
  { categories: ['Legal Statement Mega Cashline', 'Legal Statement Mega Ultima Shield'], code: 'B18' },
]
// Verification items now propagate into the scorecard (card_holder_verification ->
// SC_CL_23_1/23_2 static, SC_CL_24 dynamic). Surface them in the scorecard-deduction
// breakdown with their verification error code + a "Verifikasi Statik/Dinamis" label.
const VERIF_ITEM_CODES = { SC_CL_23_1: 'B17', SC_CL_23_2: 'B17', SC_CL_24: 'B16' }
const VERIF_ITEM_CATEGORY = {
  SC_CL_23_1: 'Verifikasi Statik', SC_CL_23_2: 'Verifikasi Statik', SC_CL_24: 'Verifikasi Dinamis',
}
// Nama TAMPILAN kategori scorecard. Kategori "Verifikasi" hanya berisi item statik
// (SC_CL_23_1/23_2) — verifikasi dinamis sudah kategori tersendiri — jadi nama
// polosnya menyesatkan. Diganti saat ditampilkan saja: nilai mentahnya tetap dipakai
// untuk pencocokan (mis. it.category === 'Verifikasi Dinamis') dan tersimpan apa
// adanya di result_json tiket lama. Cermin CATEGORY_DISPLAY di
// compliance/stats_aggregate.py.
const CATEGORY_LABEL = { Verifikasi: 'Verifikasi Statik' }
function categoryLabel(category) {
  return CATEGORY_LABEL[category] || category
}

// Semua penyebutan nasabah untuk sebuah field verifikasi (statik boleh diulang).
// `extracted_mentions` baru ada sejak prompt v47 — hasil lama hanya punya
// `extracted_value`, jadi dikembalikan sebagai daftar berisi satu nilai supaya
// tampilannya tidak berubah untuk tiket lama.
function mentionsOf(v) {
  // Sejak prompt v52 tiap elemen berupa objek { timestamp, value } — dua ucapan yang
  // kata-katanya identik di menit berbeda tidak lagi bisa digabung. Hasil lama
  // menyimpan string telanjang, jadi keduanya diterima.
  const raw = Array.isArray(v?.extracted_mentions) ? v.extracted_mentions : []
  const list = raw
    .map((m) => (m && typeof m === 'object'
      ? { ts: String(m.timestamp || ''), value: String(m.value ?? '') }
      : { ts: '', value: String(m ?? '') }))
    .filter((m) => m.value !== '')
  if (list.length) return list
  return v?.extracted_value != null && v.extracted_value !== ''
    ? [{ ts: '', value: String(v.extracted_value) }]
    : []
}
function scorecardErrorCode(it) {
  if (VERIF_ITEM_CODES[it?.item_code]) return VERIF_ITEM_CODES[it.item_code]
  const cat = it?.category
  for (const rule of SCORECARD_CATEGORY_CODES) {
    if (rule.categories.includes(cat)) return rule.code
  }
  const row = (ev.value?.error_code_table || []).find((r) => r.item_code && r.item_code === it?.item_code)
  return row?.error_code || '—'
}
// Error Type / Error Category (kosakata sheet QC) untuk sebuah item scorecard yang
// BELUM_SESUAI. Diambil dari baris error_code_table yang dibangun backend — bukan
// dipetakan ulang di sini — supaya hanya ada SATU tempat yang tahu kode mana masuk
// kategori apa (compliance/error_codes.py). Dicari lewat item_code dulu; item yang
// kodenya diturunkan per kategori (B10/B12/B18) bisa saja tidak punya baris
// ber-item_code, jadi ada cadangan pencarian lewat error_code-nya.
function errorMetaOf(it) {
  const table = ev.value?.error_code_table || []
  const byItem = table.find((r) => r.item_code && r.item_code === it?.item_code)
  if (byItem) return byItem
  const code = scorecardErrorCode(it)
  return table.find((r) => r.error_code === code) || {}
}
function scorecardErrorType(it) {
  return errorMetaOf(it).error_type || '—'
}
function scorecardErrorCategory(it) {
  return errorMetaOf(it).error_category || '—'
}

// Display category for a scorecard-deduction row: verification-linked items show
// "Verifikasi Statik/Dinamis"; everything else keeps its scorecard category.
function deductionCategory(it) {
  return VERIF_ITEM_CATEGORY[it?.item_code] || categoryLabel(it?.category) || '—'
}

// Negate the "Agent ..." requirement → "Agent tidak ..." (no item-code suffix;
// the item code is already shown separately in this row).
function negatedRequirement(it) {
  const req = it?.requirement || ''
  if (!req) return 'Item scorecard belum terpenuhi.'
  const m = req.match(/^(\s*Agent\s+)(.*)$/i)
  return m ? `${m[1]}tidak ${m[2]}` : `Belum terpenuhi: ${req}`
}

// --- Reasons for the "Ringkasan Penilaian AI" table (plain-language "why") ---

// Products the customer was interested in (drives maximum_score).
const interestedProducts = computed(() => {
  const arr = []
  if (ev.value?.cashline_interest?.status === 'INTERESTED') arr.push('Mega Cashline')
  if (ev.value?.mus_interest?.status === 'INTERESTED') arr.push('Mega Ultima Shield')
  return arr
})
const maxScoreReason = computed(() => {
  const p = interestedProducts.value
  if (!p.length) return 'Produk yang diminati customer tidak terdeteksi'
  return `Customer tertarik pada ${p.join(' dan ')}`
})

// Maximum-score breakdown by product interest: Mega Cashline = 108.75,
// Mega Ultima Shield = 41.25. Summed at the end.
const maxScoreBreakdown = computed(() => {
  const out = []
  if (ev.value?.cashline_interest?.status === 'INTERESTED') out.push({ name: 'Mega Cashline', score: 108.75 })
  if (ev.value?.mus_interest?.status === 'INTERESTED') out.push({ name: 'Mega Ultima Shield', score: 41.25 })
  return out
})
const maxScoreTotal = computed(() => maxScoreBreakdown.value.reduce((s, p) => s + p.score, 0))

// Data-input error codes (B02/B03/B05) emitted for cashline data mismatches.
const dataInputCodes = computed(() =>
  (ev.value?.error_codes || []).filter((e) => ['B02', 'B03', 'B05'].includes(e?.error_code))
)

// Resolve the specific data-input error code for a cashline field by matching the
// field name / reference / extracted value inside an error code's reason text.
// Each code is consumed once (via `used`); falls back to a generic label.
function codeForCashlineField(v, used) {
  const codes = dataInputCodes.value
  const needles = [titleizeField(v.field), v.field, v.reference_value, v.extracted_value]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).toLowerCase())
  for (let i = 0; i < codes.length; i++) {
    if (used.has(i)) continue
    const reason = (codes[i]?.trigger_source?.reason || '').toLowerCase()
    if (needles.some((n) => reason.includes(n))) {
      used.add(i)
      return codes[i].error_code
    }
  }
  return 'B02/B03/B05'
}

// Dynamic 2-match rule (KB min_verification_required=2): once >= 2 dynamic
// card-holder fields MATCH, the remaining MISMATCH ones carry no penalty and are
// hidden from the deduction breakdown / error code table (mirrors
// compliance/error_codes.py). Uses CARD_HOLDER_DYNAMIC_FIELDS defined below.
const cardHolderTwoMatchSatisfied = (items) =>
  (items || []).filter((v) => CARD_HOLDER_DYNAMIC_FIELDS.includes(v?.field) && (v?.match === 'MATCH' || v?.event_verified === true)).length >= 2

// Verification deductions (item_score < 0) with their error code, for the
// "Pengurangan – Verifikasi data" breakdown. Card holder mismatches -> B17.
const verificationDeductions = computed(() => {
  const out = []
  const ch = ev.value?.card_holder_verification || []
  const twoMatch = cardHolderTwoMatchSatisfied(ch)
  for (const v of ch) {
    if (Number(v?.item_score) < 0) {
      if (twoMatch && CARD_HOLDER_DYNAMIC_FIELDS.includes(v?.field)) continue
      out.push({ ...v, error_code: 'B17' })
    }
  }
  const used = new Set()
  for (const v of ev.value?.cashline_data_verification || []) {
    if (Number(v?.item_score) < 0) out.push({ ...v, error_code: codeForCashlineField(v, used) })
  }
  return out
})

// Critical compliance items that failed (drive the critical penalty).
const criticalFails = computed(() =>
  (ev.value?.critical_compliance_check?.checked_items || []).filter((it) => it?.status === 'FAIL')
)

// Alasan gagalnya satu item critical compliance. Backend mengirim `reason` yang
// menyebut SEBAB sebenarnya (lihat annotate_critical_compliance_reasons) — penting
// untuk verifikasi statik, karena "Agent tidak memverifikasi tanggal lahir" justru
// SALAH bila agent sudah bertanya dan jawabannya yang tidak cocok Ascend. Negasi di
// bawah hanya cadangan untuk hasil lama yang belum punya field itu.
function cccReason(it) {
  if (it?.reason) return it.reason
  const req = it?.requirement || ''
  if (!req) return it?.item_code || '—'
  const m = req.match(/^(\s*Agent\s+)(.*)$/i)
  return m ? `${m[1]}tidak ${m[2]}` : `Belum terpenuhi: ${req}`
}

// Error Code table: server-computed rows from the single source of truth
// (compliance/error_codes.py, injected as evaluation.error_code_table by the
// /result API). Rows arrive already ordered by source ("sumber").
const errorCodeRows = computed(() => ev.value?.error_code_table || [])

// Group rows by source for the grouped table layout (order preserved).
const errorCodeGroups = computed(() => {
  const groups = []
  let current = null
  for (const row of errorCodeRows.value) {
    if (!current || current.sumber !== row.sumber) {
      current = { sumber: row.sumber || '—', rows: [] }
      groups.push(current)
    }
    current.rows.push(row)
  }
  return groups
})

// Total weight across all scorecard items (numeric weights only).
const totalWeight = computed(() => {
  const items = ev.value?.scorecard_result || []
  return items.reduce((sum, it) => {
    const w = it?.weight
    return sum + (typeof w === 'number' && !Number.isNaN(w) ? w : 0)
  }, 0)
})

// Render an item weight as a percentage of the total weight, rounded to integer.
function weightPct(weight) {
  if (typeof weight !== 'number' || Number.isNaN(weight) || !totalWeight.value) return '—'
  return `${Math.round((weight / totalWeight.value) * 100)}%`
}

// Total weight across all categories (numeric weights only).
const totalCategoryWeight = computed(() => {
  const cats = ev.value?.category_summary || []
  return cats.reduce((sum, c) => {
    const w = c?.total_weight
    return sum + (typeof w === 'number' && !Number.isNaN(w) ? w : 0)
  }, 0)
})

// Render a category weight as a percentage of the total category weight, rounded to integer.
function categoryWeightPct(weight) {
  if (typeof weight !== 'number' || Number.isNaN(weight) || !totalCategoryWeight.value) return '—'
  return `${Math.round((weight / totalCategoryWeight.value) * 100)}%`
}

// Sort PDF filenames ascending — embedded YYYYMMDDHHMMSS makes lexical order
// match chronological order for the same prefix.
function sortedFiles(files) {
  return [...(files || [])].sort((a, b) => a.localeCompare(b))
}

function interestClass(status) {
  return {
    INTERESTED: 'badge-green',
    NOT_INTERESTED: 'badge-red',
    NOT_STATED: 'badge-gray',
  }[status] || 'badge-gray'
}

// Match badge for verification tables (card holder / cashline data).
// Format a snake_case field name into Title Case with spaces.
// e.g. "nominal_pencairan" -> "Nominal Pencairan"
function titleizeField(field) {
  return String(field)
    .split('_')
    .filter((w) => w.length)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function matchBadgeClass(match) {
  return {
    MATCH: 'badge-green',
    MISMATCH: 'badge-red',
    SKIPPED_NULL: 'badge-gray',
  }[match] || 'badge-gray'
}

// Type of Verification (kolom "Tipe Verifikasi").
//
// Card Holder (Ascend): data yang bisa berubah sewaktu-waktu = DINAMIS; sisanya
// (tanggal lahir, nama ibu kandung) = STATIK. Daftar ini HARUS sama dengan
// CARD_HOLDER_DYNAMIC_FIELDS di compliance/error_codes.py — di sana dipakai untuk
// scoring grup (min 2 match), di sini murni untuk label.
const CARD_HOLDER_DYNAMIC_FIELDS = [
  'alamat_pengiriman_tagihan', 'alamat_rumah', 'no_telpon_terdaftar',
  'alamat_kantor', 'no_telpon_kantor', 'alamat_email_terdaftar',
  'nama_kartu_suplement', 'jumlah_kartu_suplement', 'nama_keluarga_relasi',
]

function cardHolderVerificationType(field) {
  return CARD_HOLDER_DYNAMIC_FIELDS.includes(field) ? 'DINAMIS' : 'STATIK'
}

function verificationTypeBadgeClass(type) {
  return type === 'DINAMIS' ? 'badge-blue' : 'badge-gray'
}

// Verifikasi Dinamis helpers (revisi2): expand verified_parameters into rows
function dvdParams(it) {
  return it?.dynamic_verification_detail?.verified_parameters || []
}

function dvdEvidence(p) {
  const aq = p.agent_question || {}
  const ca = p.customer_answer || {}
  const agent = `${aq.timestamp || ''} ${aq.quote || ''}`.trim()
  const customer = `${ca.timestamp || ''} ${ca.quote || ''}`.trim()
  return `Agent : ${agent} | Customer Answer : ${customer}`
}

function formatRupiah(n) {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  } catch {
    return String(n)
  }
}

// Inline Evidence renderer (timestamp + quote, or em-dash)
const Evidence = {
  props: { evidence: { type: Object, default: null }, compact: { type: Boolean, default: false } },
  setup(p) {
    return () => {
      const e = p.evidence
      if (!e || (!e.quote && !e.timestamp)) {
        return h('span', { class: 'ev-empty' }, '—')
      }
      return h('div', { class: ['ev', { 'ev-compact': p.compact }] }, [
        e.timestamp ? h('span', { class: 'ev-ts' }, e.timestamp) : null,
        e.quote ? h('span', { class: 'ev-quote' }, `"${e.quote}"`) : null,
      ])
    }
  },
}
</script>

<style scoped>
.eval { display: flex; flex-direction: column; gap: 20px; }

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.meta-item {
  background: #f8fafc; border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 14px;
}
.meta-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted);
}
.meta-value { font-size: 15px; font-weight: 700; color: var(--text); margin-top: 2px; word-break: break-word; }
.meta-value .campaign-interest-list { margin: 0; padding-left: 16px; list-style: disc; font-size: 13px; }
.meta-value .campaign-interest-list li { white-space: nowrap; }

.block { display: flex; flex-direction: column; gap: 10px; }
.block-title { font-size: 14px; font-weight: 700; color: var(--text); }

/* Score summary — running-balance table (plain language) */
.calc-tbl {
  width: 100%; max-width: 680px; border-collapse: collapse;
  background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; overflow: visible;
}
.calc-tbl th {
  background: #f1f5f9; padding: 9px 14px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted);
  border-bottom: 1px solid var(--border); text-align: left;
}
.calc-tbl th.num { text-align: right; }
.calc-tbl td { padding: 10px 14px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
.calc-tbl tr:last-child td { border-bottom: none; }
.ct-name { font-size: 13px; font-weight: 600; color: var(--text); }
.ct-label .info { margin-left: 4px; vertical-align: middle; }
.ct-reason { font-size: 12px; color: var(--text-muted); line-height: 1.45; margin-top: 4px; }
.ct-change { font-size: 13px; font-weight: 600; color: var(--text-muted); white-space: nowrap; text-align: right; width: 90px; }
.ct-change.deduct { color: var(--red); }
.ct-change.add { color: #16a34a; }
.ct-result { font-size: 14px; font-weight: 700; color: var(--text); white-space: nowrap; text-align: right; width: 90px; }
.calc-reason-list { margin: 2px 0 0; padding-left: 18px; list-style: disc; }
.calc-reason-list li { margin-top: 1px; }
.calc-reason-list strong { color: var(--text); font-weight: 700; }
.row-section td { border-top: 1px solid var(--border); }
.row-section td { border-bottom: none; }
.row-head td { border-bottom: none; }
.row-sub td { border-bottom: none; padding-top: 4px; padding-bottom: 4px; }
.row-sub .ct-label { padding-left: 30px; }
.ct-sub-name { font-size: 12px; color: var(--text-muted); }
.ct-sub-name strong { color: var(--text); font-weight: 700; }
.row-subtotal td { border-top: 1px solid var(--border); }
.row-subtotal .ct-name { font-weight: 700; }
.row-subtotal .ct-result { background: #eef2f6; }
.row-total td { border-top: 2px double var(--text-muted); }
.row-total .ct-name { font-weight: 700; }
.row-total .ct-result { font-size: 18px; background: #eef2f6; }

/* Inline info tooltip (ⓘ on hover/focus) */
.info { position: relative; display: inline-flex; cursor: help; color: var(--text-muted); font-size: 12px; }
.info .tip {
  display: none; position: absolute; left: 50%; bottom: calc(100% + 6px);
  transform: translateX(-50%); width: max-content; max-width: 260px;
  background: #fff; color: var(--text); font-size: 12px; font-weight: 400; line-height: 1.4;
  text-align: left; padding: 8px 10px; border: 1px solid var(--border);
  border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); z-index: 100000;
  white-space: pre-line;
}
.info:hover .tip, .info:focus .tip, .info:focus-within .tip { display: block; }

/* Error Code Manual Check / Review Banding cells */
.mc-cell { white-space: nowrap; }
.mc-btn {
  padding: 5px 10px; background: var(--blue); color: #fff; border: none; border-radius: 6px;
  font-size: 11.5px; font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.mc-btn:hover { background: #2563eb; }
.mc-waiting {
  display: inline-block; font-size: 11.5px; font-weight: 600; color: #b45309;
  line-height: 1.25; text-align: center;
}
/* Rejected: shown as two stacked lines (button + "rejected"). */
.mc-stack { display: inline-flex; flex-direction: column; align-items: center; gap: 3px; }
.mc-rejected { font-size: 11.5px; font-weight: 700; color: var(--red); line-height: 1.1; }

/* Riwayat (history) column + expandable timeline row */
.hist-cell { white-space: nowrap; }
.hist-toggle {
  padding: 3px 9px; font-size: 11.5px; font-weight: 700; cursor: pointer;
  color: var(--blue); background: var(--blue-bg); border: 1px solid transparent; border-radius: 6px;
}
.hist-toggle:hover { border-color: var(--blue); }
.history-row > td { background: #f8fafc; padding: 8px 14px; }
.timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.tl-item {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: 12.5px;
  padding-left: 12px; border-left: 2px solid var(--border); position: relative;
}
.tl-time { font-family: monospace; font-size: 11.5px; color: var(--text-muted); min-width: 92px; }
.tl-role { font-weight: 700; color: var(--text); }
.tl-action { color: var(--text); }
.tl-note { color: var(--text-muted); font-style: italic; word-break: break-word; }

.exec-summary {
  background: #f8fafc; border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; gap: 16px;
}
.exec-sub { display: flex; flex-direction: column; gap: 8px; }
.exec-sub-head { display: flex; align-items: center; gap: 8px; }
.exec-sub-title { font-size: 13px; font-weight: 700; color: var(--text); }
.add-ec-btn {
  margin-left: auto; padding: 5px 12px; background: var(--blue); color: #fff; border: none;
  border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s;
}
.add-ec-btn:hover { background: #2563eb; }
.exec-summary .tbl { background: #fff; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.exec-evidence { font-size: 12px; color: var(--text); white-space: pre-wrap; max-width: 320px; }
.group-row td { background: #eef2f6; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); padding: 6px 12px; }
.src-cell { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.chip-blue { background: var(--blue-bg); color: var(--blue); }

.interest-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.interest-card { background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.interest-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.interest-name { font-weight: 700; font-size: 14px; }
.interest-tag {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.03em; color: var(--text-muted); background: #f1f5f9;
  border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; margin-left: 4px;
  vertical-align: middle; white-space: nowrap;
}
/* MUS "Kartu Kredit Non-Cashline" ditebalkan agar mudah dibedakan dari MUS biasa. */
.interest-tag-strong { font-weight: 800; color: var(--text); }

.tbl { width: 100%; border-collapse: collapse; }
.tbl th {
  background: #f8fafc; padding: 9px 12px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted);
  border-bottom: 1px solid var(--border); text-align: left;
}
.tbl td { padding: 9px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.tbl .num { text-align: right; }
.strong { font-weight: 700; }
.cat-sub { font-size: 11px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
.tbl-scroll { overflow-x: auto; }
.ticket-cell { font-family: monospace; font-size: 11px; white-space: nowrap; min-width: 120px; padding-right: 16px; color: var(--text-muted); }
.muted { color: var(--text-muted); }
.reason { font-weight: 600; color: var(--text); }

/* Daftar penyebutan nasabah pada verifikasi statik (kolom Transkrip). Bernomor agar
   urutan pengulangan terbaca; yang dipakai untuk pencocokan ditebalkan. */
.mention-list { margin: 0; padding-left: 18px; list-style: decimal; }
.mention-list li { line-height: 1.4; }
.mention-list li + li { margin-top: 2px; }
.mention-used { font-weight: 700; }
/* Waktu ucapan — QC bisa melompat ke titik percakapannya di transkrip. */
.mention-ts { display: inline-block; min-width: 44px; color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 6px; }

/* Product T&C from the RIPLAY: an envelope (range / allowed set / fee table), not
   this ticket's value — muted so the TMS column stays the one that reads first. */
.tnc { color: var(--text-muted); font-size: 12px; max-width: 260px; white-space: normal; line-height: 1.4; }
.skor-col { width: 44px; white-space: nowrap; }
.reason-col { min-width: 300px; }
.reason-cell { min-width: 300px; max-width: 460px; font-size: 12px; white-space: normal; line-height: 1.45; }
.interest-reason { margin-top: 8px; font-size: 12px; font-weight: 500; color: var(--text); line-height: 1.45; }
.reason-label {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted); margin-right: 4px;
}

.dvd-row td { background: #fafbfc; }
.dvd { font-size: 12px; color: var(--text); }
.dvd-param { margin-top: 4px; padding-left: 8px; }
.dvd-param-row td { background: #fafbfc; }
.dvd-summary-row td { background: #fafbfc; }
.dvd-reason { color: var(--text); font-weight: 600; font-style: italic; }
.dvd-evidence { font-size: 12px; color: var(--text); white-space: pre-wrap; font-weight: 600; }

.errors { display: flex; flex-direction: column; gap: 10px; }
.error-card { background: var(--red-bg); border: 1px solid #fecaca; border-radius: 10px; padding: 12px 14px; }
.error-head { display: flex; align-items: center; gap: 10px; }
.error-desc { font-weight: 600; font-size: 13px; }
.error-reason { font-size: 12px; color: var(--text); margin-top: 6px; }

.summary { font-size: 13px; line-height: 1.6; color: var(--text); background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }

.badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.badge-green { background: var(--green-bg); color: #16a34a; }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-gray { background: #f1f5f9; color: var(--text-muted); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }

.empty-inline { font-size: 13px; color: var(--text-muted); }

:deep(.ev) { display: flex; flex-direction: column; gap: 3px; }
:deep(.ev-ts) { font-size: 11px; color: var(--blue); font-family: monospace; font-weight: 600; }
:deep(.ev-quote) { font-size: 12px; color: var(--text); font-style: italic; font-weight: 600; }
:deep(.ev-empty) { color: var(--text-muted); }
:deep(.ev-compact) { max-width: 280px; }
</style>
