<template>
  <!-- Key by path so views that SHARE a component across routes (ResultsView serves
       Results / Manual Check / Pending Check) remount on navigation — otherwise the
       component is reused, route.meta mode flags stay stale, and the list never
       re-fetches. Keyed on path (not fullPath) so in-component filters/pagination,
       which live in state rather than the URL, don't trigger spurious remounts. -->
  <RouterView :key="$route.path" />
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth.js'

const $route = useRoute()
const auth = useAuthStore()

// Capability disimpan bersama profil di localStorage supaya guard router bisa
// memutuskan tanpa menunggu jaringan. Konsekuensinya data itu bisa basi setelah
// permission role diubah lewat Manage Role — jadi diperbarui sekali tiap aplikasi
// dimuat. Sesi lama yang login sebelum /auth/me mengirim capability juga terisi
// di sini, tanpa perlu login ulang.
onMounted(() => {
  auth.reloadMe().catch(() => {})
})
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #FAFBFC;
  color: #1E1F21;
  font-size: 14px;
}

:root {
  /* --- App semantic tokens (remapped to Bank Mega palette) --- */
  /* Primary/accent keeps the --blue name for backward-compat, now Bank Mega orange. */
  --blue: #F37022;
  --blue-deep: #D85C12;
  --blue-bg: #FDE7D7;
  --green: #1F8A4C;
  --green-bg: #E2F2E8;
  --yellow: #C98A00;
  --yellow-bg: #FBF0D2;
  --red: #C73838;
  --red-bg: #FBE4E4;
  --gray: #9E9FA3;
  --border: #E4E5E8;
  --text: #1E1F21;
  /* 28 Agustus 2026 — permintaan bisnis: SEMUA tulisan hitam, tidak ada teks
     abu-abu. Token ini dipakai ~220 kali sebagai warna teks sekunder (label,
     caption, hint), jadi cukup diarahkan ulang di sini alih-alih menyisir tiap
     berkas. Nama tokennya sengaja tidak diubah supaya diff-nya kecil.
     Nilai lamanya: #818489. */
  --text-muted: #1E1F21;
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 64px;

  /* --- Bank Mega brand tokens --- */
  --mega-gold: #F2B600;
  --mega-gold-deep: #D99E00;
  --mega-orange: #F37022;
  --mega-orange-deep: #D85C12;
  --mega-gray-600: #636466;
  --mega-gradient: linear-gradient(120deg, #F2B600 0%, #F37022 100%);
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
}

a { text-decoration: none; color: inherit; }
button { font-family: inherit; cursor: pointer; }
input, select { font-family: inherit; }
</style>
