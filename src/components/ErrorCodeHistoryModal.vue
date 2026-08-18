<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">Riwayat Manual Check</h2>
            <p class="modal-subtitle">
              Semua banding Error Code pada tiket ini — siapa, kapan, dan alasannya.
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="displayId" class="id-row">
            <span class="id-label">ID</span><code class="id-value">{{ displayId }}</code>
          </div>

          <div v-if="!groups.length" class="empty">Belum ada banding pada tiket ini.</div>

          <!-- Dikelompokkan per baris error code: satu item_code bisa dibanding
               berkali-kali (tabelnya append-only), jadi urutannya lebih terbaca
               bila dipisah per baris ketimbang satu daftar panjang. -->
          <div v-for="g in groups" :key="g.key" class="grp">
            <div class="grp-head">
              <span class="badge">{{ g.error_code }}</span>
              <span class="grp-item">{{ g.item_code }}</span>
              <span class="grp-count">{{ g.events.length }} kejadian</span>
            </div>
            <ul class="tl">
              <li v-for="(e, i) in g.events" :key="i" class="tl-item">
                <span :class="['tl-dot', dotClass(e.action)]"></span>
                <div class="tl-body">
                  <div class="tl-line">
                    <strong>{{ e.action }}</strong>
                    <span class="tl-who">{{ e.role }}<template v-if="e.who"> ({{ e.who }})</template></span>
                    <span class="tl-time">{{ fmtTs(e.at) }}</span>
                  </div>
                  <div v-if="e.note" class="tl-note">“{{ e.note }}”</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <footer class="modal-foot">
          <button class="btn-cancel" @click="close">Tutup</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { appealTimeline } from '../utils/appealTimeline.js'

const props = defineProps({
  history: { type: Array, default: () => [] },
  displayId: { type: String, default: null },
})
const emit = defineEmits(['close'])

const groups = computed(() => {
  const by = new Map()
  for (const h of props.history || []) {
    const key = `${h.error_code}|${h.item_code}`
    if (!by.has(key)) by.set(key, { key, error_code: h.error_code, item_code: h.item_code, rows: [] })
    by.get(key).rows.push(h)
  }
  return [...by.values()].map((g) => ({ ...g, events: appealTimeline(g.rows) }))
})

function dotClass(action) {
  const a = String(action || '').toLowerCase()
  if (a.includes('tolak') || a.includes('reject')) return 'dot-bad'
  if (a.includes('terima') || a.includes('approved') || a.includes('langsung')) return 'dot-ok'
  return 'dot-neutral'
}
function fmtTs(iso) {
  if (!iso) return '—'
  // Backend menyimpan naive UTC; baca sebagai UTC lalu tampilkan dalam WIB.
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}
function close() { emit('close') }
function onKey(e) { if (e.key === 'Escape') close() }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
}
.modal-card {
  background: var(--surface, #fff); border-radius: 12px; width: min(680px, 100%);
  max-height: 85vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}
.modal-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 18px 20px 12px; border-bottom: 1px solid var(--border, #e5e7eb);
}
.modal-title { margin: 0; font-size: 16px; font-weight: 700; }
.modal-subtitle { margin: 4px 0 0; font-size: 12px; color: var(--text-muted, #6b7280); }
.close-x { background: none; border: none; font-size: 16px; cursor: pointer; color: var(--text-muted, #6b7280); line-height: 1; }
.modal-body { padding: 12px 20px 16px; overflow: auto; }
.id-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.id-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted, #6b7280); }
.id-value { font-size: 12px; }
.empty { font-size: 12.5px; color: var(--text-muted, #6b7280); }
.grp { margin-bottom: 14px; }
.grp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.badge { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #fee2e2; color: #991b1b; }
.grp-item { font-size: 12px; font-weight: 700; }
.grp-count { margin-left: auto; font-size: 11px; color: var(--text-muted, #6b7280); }
.tl { list-style: none; margin: 0; padding: 0 0 0 2px; }
.tl-item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border, #e5e7eb); }
.tl-item:last-child { border-bottom: none; }
.tl-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: 0 0 8px; }
.dot-ok { background: #16a34a; } .dot-bad { background: #dc2626; } .dot-neutral { background: #9ca3af; }
.tl-body { flex: 1; min-width: 0; }
.tl-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; }
.tl-who { color: var(--text-muted, #6b7280); }
.tl-time { margin-left: auto; font-size: 11px; color: var(--text-muted, #6b7280); white-space: nowrap; }
.tl-note { margin-top: 2px; font-size: 11.5px; color: var(--text-muted, #6b7280); font-style: italic; }
.modal-foot { display: flex; justify-content: flex-end; padding: 12px 20px 16px; border-top: 1px solid var(--border, #e5e7eb); }
.btn-cancel { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #e5e7eb); background: transparent; cursor: pointer; font-size: 13px; }
</style>
