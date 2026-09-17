<template>
  <svg class="col-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(d, i) in PATHS[name] || []" :key="i" :d="d" />
  </svg>
</template>

<script setup>
// Subset ikon lucide yang dipakai WeightedAuditView.tsx, sebagai path SVG
// inline — dashboard ini tidak memakai lucide, jadi tidak menambah dependensi.
defineProps({ name: { type: String, required: true } })
const PATHS = {
  check: ['M21.8 10A10 10 0 1 1 17 3.3', 'm9 11 3 3L22 4'],
  x: ['M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20', 'm15 9-6 6', 'm9 9 6 6'],
  minus: ['M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20', 'M8 12h8'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'M12 8v4', 'M12 16h.01'],
  scale: ['m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'],
  file: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M10 9H8', 'M16 13H8', 'M16 17H8'],
  briefcase: ['M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16', 'M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
  octagon: ['M12 16h.01', 'M12 8v4', 'M15.31 2a2 2 0 0 1 1.42.59l4.68 4.68A2 2 0 0 1 22 8.69v6.62a2 2 0 0 1-.59 1.42l-4.68 4.68a2 2 0 0 1-1.42.59H8.69a2 2 0 0 1-1.42-.59l-4.68-4.68A2 2 0 0 1 2 15.31V8.69a2 2 0 0 1 .59-1.42l4.68-4.68A2 2 0 0 1 8.69 2z'],
  award: ['m15.48 12.89 1.51 8.53a.5.5 0 0 1-.81.47l-3.58-2.69a1 1 0 0 0-1.2 0l-3.59 2.69a.5.5 0 0 1-.81-.47l1.51-8.53', 'M12 2a6 6 0 1 0 0 12 6 6 0 1 0 0-12'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20', 'M12 16v-4', 'M12 8h.01'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 1 0 0-16', 'm21 21-4.3-4.3'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronUp: ['m18 15-6-6-6 6'],
}
</script>

<style scoped>
.col-icon { width: 20px; height: 20px; flex-shrink: 0; }
</style>
