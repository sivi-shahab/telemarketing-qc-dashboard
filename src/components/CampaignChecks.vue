<template>
  <!-- Checklist campaign berhierarki: anggota grup (Cashline) menjorok di bawah
       grupnya (Telemarketing) dan ikut tercentang-terkunci saat grupnya dicentang. -->
  <div class="campaign-checks" :class="{ inline }">
    <div v-for="node in tree" :key="node.name" class="node">
      <label class="check">
        <input
          type="checkbox"
          :checked="modelValue.includes(node.name)"
          @change="toggle(node.name, $event.target.checked)"
        />
        <span :class="{ group: node.children.length }">{{ node.name }}</span>
      </label>
      <div v-if="node.children.length" class="children">
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
import { computed } from 'vue'
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
.children { display: flex; flex-direction: column; gap: 3px; padding-left: 20px; border-left: 2px solid var(--border); margin-left: 6px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; }
.check.child { color: var(--text-muted); }
.check input:disabled + span { font-style: italic; }
.group { font-weight: 700; }
</style>
