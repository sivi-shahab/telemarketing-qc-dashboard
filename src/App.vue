<template>
  <!-- Key by path so views that SHARE a component across routes (ResultsView serves
       Results / Manual Check / Pending Check) remount on navigation — otherwise the
       component is reused, route.meta mode flags stay stale, and the list never
       re-fetches. Keyed on path (not fullPath) so in-component filters/pagination,
       which live in state rather than the URL, don't trigger spurious remounts. -->
  <RouterView :key="$route.path" />
</template>

<script setup>
import { useRoute } from 'vue-router'
const $route = useRoute()
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
  --text-muted: #818489;
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
