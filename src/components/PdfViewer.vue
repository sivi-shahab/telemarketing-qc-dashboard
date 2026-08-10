<template>
  <div class="pdf-block">
    <div class="pdf-head" @click.stop="toggle">
      <span class="pdf-name">{{ filename }}</span>
      <span class="pdf-toggle">{{ open ? '▲' : '▼' }}</span>
    </div>
    <div v-if="open" class="pdf-body">
      <!-- Native browser PDF viewer via a direct authenticated URL (token in query,
           since <iframe> can't send an Authorization header). The endpoint's
           Content-Disposition carries the real filename, so the viewer shows it
           (not "untitled") and text stays selectable / ctrl+F works. -->
      <iframe :src="pdfUrl" class="pdf-frame" title="Transkrip PDF"></iframe>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'

const props = defineProps({ resultId: String, filename: String })

const open = ref(false)
function toggle() { open.value = !open.value }

const pdfUrl = computed(() => {
  const base = apiClient.defaults.baseURL || ''
  const token = localStorage.getItem('access_token') || ''
  return `${base}/transcript_pdf/${props.resultId}`
    + `?filename=${encodeURIComponent(props.filename)}&token=${encodeURIComponent(token)}`
})
</script>

<style scoped>
.pdf-block { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; margin-top: 8px; }
.pdf-head { padding: 10px 14px; cursor: pointer; font-size: 13px; transition: background 0.15s; }
.pdf-head:hover { background: #f1f5f9; }
.pdf-name { font-family: monospace; color: var(--blue); word-break: break-all; }
.pdf-toggle { font-size: 12px; font-weight: 600; color: var(--text-muted); }

.pdf-body { border-top: 1px solid var(--border); background: #525659; }
.pdf-frame { display: block; width: 100%; height: 80vh; border: 0; background: #525659; }
</style>
