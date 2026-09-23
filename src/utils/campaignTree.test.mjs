import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCampaignTree, toggleCampaign, isImplied, splitEffective } from './campaignTree.js'

const GROUPS = { Telemarketing: ['Cashline'] }
const ALL = ['Telemarketing', 'Cashline', 'Collection']

test('Cashline tampil di bawah Telemarketing, Collection berdiri sendiri', () => {
  assert.deepEqual(buildCampaignTree(ALL, GROUPS), [
    { name: 'Telemarketing', children: ['Cashline'] },
    { name: 'Collection', children: [] },
  ])
})

test('tanpa info grup semua campaign tampil setara (API lama)', () => {
  assert.deepEqual(buildCampaignTree(['Cashline', 'Collection'], {}), [
    { name: 'Cashline', children: [] },
    { name: 'Collection', children: [] },
  ])
})

test('mencentang Telemarketing membuang anggotanya dari pilihan', () => {
  assert.deepEqual(toggleCampaign(['Cashline', 'Collection'], 'Telemarketing', true, GROUPS),
    ['Collection', 'Telemarketing'])
})

test('membuka centang Telemarketing tidak menyisakan anggota', () => {
  assert.deepEqual(toggleCampaign(['Telemarketing'], 'Telemarketing', false, GROUPS), [])
})

test('Cashline boleh dicentang sendiri (dipersempit ke satu produk)', () => {
  assert.deepEqual(toggleCampaign([], 'Cashline', true, GROUPS), ['Cashline'])
})

test('anggota tersirat bila grupnya dicentang', () => {
  assert.equal(isImplied(['Telemarketing'], 'Cashline', GROUPS), true)
  assert.equal(isImplied([], 'Cashline', GROUPS), false)
  assert.equal(isImplied(['Telemarketing'], 'Collection', GROUPS), false)
})

test('campaign efektif dipisah: grup beserta anggota yang tercakup', () => {
  assert.deepEqual(splitEffective(['Telemarketing', 'Cashline'], GROUPS), [
    { name: 'Telemarketing', includes: ['Cashline'] },
  ])
  assert.deepEqual(splitEffective(['Cashline', 'Collection'], GROUPS), [
    { name: 'Cashline', includes: [] },
    { name: 'Collection', includes: [] },
  ])
})
