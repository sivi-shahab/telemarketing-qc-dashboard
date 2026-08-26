<template>
  <div class="badword-summary">
    <div class="bw-title">Badword Summary</div>
    <div class="table-wrap">
      <table class="bw-table">
        <thead>
          <tr>
            <th class="col-ticket">Ticket ID</th>
            <th class="col-evidence">Evidence</th>
            <th class="col-reason">Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!badwords.length">
            <td colspan="3" class="ok-cell">✓ Tidak ada badword</td>
          </tr>
          <tr v-for="(b, i) in badwords" :key="i">
            <td class="ticket">{{ b.ticket_id || '—' }}</td>
            <td class="evidence">
              <!-- Evidence = timestamp + kutipan persis dari transkrip; keduanya
                   ditampilkan terpisah supaya QC bisa langsung meloncat ke menit itu. -->
              <div v-if="b.timestamp" class="ev-ts">{{ b.timestamp }}</div>
              <div class="ev-quote">“{{ b.quote }}”</div>
            </td>
            <td class="reason">{{ b.reason || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Badword = ucapan agent bersentimen negatif kepada nasabah (bukan hanya kata kasar
// baku) — dideteksi LLM dan dibaca apa adanya dari /agent_error_summary. Satu temuan
// saja sudah membuat AI Status tiket ini Not Qualified ("Terindikasi Badword"),
// aturan yang ditegakkan di backend, bukan di sini.
const props = defineProps({ summary: { type: Object, required: true } })
const badwords = computed(() => props.summary?.badwords || [])
</script>

<style scoped>
.badword-summary {
  background: #fff; border: 1px solid var(--border); border-radius: 12px;
  padding: 16px 18px; margin-bottom: 16px;
}
.bw-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }

.table-wrap { overflow-x: auto; }
.bw-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bw-table th {
  text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted);
  border-bottom: 2px solid var(--border); white-space: nowrap; background: #fafbfc;
}
.bw-table td { padding: 8px 10px; border-bottom: 1px solid #eef1f4; vertical-align: top; }
.bw-table tr:last-child td { border-bottom: none; }
.bw-table tbody tr:hover td { background: #fafbfc; }

.col-ticket { width: 22%; }
.col-evidence { width: 46%; }
.col-reason { width: 32%; }
.ticket { white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.ev-ts { font-size: 11px; color: var(--text-muted); white-space: nowrap; margin-bottom: 2px; }
.ev-quote { color: #b91c1c; }
.reason { min-width: 220px; }
.ok-cell { color: #16a34a; font-weight: 600; }
</style>
