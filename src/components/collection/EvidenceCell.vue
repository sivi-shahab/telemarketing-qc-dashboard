<template>
  <div v-if="evidence && (evidence.quote || evidence.timestamp)" class="ev">
    <span v-if="evidence.timestamp" class="ev-ts">{{ evidence.timestamp }}</span>
    <span v-if="evidence.quote" class="ev-quote">"{{ evidence.quote }}"</span>
  </div>
  <span v-else class="ev-empty">—</span>
</template>

<script setup>
// Bukti verbatim { timestamp, quote } — tampilannya mengikuti komponen Evidence
// di EvaluationView.vue (Cashline): timestamp biru monospace di atas kutipan.
defineProps({ evidence: { type: Object, default: null } })
</script>
