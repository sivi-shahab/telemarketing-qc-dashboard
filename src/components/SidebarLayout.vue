<template>
  <div class="layout">
    <SidebarMenu />
    <div class="main">
      <header class="topbar">
        <h1 class="page-title">{{ title }}</h1>
        <AccountPanel />
      </header>
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import SidebarMenu from './SidebarMenu.vue'
import AccountPanel from './AccountPanel.vue'

defineProps({
  title: { type: String, default: '' },
})
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: #fff;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.page-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}

.content {
  padding: 24px 28px;
  flex: 1;
}
</style>
