<template>
  <!-- Checklist campaign berhierarki: anggota grup (Cashline) menjorok di bawah
       grupnya (Telemarketing) dan ikut tercentang-terkunci saat grupnya dicentang. -->
  <div class="campaign-checks" :class="{ inline }">
    <div v-for="node in tree" :key="node.name" class="node">
      <div class="head">
        <label class="check">
          <input
            type="checkbox"
            :checked="modelValue.includes(node.name)"
            @change="toggle(node.name, $event.target.checked)"
          />
          <span :class="{ group: node.children.length }">{{ node.name }}</span>
        </label>
        <!-- Anggota grup bisa puluhan produk; dilipat supaya satu baris user tetap pendek. -->
        <button
          v-if="node.children.length"
          type="button"
          class="fold"
          @click="toggleOpen(node.name)"
        >{{ opened[node.name] ? '▾' : '▸' }} {{ childSummary(node) }}</button>
      </div>
      <div v-if="node.children.length && opened[node.name]" class="children">
        <label
          v-for="c in node.children"
          :key="c"
          class="check child"
          :title="implied(c) ? `Sudah termasuk ${node.name}` : ''"
        >
          <input
            type="checkbox"
            :checked="implied(c) || modelValue.includes(c)"
            :disabled="implied(c)"
            @change="toggle(c, $event.target.checked)"
          />
          <span>{{ c }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { buildCampaignTree, isImplied, toggleCampaign } from '../utils/campaignTree.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  campaigns: { type: Array, default: () => [] },
  groups: { type: Object, default: () => ({}) },
  // Mengalir menyamping (satu baris user di tab Assign Role tetap pendek).
  inline: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const tree = computed(() => buildCampaignTree(props.campaigns, props.groups))

function implied(name) {
  return isImplied(props.modelValue, name, props.groups)
}

const opened = reactive({})
function toggleOpen(name) {
  opened[name] = !opened[name]
}

// "semua 44 produk" saat grupnya dicentang, "2 / 44 produk" saat sebagian dipilih.
function childSummary(node) {
  const total = node.children.length
  if (props.modelValue.includes(node.name)) return `semua ${total} produk`
  const picked = node.children.filter((c) => props.modelValue.includes(c)).length
  return picked ? `${picked} / ${total} produk` : `${total} produk`
}

function toggle(name, checked) {
  emit('update:modelValue', toggleCampaign(props.modelValue, name, checked, props.groups))
}
</script>

<style scoped>
.campaign-checks {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px 14px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px;
}
.campaign-checks.inline { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0; border: none; }
.node { display: flex; flex-direction: column; gap: 3px; }
.head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fold { background: none; border: none; padding: 0; color: var(--blue); font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.children {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 3px 14px;
  padding-left: 20px; border-left: 2px solid var(--border); margin-left: 6px;
  max-height: 260px; overflow-y: auto; min-width: 220px;
}
.campaign-checks.inline .node:has(.children) { flex-basis: 100%; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; }
.check.child { color: var(--text-muted); }
.check input:disabled + span { font-style: italic; }
.group { font-weight: 700; }
</style>
