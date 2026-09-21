<template>
  <span v-if="info" :class="['sla-badge', info.cls]" :title="info.title">{{ info.text }}</span>
  <span v-else>—</span>
</template>

<script setup>
// Pending Check "Sisa Waktu (H+2)" cell, dipisah dari ResultsView.vue (17 September
// 2026, improvement.md item 5.2). Sebelumnya `nowTs` adalah satu ref di komponen
// induk yang dibaca oleh SETIAP baris lewat `slaInfo(item)`, sehingga tiap
// tick 30 detik menandai seluruh ResultsView reaktif dan memaksa fungsi render-nya
// (2000+ baris template) jalan ulang untuk memperbarui satu kolom kecil ini saja.
// Sekarang tiap baris Pending Check punya timer-nya sendiri, jadi tick 30 detik
// hanya menyentuh instance <SlaCountdown> row itu.
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({ item: { type: Object, required: true } })

const SLA_HOURS = 48 // "H+2" = 2 hari setelah submit_time (cashline TMS)
const nowTs = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { nowTs.value = Date.now() }, 30000) })
onUnmounted(() => clearInterval(timer))

// Parse a TMS submit_time ("2026-06-17 15:24:53", naive WIB) into an epoch ms.
function parseSubmitWib(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return NaN
  const [, Y, Mo, D, H, Mi, S] = m
  return Date.parse(`${Y}-${Mo}-${D}T${H}:${Mi}:${S || '00'}+07:00`)
}

const info = computed(() => {
  const item = props.item
  // Tenggat H+2 hanya berarti untuk tiket yang memang MENUNGGU DOKUMEN. Sejak menu
  // Pending Check menyaring "AI Status = Pending" (3 September 2026), daftarnya juga
  // memuat tiket yang Pending karena kekurangan data acuan (Transkrip/TMS/Agent/
  // Ascend kosong) — di sana tidak ada berkas yang ditunggu, jadi hitung mundur H+2
  // hanya akan menyesatkan. Tampilkan "—" untuk tiket seperti itu.
  if (!item.missing_documents) return null
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
})
</script>

<style scoped>
/* Pending Check SLA timer (H+2). ok = comfortable, warn = <12h left, over = past deadline. */
.sla-badge {
  display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px;
  border-radius: 999px; white-space: nowrap;
}
.sla-badge.ok { background: #dcfce7; color: #15803d; }
.sla-badge.warn { background: #fef3c7; color: #b45309; }
.sla-badge.over { background: #fee2e2; color: #b91c1c; }
</style>
