<template>
  <div class="agent-summary">
    <div class="as-title">Agent Error Summary</div>
    <div class="table-wrap">
      <table class="as-table">
        <thead>
          <tr>
            <th>Agent ID</th>
            <th>Agent Name</th>
            <!-- Nama panggilan on-air (kolom NAME ONLINE di "Update Sales
                 Telemarketing …xlsx"), berdampingan dengan nama lengkap agent. -->
            <th>Name Online</th>
            <th>Lama Bergabung</th>
            <th>Campaign</th>
            <th>Tanggal</th>
            <th v-if="showDetailError">Detail Error</th>
            <th>Failure Category</th>
            <th>Evidence</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!errors.length">
            <td>{{ summary.agent_id || '—' }}</td>
            <td>{{ summary.agent_name || '—' }}</td>
            <td>{{ summary.name_online || '—' }}</td>
            <td class="nowrap">{{ summary.durasi_bergabung || '—' }}</td>
            <td><CampaignCell :campaign="campaign" /></td>
            <td class="nowrap">{{ summary.tanggal || '—' }}</td>
            <td :colspan="showDetailError ? 4 : 3" class="ok-cell">✓ Tidak ada error</td>
          </tr>
          <tr v-for="(e, i) in errors" :key="i">
            <td v-if="i === 0" :rowspan="errors.length">{{ summary.agent_id || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length">{{ summary.agent_name || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length">{{ summary.name_online || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length" class="nowrap">{{ summary.durasi_bergabung || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length"><CampaignCell :campaign="campaign" /></td>
            <td v-if="i === 0" :rowspan="errors.length" class="nowrap">{{ summary.tanggal || '—' }}</td>
            <td v-if="showDetailError">{{ e.details_error || '—' }}</td>
            <!-- "Failure Category" = kolom ``error_category`` tabel Error Code (mis.
                 "Data Input"), memakai kosakata yang sama dengan requirement scorecard.
                 Sampai 28 Agustus 2026 kolom ini bernama "Error Category"; sebelumnya
                 lagi bernama "Reason" dan isinya ``details_error`` — deskripsi kodenya,
                 bukan kategorinya.

                 Evidence & Reason diambil dari ``trigger_source`` scorecard di sisi QC,
                 satu baris per temuan: backend men-de-dup pada (details_error, reason,
                 evidence), jadi satu kode yang dilanggar di beberapa tempat tampil
                 sebagai beberapa baris dengan evidence-nya masing-masing. -->
            <td class="category">{{ e.error_category || '—' }}</td>
            <td class="evidence">{{ e.evidence || '—' }}</td>
            <td class="reason">{{ e.reason || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'

const props = defineProps({ summary: { type: Object, required: true } })
const errors = computed(() => props.summary?.errors || [])
const campaign = computed(() => props.summary?.campaign || [])

// Isi tabel ini sengaja IDENTIK untuk semua role — tidak ada kolom yang
// dikondisikan per role. Sebelumnya "Lama Bergabung" hanya tampil untuk
// sales_agent/team_leader; sekarang semua role melihat tampilan yang sama.

// "Detail Error" column is hidden for now (kept in the template so it can be
// re-enabled by flipping this flag).
const showDetailError = false

// Inline cell: render the campaign interest as a bullet list (or em dash).
const CampaignCell = (p) =>
  p.campaign && p.campaign.length
    ? h('ul', { class: 'camp' }, p.campaign.map((c) => h('li', null, c)))
    : h('span', null, '—')
CampaignCell.props = ['campaign']
</script>

<style scoped>
.agent-summary {
  background: #fff; border: 1px solid var(--border); border-radius: 12px;
  padding: 16px 18px; margin-bottom: 16px;
}
.as-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }

.table-wrap { overflow-x: auto; }
.as-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.as-table th {
  text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted);
  border-bottom: 2px solid var(--border); white-space: nowrap; background: #fafbfc;
}
.as-table td { padding: 8px 10px; border-bottom: 1px solid #eef1f4; vertical-align: top; }
.as-table tr:last-child td { border-bottom: none; }
.as-table tbody tr:hover td { background: #fafbfc; }

.nowrap { white-space: nowrap; }
.category { min-width: 140px; }
/* Evidence memuat timestamp + kutipan transkrip apa adanya — sering panjang dan
   berisi baris baru, jadi dibiarkan membungkus dan diberi lebar minimum sendiri
   supaya tidak menghimpit kolom Reason di sebelahnya. */
.evidence { min-width: 260px; max-width: 420px; white-space: pre-line; }
.reason { min-width: 260px; }
.ok-cell { color: #16a34a; font-weight: 600; }
.camp { margin: 0; padding-left: 16px; }
.camp li { margin: 1px 0; }
</style>
