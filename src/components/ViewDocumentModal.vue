<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">View Document</h2>
            <!-- Subjudul mengikuti apa yang BENAR-BENAR didapat role ini: tabel
                 perbandingan OCR hanya untuk divisi QC, jadi menjanjikannya ke
                 semua orang membuat modal terlihat seperti gagal memuat. -->
            <p class="modal-subtitle">
              Dokumen pendukung yang sudah diunggah untuk tiket ini<template
                v-if="canViewVerification">, beserta hasil OCR &amp; verifikasinya</template>.
            </p>
          </div>
          <button class="close-x" aria-label="Tutup" @click="close">✕</button>
        </header>

        <div class="modal-body">
          <div v-if="docId" class="id-row">
            <span class="id-label">ID</span>
            <code class="id-value">{{ docId }}</code>
          </div>
          <div class="id-row">
            <span class="id-label">Result ID</span>
            <code class="id-value">{{ resultId }}</code>
          </div>

          <!-- DocumentsSection memuat sendiri daftar dokumen dari /documents/{result_id}
               dan menampilkan "kosong" bila tidak ada apa-apa. -->
          <DocumentsSection :result-id="resultId" :evaluation="evaluation" show-empty />
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
import DocumentsSection from './DocumentsSection.vue'
import { useAuthStore } from '../stores/auth.js'
import { P } from '../permissions.js'

const auth = useAuthStore()
const canViewVerification = computed(() => auth.can(P.DOCUMENT_VERIFICATION_TABLE))

defineProps({
  resultId: { type: String, required: true },
  docId: { type: String, default: null },
  // Evaluasi tiket (opsional) — dipakai DocumentsSection untuk kolom "Transkrip"
  // pada tabel verifikasi dokumen.
  evaluation: { type: Object, default: null },
})
const emit = defineEmits(['close'])

function close() {
  emit('close')
}

function onKey(e) {
  if (e.key === 'Escape') close()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
}
.modal-card {
  background: var(--surface, #fff); border-radius: 12px; width: min(1100px, 100%);
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}
.modal-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 18px 20px 12px; border-bottom: 1px solid var(--border, #e5e7eb);
}
.modal-title { margin: 0; font-size: 16px; font-weight: 700; }
.modal-subtitle { margin: 4px 0 0; font-size: 12px; color: var(--text-muted, #6b7280); }
.close-x {
  background: none; border: none; font-size: 16px; cursor: pointer;
  color: var(--text-muted, #6b7280); line-height: 1;
}
.modal-body { padding: 16px 20px; overflow: auto; }
.id-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.id-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--text-muted, #6b7280);
}
.id-value { font-size: 12px; }
.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 20px 16px; border-top: 1px solid var(--border, #e5e7eb);
}
.btn-cancel {
  padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #e5e7eb);
  background: transparent; cursor: pointer; font-size: 13px;
}
</style>
