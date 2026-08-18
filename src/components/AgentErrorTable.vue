<template>
  <div class="agent-summary">
    <div class="as-title">Agent Error Summary</div>
    <div class="table-wrap">
      <table class="as-table">
        <thead>
          <tr>
            <th>Agent ID</th>
            <th>Agent Name</th>
            <th>Lama Bergabung</th>
            <th>Campaign</th>
            <th>Tanggal</th>
            <th v-if="showDetailError">Detail Error</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!errors.length">
            <td>{{ summary.agent_id || '—' }}</td>
            <td>{{ summary.agent_name || '—' }}</td>
            <td class="nowrap">{{ summary.durasi_bergabung || '—' }}</td>
            <td><CampaignCell :campaign="campaign" /></td>
            <td class="nowrap">{{ summary.tanggal || '—' }}</td>
            <td :colspan="showDetailError ? 2 : 1" class="ok-cell">✓ Tidak ada error</td>
          </tr>
          <tr v-for="(e, i) in errors" :key="i">
            <td v-if="i === 0" :rowspan="errors.length">{{ summary.agent_id || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length">{{ summary.agent_name || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length" class="nowrap">{{ summary.durasi_bergabung || '—' }}</td>
            <td v-if="i === 0" :rowspan="errors.length"><CampaignCell :campaign="campaign" /></td>
            <td v-if="i === 0" :rowspan="errors.length" class="nowrap">{{ summary.tanggal || '—' }}</td>
            <td v-if="showDetailError">{{ e.details_error || '—' }}</td>
            <!-- "Reason" menampilkan Details Error dari tabel Error Code (deskripsi
                 kode; ikut ter-relabel saat banding "Ubah Error Code" di-approve). -->
            <td class="reason">{{ e.details_error || '—' }}</td>
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
.reason { min-width: 260px; }
.ok-cell { color: #16a34a; font-weight: 600; }
.camp { margin: 0; padding-left: 16px; }
.camp li { margin: 1px 0; }
</style>
