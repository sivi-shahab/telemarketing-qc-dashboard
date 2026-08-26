<template>
  <SidebarLayout title="Halaman Tidak Ditemukan">
    <div class="notfound-card">
      <div class="code">404</div>
      <h2 class="headline">Halaman tidak ditemukan</h2>
      <p class="lede">
        Alamat <code class="path">{{ attemptedPath }}</code> tidak terdaftar di aplikasi ini.
        Kemungkinan URL salah ketik, atau halaman sudah dipindahkan.
      </p>
      <div class="actions">
        <RouterLink to="/" class="btn-primary">Kembali ke Beranda</RouterLink>
        <button type="button" class="btn-ghost" @click="goBack">Halaman Sebelumnya</button>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SidebarLayout from '../components/SidebarLayout.vue'

const route = useRoute()
const router = useRouter()

const attemptedPath = computed(() => route.fullPath)

function goBack() {
  // window.history.state.back null saat tab dibuka langsung ke URL ini.
  if (window.history.state?.back) router.back()
  else router.replace('/')
}
</script>

<style scoped>
.notfound-card {
  max-width: 560px;
  margin: 48px auto;
  padding: 40px 32px;
  text-align: center;
  background: var(--m-bg-surface);
  border: 1px solid var(--m-border-1);
  border-radius: var(--m-r-lg);
  box-shadow: var(--m-shadow-card);
}

.code {
  font-family: var(--m-font-mono);
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  background: var(--mega-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.headline {
  margin: 16px 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--m-fg-1);
}

.lede {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--m-fg-2);
}

.path {
  padding: 2px 6px;
  font-family: var(--m-font-mono);
  font-size: 13px;
  color: var(--m-fg-1);
  background: var(--m-bg-sunken);
  border-radius: var(--m-r-sm);
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.btn-primary,
.btn-ghost {
  padding: 10px 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--m-r-pill);
  cursor: pointer;
  text-decoration: none;
}

.btn-primary {
  color: #fff;
  background: var(--mega-gradient);
  border: none;
  box-shadow: var(--m-shadow-sm);
}

.btn-ghost {
  color: var(--m-fg-1);
  background: var(--m-bg-surface);
  border: 1px solid var(--m-border-2);
}

.btn-primary:hover { filter: brightness(1.05); }
.btn-ghost:hover { background: var(--m-bg-sunken); }
</style>
