<template>
  <SidebarLayout title="Builder Scorecard &amp; KB">
    <div class="bld">
      <transition name="toast"><div v-if="toast" class="toast">&#10003; {{ toast }}</div></transition>
      <!-- ================= halaman awal: buat draf / daftar draf ================= -->
      <template v-if="!draft">
        <div class="card">
          <h2 class="card-title">Buat scorecard &amp; KB dari script</h2>
          <p class="hint">Unggah script Bank Mega. AI menyusun draf poin penilaian; Anda meninjau lalu mengunduh hasilnya.</p>
          <div v-if="!creating">
            <div class="field" style="max-width: 520px"><label>Nama campaign <span class="req">*</span></label>
              <input v-model="form.name" class="inp" placeholder="Contoh: Reinstate2" /></div>
            <div class="field" style="margin-top: 12px"><label>File script (.xlsx) <span class="req">*</span></label>
              <label class="drop" :class="{ has: form.script }">
                <input ref="scriptInput" type="file" accept=".xlsx,.xlsm" @change="e => (form.script = e.target.files[0] || null)" />
                <span v-if="form.script"><b>{{ form.script.name }}</b> &middot; klik untuk mengganti</span>
                <span v-else>Klik untuk memilih file script (.xlsx)</span>
              </label></div>
            <details class="det" style="margin-top: 10px">
              <summary>Pengaturan lanjutan</summary>
              <div class="field" style="max-width: 360px; margin-top: 6px"><label>Awalan kode poin <span class="opt">(opsional)</span></label>
                <input v-model="form.prefix" class="inp" placeholder="Contoh: RI2 (jadi SC_RI2_1)" /></div>
            </details>
          </div>

          <ul v-if="creating" class="cstages">
            <li v-for="(s, n) in createStages" :key="s" :class="stageState(n)">
              <span class="cmark"><span v-if="stageState(n) === 'run'" class="spin"></span><template v-else-if="stageState(n) === 'done'">&#10003;</template><template v-else-if="stageState(n) === 'fail'">&#10007;</template></span>
              {{ s }}<template v-if="n === 4 && stageNo === 4 && createDetail">: {{ createDetail }}</template>
            </li>
          </ul>
          <p v-if="creating && busy" class="hint">Ini bisa memakan beberapa menit, jangan tutup halaman.</p>
          <p v-if="creating && !busy && stageFail" class="warnmsg">Proses terhenti. Draf sudah tersimpan, buka draf lalu tekan Lanjutkan.</p>

          <div v-if="error" class="err">{{ error }}
            <details v-if="errorRaw" class="raw"><summary>detail teknis</summary><pre>{{ errorRaw }}</pre></details></div>
          <div class="row">
            <button class="btn primary" :disabled="!form.name.trim() || !form.script || busy" @click="createDraft">
              <span v-if="busy" class="spin"></span>{{ busy ? 'Memproses...' : 'Buat draf' }}
            </button>
            <button v-if="creating && !busy" class="btn" @click="creating = false; stageFail = false; error = ''; errorRaw = ''">Tutup</button>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Draf tersimpan</h2>
          <div v-if="!drafts.length" class="hint">Belum ada draf.</div>
          <table v-else class="tbl">
            <thead><tr><th>Nama</th><th>Jumlah poin</th><th>Terakhir diubah</th><th></th></tr></thead>
            <tbody>
              <tr v-for="d in drafts" :key="d.id">
                <td><strong>{{ d.name }}</strong><div class="hint">{{ d.script_filename }}</div></td>
                <td>{{ d.items }}</td><td>{{ fmt(d.updated_at) }}</td>
                <td class="act"><button class="btn sm primary" @click="openDraft(d.id)">Buka</button>
                  <button class="btn sm danger" @click="removeDraft(d)">Hapus draf</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ================= draf terbuka ================= -->
      <template v-else>
        <div class="topline">
          <button class="btn sm" @click="closeDraft">&larr; Semua draf</button>
          <h2 class="dname">{{ draft.name }}</h2>
        </div>
        <div class="steps">
          <button v-for="(s, n) in steps" :key="s" class="step" :class="{ on: step === n, done: stepDone(n) }" @click="goStep(n)">
            <span class="snum">{{ stepDone(n) ? '&#10003;' : n + 1 }}</span>
            <span>{{ s }}<small v-if="n === 1 && draft.items.length"> &middot; {{ cnt.decided }}/{{ draft.items.length }}</small></span>
          </button>
        </div>
        <div v-if="error" class="err">{{ error }}
          <details v-if="errorRaw" class="raw"><summary>detail teknis</summary><pre>{{ errorRaw }}</pre></details></div>
        <div v-if="busy" class="busy"><span class="spin"></span>{{ progress || 'Memproses...' }}</div>

        <!-- ---------- 1. Periksa script ---------- -->
        <template v-if="step === 0">
          <div class="card">
            <h2 class="card-title">Ringkasan campaign</h2>
            <p class="hint">Ini hanya informasi, tidak mengubah penilaian.</p>
            <div v-if="!draft.modules" class="hint">Belum ada ringkasan.</div>
            <ul v-else class="info-list">
              <li v-for="(m, k) in draft.modules" :key="k" :class="{ none: !m.ada }">
                <span class="tick" :class="m.ada ? 'y' : 'n'">{{ m.ada ? '&#10003;' : '&#10007;' }}</span>
                {{ (moduleLabel[k] || [k, k])[m.ada ? 0 : 1] }}
                <div v-if="m.bukti" class="hint quote">&ldquo;{{ unquote(m.bukti) }}&rdquo;</div>
                <div v-if="m.ada && !m.bukti_terverifikasi" class="hint warn-t">&#9888; kutipan tidak ditemukan persis di script, mohon cek</div>
              </li>
            </ul>
          </div>

          <div class="card">
            <h2 class="card-title">Isi script</h2>
            <div v-if="draft.script.temuan.length" class="note warn-n">
              Ada {{ draft.script.temuan.length }} bagian script yang tidak terbaca rapi
              <a href="#" @click.prevent="showTemuan = !showTemuan">{{ showTemuan ? 'sembunyikan' : 'lihat' }}</a>
              <div v-if="showTemuan"><div v-for="(t, i) in draft.script.temuan" :key="i" class="hint">{{ t }}</div></div>
            </div>
            <div class="tbl-scroll">
              <table class="tbl blk">
                <thead><tr><th>Baris Excel</th><th>Bagian</th><th>Isi script</th><th>Catatan</th></tr></thead>
                <tbody>
                  <template v-for="r in scriptRows" :key="r.key">
                    <tr v-if="r.sep" class="phase"><td colspan="4">{{ r.fase || '(tanpa fase)' }}</td></tr>
                    <tr v-else>
                      <td class="nowrap"><b>{{ r.b.row }}</b></td>
                      <td class="prewrap">{{ r.b.bagian }}</td>
                      <td class="prewrap">{{ r.b.script }}
                        <div v-for="(g, n) in (r.b.gambar || [])" :key="n" class="imgbox">
                          <div class="hint"><b>Isi gambar</b></div>
                          <pre v-if="g.transkrip" class="imgtxt">{{ g.transkrip }}</pre>
                          <div v-else class="hint">Gambar belum terbaca
                            <button class="btn sm" :disabled="busy" @click="runTranscribe">Baca ulang gambar</button></div>
                        </div>
                      </td>
                      <td class="prewrap">
                        <div v-if="r.b.syarat"><span class="hint">Syarat:</span> {{ r.b.syarat }}</div>
                        <div v-if="r.b.keterangan"><span class="hint">Keterangan:</span> {{ r.b.keterangan }}</div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <div class="row">
              <button class="btn primary" @click="goStep(1)">Lanjut: tinjau poin penilaian &rarr;</button>
              <button class="btn" :disabled="busy" @click="runTranscribe()">Baca ulang semua gambar</button>
              <button class="btn" :disabled="busy" @click="runModules()">Cari ulang informasi campaign</button>
            </div>
          </div>
        </template>

        <!-- ---------- 2. Tinjau poin penilaian ---------- -->
        <div v-if="step === 1" class="items-wrap" :class="{ withLib: libOpen && viewMode === 'kartu' }">
          <div class="items-main">
            <div v-if="!draft.items.length" class="banner">
              Poin penilaian belum dibuat.
              <button class="btn sm primary" :disabled="busy" @click="continueAll">Buat sekarang</button>
            </div>
            <div v-else-if="cnt.belum" class="banner">
              <b>{{ cnt.belum }} poin belum terisi</b> karena proses AI terhenti.
              <button class="btn sm primary" :disabled="busy" @click="continueAll">Lanjutkan</button>
            </div>

            <div v-if="draft.items.length" class="toolbar">
              <div class="prog">
                <span><b>{{ cnt.decided }} dari {{ draft.items.length }}</b> poin sudah diputuskan</span>
                <div class="bar"><i :style="{ width: pct(cnt.decided, draft.items.length) + '%' }"></i></div>
              </div>
              <div class="tabs">
                <button v-for="t in tabList" :key="t.key" class="tab" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
              </div>
              <div class="row">
                <div class="seg">
                  <button :class="{ on: viewMode === 'tabel' }" @click="setView('tabel')">Tabel KB</button>
                  <button :class="{ on: viewMode === 'kartu' }" @click="setView('kartu')">Kartu</button>
                </div>
                <input v-model="query" class="inp sm" placeholder="Cari poin atau kalimat..." style="min-width: 220px; flex: 1" />
                <button class="btn sm" :disabled="busy || !safeCount" :title="safeHelp" @click="acceptSafe">Setujui semua yang aman ({{ safeCount }})</button>
                <button class="btn sm" :disabled="busy || !draft.items.length" title="Nomori ulang #1, #2, ... sesuai urutan di layar" @click="renumberItems">Nomori ulang</button>
                <button v-if="viewMode === 'kartu'" class="btn sm" @click="libOpen = !libOpen">{{ libOpen ? 'Tutup campaign lain' : 'Ambil dari campaign lain' }}</button>
              </div>
              <div class="hint">{{ safeHelp }}</div>
            </div>

            <div v-if="draft.items.length && viewMode === 'kartu' && !groups.length" class="card tight hint">
              {{ query.trim() ? 'Tidak ada poin yang cocok dengan pencarian.' : tab === 'cek' ? 'Tidak ada poin yang perlu dicek. Semua sudah diputuskan.' : 'Tidak ada poin di tab ini.' }}
            </div>

            <div v-if="draft.items.length && viewMode === 'tabel' && tableRows.length" class="card tight">
              <div class="row">
                <span class="hint">{{ tableRows.length }} dari {{ draft.items.length }} poin</span>
                <span class="spacer"></span>
                <button class="btn sm" @click="exportCsv">Unduh CSV</button>
                <button class="btn sm" @click="toggleAllRows">{{ allOpen ? 'Ciutkan semua' : 'Perluas semua' }}</button>
              </div>
              <div class="tbl-scroll">
                <table class="tbl kbtbl">
                  <thead><tr><th></th><th>#</th><th>Kategori</th><th>Poin penilaian</th><th>Bobot</th><th>Contoh kalimat</th>
                    <th>Cara menilai</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    <template v-for="i in tableRows" :key="i.item_code">
                      <tr :class="['s-' + statusOf(i), { rowopen: tableOpen[i.item_code] }]">
                        <td class="tg" @click="tableOpen[i.item_code] = !tableOpen[i.item_code]">{{ tableOpen[i.item_code] ? '▾' : '▸' }}</td>
                        <td class="nowrap codecell">{{ shortCode(i) }}</td>
                        <td class="cat">{{ i.category }}</td>
                        <td class="wreq">{{ i.requirement }}</td>
                        <td class="nowrap">{{ i.weight }}<div v-if="i.tolerable === 'YES'" class="hint">boleh ditoleransi</div></td>
                        <td class="wphr">
                          <template v-if="i.kb && activePhrases(i).length">
                            <div class="ptrunc">{{ activePhrases(i)[0].text }}</div>
                            <div v-if="activePhrases(i).length > 1" class="hint">+{{ activePhrases(i).length - 1 }} lagi</div>
                          </template>
                          <span v-else class="hint">&mdash;</span>
                        </td>
                        <td class="wrule"><div class="rtrunc">{{ (i.kb && i.kb.scoring_rule) || '—' }}</div></td>
                        <td class="nowrap">
                          <span v-if="i.flags.includes('penting')" class="star" title="Poin penting, wajib ditinjau">&#9733;</span>
                          <span v-if="warnFlags(i).length" class="warnic" title="Perlu perhatian">&#9888;</span>
                          <span class="badge" :class="'b-' + statusOf(i)">{{ statusLabel[statusOf(i)] }}</span>
                        </td>
                        <td class="nowrap">
                          <button class="btn sm" @click="editInCard(i)">Edit</button>
                          <button class="btn sm ok" :disabled="busy || i.source === 'BELUM' || i.decision === 'accepted'" @click="approve(i, false)">{{ approveLabel(i) }}</button>
                          <button class="btn sm danger" :disabled="busy || i.decision === 'rejected'" @click="decide(i, { decision: 'rejected' }, false)">Tolak</button>
                        </td>
                      </tr>
                      <tr v-if="tableOpen[i.item_code]" class="exp">
                        <td></td>
                        <td colspan="8">
                          <div v-if="flagTexts(i).length" class="attn">
                            <b>Perlu perhatian</b>
                            <ul><li v-for="t in flagTexts(i)" :key="t">{{ t }}</li></ul>
                          </div>
                          <div v-if="i.source === 'PAKAI_ULANG' && i.reuse_from" class="hint">Diambil dari campaign <b>{{ i.reuse_from.campaign }}</b>.</div>
                          <div v-if="i.kb" class="exp-grid">
                            <div><div class="hint"><b>Cara menilai</b></div><div class="prewrap">{{ i.kb.scoring_rule || '—' }}</div></div>
                            <div><div class="hint"><b>Contoh kalimat agent ({{ activePhrases(i).length }})</b></div>
                              <div v-for="(p, n) in i.kb.example_phrases" :key="n" class="phrase" :class="{ gone: p.dibuang }">
                                <span class="ptext">{{ p.text }}</span>
                                <span v-if="p.source === 'SCRIPT'" class="fromscript">dari script</span>
                                <span v-if="phraseFlags(p).length" class="warnic" :title="phraseTip(p)">&#9888;</span>
                              </div></div>
                          </div>
                          <div v-else class="hint">Belum terisi.</div>
                          <div v-if="i.kb && (i.kb.assumptions || []).length" class="note"><b>Hal yang ditebak AI</b>
                            <ul class="plain"><li v-for="(a, n) in i.kb.assumptions" :key="n">{{ a }}</li></ul></div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else-if="draft.items.length && viewMode === 'tabel'" class="card tight hint">Tidak ada poin yang cocok.</div>

            <div v-for="g in (viewMode === 'kartu' ? groups : [])" :key="g.category" class="card tight">
              <div class="ghead acc" :class="{ openacc: isOpen(g.category) }" @click="toggleGroup(g.category)"
                   @dragenter.prevent="openGroup(g.category)" @dragover.prevent>
                <span class="chev">{{ isOpen(g.category) ? '▾' : '▸' }}</span>
                <strong>{{ g.category }}</strong>
                <span class="hint">{{ g.all.length }} poin &middot; {{ g.done }} selesai</span>
                <span class="bar mini"><i :style="{ width: pct(g.done, g.all.length) + '%' }"></i></span>
                <span class="spacer"></span>
                <button v-if="g.belum" class="btn sm" :disabled="busy" @click.stop="generateCategory(g.category)">Lanjutkan ({{ g.belum }})</button>
                <button v-if="fieldTable(g.category)" class="btn sm" :disabled="busy" @click.stop="expandFields(g)">Buat satu poin per kolom isian ({{ fieldTable(g.category).dinilai }})</button>
                <button class="btn sm" :disabled="busy" @click.stop="renameCategory(g.category)">Ganti nama</button>
                <button class="btn sm danger" :disabled="busy" @click.stop="deleteCategory(g)">Hapus kategori</button>
              </div>

              <div v-show="isOpen(g.category)" class="gbody">
                <div v-for="i in g.items" :id="'it-' + i.item_code" :key="i.item_code" class="item"
                     :class="['s-' + statusOf(i), { over: overCode === i.item_code, open: openCode === i.item_code }]"
                     @dragover.prevent="overCode = i.item_code" @dragleave="overCode === i.item_code && (overCode = null)"
                     @drop.prevent="onDrop(i, $event)">
                  <div class="ihead" @click="openCode = openCode === i.item_code ? null : i.item_code">
                    <span class="code">{{ shortCode(i) }}</span>
                    <span class="req-text">{{ i.requirement }}</span>
                    <span class="wt">bobot {{ i.weight }}</span>
                    <span v-if="i.flags.includes('penting')" class="star" title="Poin penting, wajib ditinjau">&#9733;</span>
                    <span v-if="warnFlags(i).length" class="warnic" title="Perlu perhatian">&#9888;</span>
                    <span class="badge" :class="'b-' + statusOf(i)">{{ statusLabel[statusOf(i)] }}</span>
                  </div>

                  <div v-if="openCode === i.item_code" class="ibody">
                    <div v-if="flagTexts(i).length" class="attn">
                      <b>Perlu perhatian</b>
                      <ul><li v-for="t in flagTexts(i)" :key="t">{{ t }}</li></ul>
                    </div>

                    <div class="setgrid">
                      <div class="field"><label>Poin penilaian</label>
                        <input class="inp" :value="i.requirement" @change="e => patch(i, { requirement: e.target.value })" /></div>
                      <div class="field"><label>Bobot</label>
                        <input class="inp" type="number" step="0.25" :value="i.weight" @change="e => patch(i, { weight: e.target.value })" /></div>
                      <div class="field"><label>Boleh ditoleransi?</label>
                        <div class="seg">
                          <button :class="{ on: i.tolerable === 'YES' }" @click="i.tolerable !== 'YES' && patch(i, { tolerable: 'YES' })">Ya</button>
                          <button :class="{ on: i.tolerable !== 'YES' }" @click="i.tolerable === 'YES' && patch(i, { tolerable: 'NO' })">Tidak</button>
                        </div></div>
                      <div v-if="showVariant(i)" class="field"><label>Berlaku untuk</label>
                        <select class="inp" :value="i.applies_to || ''" @change="e => patch(i, { applies_to: e.target.value })">
                          <option value="">Semua</option><option value="SUPL">Kartu tambahan</option><option value="MUS">Asuransi MUS</option></select></div>
                    </div>

                    <div v-if="i.kutipan_script" class="note">Dasar di script: <i>&ldquo;{{ i.kutipan_script }}&rdquo;</i>
                      <span v-if="!i.kutipan_terverifikasi" class="warn-t"> &#9888; tidak ditemukan persis di script</span></div>
                    <div v-if="i.source === 'PAKAI_ULANG' && i.reuse_from" class="hint">Diambil dari campaign <b>{{ i.reuse_from.campaign }}</b>.</div>

                    <div v-if="i.source === 'BELUM'" class="belumbox">
                      <span>Belum ada isi.</span>
                      <button class="btn sm primary" :disabled="busy" @click="generateCategory(i.category)">Isi dengan AI</button>
                    </div>

                    <template v-if="i.kb">
                      <div class="field"><label>Cara menilai</label>
                        <textarea class="inp ta" rows="4" :value="i.kb.scoring_rule" @change="e => patch(i, { kb: { scoring_rule: e.target.value } })"></textarea></div>
                      <div class="field"><label>Contoh kalimat agent</label>
                        <div v-for="(p, n) in i.kb.example_phrases" :key="n" class="phrase" :class="{ gone: p.dibuang }">
                          <span class="ptext">{{ p.text }}</span>
                          <span v-if="p.source === 'SCRIPT'" class="fromscript">dari script</span>
                          <span v-if="phraseFlags(p).length" class="warnic" :title="phraseTip(p)">&#9888;</span>
                          <button class="btn sm ico" :title="p.dibuang ? 'Pulihkan' : 'Buang'" @click="togglePhrase(i, n)">{{ p.dibuang ? '↺' : '✕' }}</button>
                        </div>
                        <div class="row"><input v-model="newPhrase[i.item_code]" class="inp" style="flex: 1" placeholder="Tambah contoh kalimat..." @keyup.enter="addPhrase(i)" /></div>
                      </div>
                      <div v-if="(i.kb.assumptions || []).length" class="note"><b>Hal yang ditebak AI</b>
                        <ul class="plain"><li v-for="(a, n) in i.kb.assumptions" :key="n">{{ a }}</li></ul></div>
                    </template>

                    <details v-if="sugg[i.item_code] && sugg[i.item_code].length && i.source !== 'PAKAI_ULANG'" class="sugg" :open="i.source === 'BELUM'">
                      <summary>Contoh serupa dari campaign lain ({{ sugg[i.item_code].length }})</summary>
                      <div v-for="c in sugg[i.item_code]" :key="c.campaign + c.kb_code" class="srow">
                        <span class="stext">{{ c.requirement }}</span>
                        <span class="hint">{{ c.campaign }}</span>
                        <span class="hint">kemiripan {{ Math.min(100, Math.round(c.skor * 100)) }}%</span>
                        <button class="btn sm" :disabled="busy" @click="reuseWithConfirm(i, c)">Pakai ini</button>
                      </div>
                    </details>

                    <div class="ifoot">
                      <template v-if="statusOf(i) !== 'rejected'">
                        <button class="btn ok-solid" :disabled="busy || i.source === 'BELUM' || i.decision === 'accepted'" :title="i.source === 'BELUM' ? 'Isi poin ini dulu' : ''" @click="approve(i)">{{ approveLabel(i) }}</button>
                      </template>
                      <button v-else class="btn ok-solid" :disabled="busy || i.source === 'BELUM'" @click="approve(i)">{{ approveLabel(i) }}</button>
                      <button v-if="i.decision !== 'rejected'" class="btn danger" :disabled="busy" @click="decide(i, { decision: 'rejected' })">Tolak</button>
                      <button v-if="i.decision !== 'pending'" class="btn" :disabled="busy" @click="patch(i, { decision: 'pending' })">Batalkan keputusan</button>
                      <span class="spacer"></span>
                      <button class="btn" :disabled="busy" @click="splitItem(i)">Pecah jadi beberapa poin (per pertanyaan)</button>
                      <button class="btn" :disabled="busy || g.all[0] === i" title="Geser ke atas" @click="moveItem(i, 'naik')">&uarr; Naik</button>
                      <button class="btn" :disabled="busy || g.all[g.all.length - 1] === i" title="Geser ke bawah" @click="moveItem(i, 'turun')">&darr; Turun</button>
                      <button class="btn danger" :disabled="busy" @click="deleteItem(i)">Hapus poin</button>
                    </div>
                  </div>
                </div>

                <div class="addrow" :class="{ over: overAdd === g.category }" @dragover.prevent="overAdd = g.category" @dragleave="overAdd === g.category && (overAdd = null)" @drop.prevent="onDropNew(g.category, $event)">
                  <template v-if="addOpen[g.category]">
                    <div class="row">
                      <input v-model="addForm(g.category).requirement" class="inp" placeholder="Poin penilaian" style="flex: 1; min-width: 240px" />
                      <input v-model.number="addForm(g.category).weight" class="inp sm" type="number" step="0.25" title="Bobot" style="width: 80px" />
                      <div class="seg" title="Boleh ditoleransi?">
                        <button :class="{ on: addForm(g.category).tolerable === 'YES' }" @click="addForm(g.category).tolerable = 'YES'">Ya</button>
                        <button :class="{ on: addForm(g.category).tolerable !== 'YES' }" @click="addForm(g.category).tolerable = 'NO'">Tidak</button>
                      </div>
                      <button class="btn sm primary" :disabled="busy || !addForm(g.category).requirement.trim()" @click="addItem(g.category)">Tambah</button>
                      <button class="btn sm" @click="addOpen[g.category] = false">Batal</button>
                    </div>
                    <div class="hint">AI akan menyusun cara menilai dan contoh kalimat. Boleh ditoleransi? = apakah poin ini boleh terlewat tanpa menggagalkan penilaian.</div>
                  </template>
                  <template v-else>
                    <a href="#" @click.prevent="addOpen[g.category] = true">+ Tambah poin</a>
                    <span v-if="libOpen" class="hint"> atau seret poin dari Campaign lain ke sini</span>
                  </template>
                </div>
              </div>
            </div>

            <div v-if="draft.items.length && viewMode === 'kartu'" class="card tight">
              <a v-if="!catOpen" href="#" @click.prevent="catOpen = true">+ Tambah kategori</a>
              <template v-else>
                <div class="row">
                  <input v-model="newCat.name" class="inp sm" placeholder="Nama kategori, mis. CLOSING" style="min-width: 200px" />
                  <input v-model="newCat.requirement" class="inp" placeholder="Poin penilaian pertama" style="flex: 1; min-width: 240px" />
                  <input v-model.number="newCat.weight" class="inp sm" type="number" step="0.25" title="Bobot" style="width: 80px" />
                  <div class="seg" title="Boleh ditoleransi?">
                    <button :class="{ on: newCat.tolerable === 'YES' }" @click="newCat.tolerable = 'YES'">Ya</button>
                    <button :class="{ on: newCat.tolerable !== 'YES' }" @click="newCat.tolerable = 'NO'">Tidak</button>
                  </div>
                  <button class="btn sm primary" :disabled="busy || !newCat.name.trim() || !newCat.requirement.trim()" @click="addCategory">Tambah</button>
                  <button class="btn sm" @click="catOpen = false">Batal</button>
                </div>
                <div class="hint">AI akan menyusun cara menilai dan contoh kalimat.</div>
              </template>
            </div>
          </div>

          <!-- panel campaign lain (tersembunyi bawaan) -->
          <aside v-if="libOpen && viewMode === 'kartu'" class="lib">
            <div class="lib-top"><div class="lib-h">Campaign lain</div><button class="btn sm" @click="libOpen = false">Tutup</button></div>
            <input v-model="libQuery" class="inp sm" placeholder="Cari poin..." />
            <div class="tabs sm">
              <button class="tab" :class="{ on: libCampaign === '' }" @click="libCampaign = ''">Semua</button>
              <button v-for="c in Object.keys(libInfo.campaigns || {})" :key="c" class="tab" :class="{ on: libCampaign === c }" @click="libCampaign = c">{{ c }}</button>
            </div>
            <div class="lib-list">
              <div v-for="l in libFiltered" :key="l.campaign + l.kb_code" class="lrow" draggable="true"
                   @dragstart="e => e.dataTransfer.setData('text/plain', JSON.stringify({ campaign: l.campaign, kb_code: l.kb_code }))">
                <div class="ltext">{{ l.requirement }}</div>
                <div class="hint">{{ l.campaign }} &middot; {{ l.category }}{{ l.weight ? ' · bobot ' + l.weight : '' }}</div>
                <div v-if="libAdding === l.campaign + l.kb_code" class="row" style="margin-top: 4px">
                  <select v-model="libTarget" class="inp sm"><option value="" disabled>Pilih kategori</option>
                    <option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select>
                  <button class="btn sm primary" :disabled="busy || !libTarget" @click="addFromLibrary(libTarget, l); libAdding = ''">Tambah</button>
                </div>
                <button v-else class="btn sm" style="margin-top: 4px" @click="libAdding = l.campaign + l.kb_code; libTarget = ''">Tambahkan ke...</button>
              </div>
              <div v-if="!libFiltered.length" class="hint">Tidak ada yang cocok.</div>
              <div v-if="libFiltered.length >= 80" class="hint">Menampilkan 80 pertama; persempit pencarian.</div>
            </div>
          </aside>
        </div>

        <!-- ---------- 3. Unduh hasil ---------- -->
        <div v-if="step === 2" class="card">
          <h2 class="card-title">Unduh hasil</h2>
          <div>{{ draft.items.length }} poin &middot; {{ cnt.accepted }} disetujui &middot; {{ cnt.rejected }} ditolak &middot;
            <b>{{ draft.items.length - cnt.decided }} belum diputuskan</b></div>
          <div v-if="draft.items.length - cnt.decided > 0" class="note warn-n">
            Masih ada poin yang belum diputuskan atau belum terisi.
            <a href="#" @click.prevent="reviewAgain">Kembali tinjau</a>
          </div>
          <div class="row"><button class="btn primary" :disabled="busy" @click="runBuild">Periksa dan siapkan unduhan</button></div>
          <template v-if="art">
            <div v-for="e in art.validasi.errors" :key="e" class="err">{{ e }}
              <div v-if="errorCodes(e).length" class="row" style="margin-top: 6px">
                <button v-for="c in errorCodes(e)" :key="c" class="btn sm" @click="openItem(c)">Buka poin #{{ c.replace(/^SC_.*_(\d+)$/, '$1') }}</button>
              </div></div>
            <div v-for="w in art.validasi.warnings" :key="w" class="note warn-n">{{ w }}</div>
            <div v-if="!art.validasi.errors.length" class="ok-box">Siap diunduh.
              <div class="okstats">{{ art.validasi.stats.item }} poin &middot; total bobot {{ art.validasi.stats.total_bobot }} &middot; nilai lulus (90%) {{ art.validasi.stats.passing_90_persen }}</div></div>
          </template>
          <div class="row">
            <button class="btn" :disabled="!art" :class="{ on: preview === 'scorecard' }" @click="togglePreview('scorecard')">Pratinjau Scorecard</button>
            <button class="btn" :disabled="!art" :class="{ on: preview === 'kb' }" @click="togglePreview('kb')">Pratinjau KB</button>
          </div>
          <div class="row">
            <button class="btn" :disabled="!canDownload" @click="download('scorecard_' + draft.name + '.txt', art.scorecard)">Unduh Scorecard</button>
            <button class="btn" :disabled="!canDownload" @click="download('kb_' + draft.name + '.txt', art.kb)">Unduh KB</button>
            <button class="btn" :disabled="!canDownload" @click="exportCsv">Unduh tabel ringkasan (CSV)</button>
          </div>
          <div v-if="preview && art" class="pv">
            <div class="row">
              <strong>Pratinjau {{ preview === 'kb' ? 'KB' : 'Scorecard' }} ({{ previewRows.length }} baris)</strong>
              <span class="spacer"></span>
              <div class="seg">
                <button :class="{ on: !previewRaw }" @click="previewRaw = false">Tabel</button>
                <button :class="{ on: previewRaw }" @click="previewRaw = true">Teks asli</button>
              </div>
              <button class="btn sm" @click="preview = ''">Tutup</button>
            </div>
            <pre v-if="previewRaw || !previewRows.length" class="pvraw">{{ art[preview] }}</pre>
            <div v-else class="pvscroll">
              <table v-if="preview === 'scorecard'" class="tbl">
                <thead><tr><th>Kode</th><th>Kategori</th><th>Poin penilaian</th><th>Bobot</th><th>Toleransi</th><th>Berlaku untuk</th></tr></thead>
                <tbody><tr v-for="r in previewRows" :key="r.item_code">
                  <td class="nowrap">{{ r.item_code }}</td><td>{{ r.category }}</td><td>{{ r.requirement }}</td><td>{{ r.weight }}</td>
                  <td>{{ r.tolerable === 'YES' ? 'Ya' : 'Tidak' }}</td><td>{{ r.applies_to || 'Semua' }}</td></tr></tbody>
              </table>
              <table v-else class="tbl">
                <thead><tr><th>Kode</th><th>Kategori</th><th>Poin penilaian</th><th>Contoh kalimat</th><th>Cara menilai</th></tr></thead>
                <tbody><tr v-for="r in previewRows" :key="r.kb_code">
                  <td class="nowrap">{{ r.kb_code }}</td><td>{{ r.category }}</td><td>{{ r.requirement }}</td>
                  <td><ol v-if="(r.example_phrases || []).length" class="pvlist"><li v-for="(t, n) in r.example_phrases" :key="n">{{ t }}</li></ol><span v-else class="hint">-</span></td>
                  <td>{{ r.scoring_rule || '' }}</td></tr></tbody>
              </table>
            </div>
          </div>
          <p class="hint">Pasang hasil ini sebagai campaign lewat menu upload campaign seperti biasa.</p>
        </div>
      </template>
    </div>
  </SidebarLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SidebarLayout from '../../components/SidebarLayout.vue'
import apiClient from '../../api/client.js'

const LONG = { timeout: 180000 } // panggilan AI bisa memakan puluhan detik; batas bawaan klien 30 detik

const drafts = ref([])
const draft = ref(null)
const step = ref(0)
const steps = ['Periksa script', 'Tinjau poin penilaian', 'Unduh hasil']
const busy = ref(false)
const progress = ref('')
const error = ref('')
const errorRaw = ref('')
const form = ref({ name: '', prefix: '', script: null })
const scriptInput = ref(null)

// proses buat draf: daftar langkah bercentang
const createStages = ['Membaca script', 'Membaca gambar di script', 'Mencari informasi campaign', 'Menyusun poin penilaian', 'Menyusun KB']
const creating = ref(false)
const stageNo = ref(0)
const stageFail = ref(false)
const createDetail = ref('')
const stageState = n => (stageFail.value && n === stageNo.value ? 'fail' : n < stageNo.value || (!busy.value && !stageFail.value && stageNo.value >= createStages.length) ? 'done' : n === stageNo.value ? 'run' : 'wait')

const libInfo = ref({ campaigns: {}, items: [] })
const libQuery = ref('')
const libCampaign = ref('')
const libOpen = ref(false)
const libAdding = ref('')
const libTarget = ref('')
const sugg = ref({})
const openCode = ref(null)
const overCode = ref(null)
const tab = ref('all')
const query = ref('')
const viewMode = ref('kartu')
try { viewMode.value = localStorage.getItem('builder_view') === 'tabel' ? 'tabel' : 'kartu' } catch (e) { /* localStorage tidak tersedia */ }
const tableOpen = ref({})
const newPhrase = ref({})
const art = ref(null)
const showTemuan = ref(false)
const addOpen = ref({})
const catOpen = ref(false)

// menu "..." sederhana: satu menu terbuka, tutup saat klik di luar
const openMenu = ref('')
const toggleMenu = k => { openMenu.value = openMenu.value === k ? '' : k }
const closeMenu = () => { openMenu.value = '' }

const moduleLabel = {
  kartu_tambahan: ['Ada kartu tambahan', 'Tidak ada kartu tambahan'],
  asuransi_mus: ['Ada asuransi Mega Ultima Shield (MUS)', 'Tidak ada asuransi MUS'],
  verifikasi_data_acuan: ['Ada verifikasi data nasabah terhadap data acuan bank', 'Tidak ada verifikasi terhadap data acuan bank'],
  konfirmasi_data_tercatat: ['Ada konfirmasi data yang sudah tercatat', 'Tidak ada konfirmasi data yang sudah tercatat'],
  pengisian_data_baru: ['Ada pengisian data aplikasi baru', 'Tidak ada pengisian data aplikasi baru'],
  persetujuan_sharing_data: ['Ada persetujuan sharing data', 'Tidak ada persetujuan sharing data'],
}
const statusLabel = { cek: 'Perlu dicek', accepted: 'Disetujui', rejected: 'Ditolak', belum: 'Belum terisi' }
const flagHelp = {
  penting: 'Poin penting (bobot 4 ke atas). Baca isinya sebelum menyetujui.',
  tanpa_kalimat_script: 'Tidak ada contoh kalimat yang diambil dari script.',
  ada_asumsi: 'AI menebak beberapa hal yang tidak tertulis di script (lihat di bawah).',
  kalimat_perlu_ditinjau: 'Ada contoh kalimat yang mungkin kurang tepat (bertanda ⚠).',
  bobot_dan_tolerable_tebakan: 'Bobot dan toleransi masih tebakan AI. Isi sesuai scorecard Bank Mega.',
  tolerable_tidak_terbaca: 'Toleransi tidak terbaca, sementara diisi Tidak.',
  varian_tidak_jelas: 'Pilih poin ini berlaku untuk siapa.',
  gagal_dibuat: 'AI gagal menyusun poin ini. Tekan Lanjutkan di atas atau isi manual.',
}
const phraseHelp = {
  ditolak_verifikasi_llm: 'Pemeriksa AI menilai kalimat ini belum memenuhi poin penilaian.',
  tanpa_kata_kunci_requirement: 'Kalimat tidak memuat kata dari poin penilaian (bisa salah makna, bisa juga sinonim yang sah).',
  bukan_kutipan_script: 'Ditandai sebagai kutipan script, tetapi tidak ditemukan persis di script.',
}
const safeHelp = 'Menyetujui poin yang sudah terisi, berbobot kecil, dan tanpa catatan perhatian. Poin penting tetap harus dibuka satu per satu.'

const unquote = s => String(s).replace(/^[\s"“”]+|[\s"“”]+$/g, '')
const fmt = s => (s ? new Date(s).toLocaleString('id-ID') : '')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const shortCode = i => i.item_code.replace('SC_' + draft.value.prefix + '_', '#')
function setError(e) {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') { error.value = d; errorRaw.value = ''; return }
  error.value = 'Terjadi kesalahan. Coba lagi; bila berulang hubungi tim teknis.'
  errorRaw.value = d && typeof d === 'object' ? JSON.stringify(d).slice(0, 800) : (e?.message || '')
}
const clearError = () => { error.value = ''; errorRaw.value = '' }

async function run(label, fn) {
  busy.value = true; progress.value = label; clearError()
  try { return await fn() } catch (e) { setError(e); return null } finally { busy.value = false; progress.value = '' }
}
// setiap perubahan langsung disimpan server; toast hanya konfirmasi
const toast = ref('')
let toastTimer = null
function showToast(msg) {
  toast.value = msg; clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
}
onBeforeUnmount(() => clearTimeout(toastTimer))
function applyDraft(res) {
  const d = res?.draft || res
  if (d && Array.isArray(d.items)) { draft.value = d; showToast('Tersimpan otomatis') }
}

async function loadDrafts() {
  const r = await run('Memuat draf...', () => apiClient.get('/builder/drafts'))
  if (r) drafts.value = r.data.drafts
}
onMounted(() => { loadDrafts(); document.addEventListener('click', closeMenu) })
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))

async function createDraft() {
  busy.value = true; clearError(); creating.value = true; stageNo.value = 0; stageFail.value = false; createDetail.value = ''
  let cur = null
  try {
    const fd = new FormData()
    fd.append('name', form.value.name.trim()); fd.append('script', form.value.script)
    if (form.value.prefix.trim()) fd.append('prefix', form.value.prefix.trim())
    const r = await apiClient.post('/builder/drafts', fd, LONG)
    cur = r.data.draft || r.data
    const id = r.data.id || cur.id
    stageNo.value = 1
    cur = (await apiClient.post(`/builder/drafts/${id}/transcribe`, null, LONG)).data
    cur = cur.draft || cur
    stageNo.value = 2
    cur = (await apiClient.post(`/builder/drafts/${id}/modules/suggest`, null, LONG)).data
    cur = cur.draft || cur
    cur = await proposeAndGenerate(id, cur, n => { stageNo.value = n }, t => { createDetail.value = t })
    stageNo.value = createStages.length
    draft.value = cur; step.value = 0; art.value = null; creating.value = false
    form.value = { name: '', prefix: '', script: null }
  } catch (e) {
    stageFail.value = true
    if (stageNo.value === 0) { creating.value = false; stageFail.value = false }
    setError(e)
    loadDrafts()
  } finally { busy.value = false; progress.value = '' }
}

async function openDraft(id) {
  const r = await run('Membuka draf...', () => apiClient.get(`/builder/drafts/${id}`))
  if (!r) return
  draft.value = r.data; step.value = 0; art.value = null; creating.value = false
}
function closeDraft() { draft.value = null; clearError(); loadDrafts() }
async function removeDraft(d) {
  if (!window.confirm(`Hapus draf "${d.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
  await run('Menghapus...', () => apiClient.delete(`/builder/drafts/${d.id}`))
  loadDrafts()
}

async function goStep(n, keep = false) {
  step.value = n; clearError(); closeMenu()
  if (n === 2) art.value = null
  if (n === 1) {
    loadLibrary(); loadFieldTables()
    if (!keep) {
      query.value = ''
      tab.value = cnt.value.cek ? 'cek' : 'all'
      const first = tableRows.value[0]
      if (first && !openCode.value) { openCode.value = first.item_code; tableOpen.value = { ...tableOpen.value, [first.item_code]: true } }
    }
  }
}
const stepDone = n => n === 2 && draft.value.items.length > 0 && cnt.value.decided === draft.value.items.length

async function runTranscribe() { const r = await run('Membaca gambar...', () => apiClient.post(`/builder/drafts/${draft.value.id}/transcribe`, null, LONG)); if (r) applyDraft(r.data) }
async function runModules() { const r = await run('Mencari informasi campaign...', () => apiClient.post(`/builder/drafts/${draft.value.id}/modules/suggest`, null, LONG)); if (r) applyDraft(r.data) }
// poin dari script, lalu draf KB tiap kategori. Bila gagal di tengah, draf tetap tersimpan dan "Lanjutkan" meneruskan
// (poin yang sudah ada dilewati, kategori yang sudah terisi tidak ditimpa).
async function proposeAndGenerate(id, start, onStage, onDetail) {
  let cur = start
  const take = res => { const d = res?.draft || res; if (d && Array.isArray(d.items)) cur = d; return cur }
  if (!cur.items.length) {
    onStage?.(3); progress.value = 'Menyusun poin penilaian...'
    take((await apiClient.post(`/builder/drafts/${id}/items/propose`, null, LONG)).data)
  }
  const cats = [...new Set(cur.items.filter(x => x.source === 'BELUM' && x.decision !== 'rejected').map(x => x.category))]
  for (let n = 0; n < cats.length; n++) {
    onStage?.(4); onDetail?.(`${cats[n]} (${n + 1}/${cats.length})`); progress.value = `Menyusun KB: ${cats[n]} (${n + 1}/${cats.length})...`
    take((await apiClient.post(`/builder/drafts/${id}/generate`, { category: cats[n] }, LONG)).data)
    if (!onStage) applyDraft(cur)
  }
  return cur
}
async function continueAll() {
  busy.value = true; clearError()
  try { applyDraft(await proposeAndGenerate(draft.value.id, draft.value)) } catch (e) { setError(e) } finally { busy.value = false; progress.value = '' }
}

// ---- poin ----
const cnt = computed(() => {
  const it = draft.value.items
  const c = { accepted: 0, rejected: 0, belum: 0, cek: 0 }
  for (const i of it) c[statusOf(i)]++
  c.decided = c.accepted + c.rejected
  return c
})
function statusOf(i) {
  if (i.decision === 'rejected') return 'rejected'
  if (i.decision === 'accepted') return 'accepted'
  return i.source === 'BELUM' ? 'belum' : 'cek'
}
const tabList = computed(() => [
  { key: 'cek', label: `Perlu dicek (${cnt.value.cek})` },
  ...(cnt.value.belum ? [{ key: 'belum', label: `Belum terisi (${cnt.value.belum})` }] : []),
  { key: 'all', label: 'Semua' },
  { key: 'accepted', label: `Disetujui (${cnt.value.accepted})` },
  { key: 'rejected', label: `Ditolak (${cnt.value.rejected})` },
])
const warnFlags = i => i.flags.filter(f => f !== 'belum_diisi')
const activePhrases = i => ((i.kb && i.kb.example_phrases) || []).filter(p => !p.dibuang)
function matches(i) {
  if (tab.value !== 'all' && statusOf(i) !== tab.value) return false
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  const hay = [i.requirement, i.category, i.kb?.scoring_rule, ...((i.kb?.example_phrases || []).map(p => p.text))].join(' ').toLowerCase()
  return hay.includes(q)
}
const groups = computed(() => {
  const by = new Map()
  for (const i of draft.value.items) {
    if (!by.has(i.category)) by.set(i.category, [])
    by.get(i.category).push(i)
  }
  return [...by].map(([category, all]) => ({
    category, all, items: all.filter(matches),
    done: all.filter(i => i.decision !== 'pending').length,
    belum: all.filter(i => statusOf(i) === 'belum').length,
  })).filter(g => g.items.length)
})
const tableRows = computed(() => draft.value.items.filter(matches))
const categories = computed(() => [...new Set(draft.value.items.map(i => i.category))])
const safeCount = computed(() => draft.value.items.filter(i => i.decision === 'pending' && i.source !== 'BELUM' && !warnFlags(i).length).length)
const showVariant = i => !!(draft.value.modules?.kartu_tambahan?.ada || draft.value.modules?.asuransi_mus?.ada || i.applies_to || i.flags.includes('varian_tidak_jelas'))

function flagTexts(i) {
  const out = []
  for (const f of warnFlags(i)) {
    if (f === 'fakta_campaign_lain') out.push(`Diambil dari campaign lain dan memuat angka/nama yang tidak ada di script ini: ${(i.fakta_tidak_ada_di_script || []).join(', ')}.`)
    else out.push(flagHelp[f] || f)
  }
  return out
}
const phraseFlags = p => (p.flags || []).filter(x => x !== 'karangan')
const phraseTip = p => phraseFlags(p).map(f => phraseHelp[f] || f).join(' ') + (p.alasan_verifikasi && phraseFlags(p).includes('ditolak_verifikasi_llm') ? ' ' + p.alasan_verifikasi : '')

// blok script dikelompokkan per fase (baris pemisah)
const scriptRows = computed(() => {
  const out = []; let last = null
  for (const b of draft.value.script.blocks) {
    if (b.fase !== last) { out.push({ key: 'f' + b.row, sep: true, fase: b.fase }); last = b.fase }
    out.push({ key: 'b' + b.row, b })
  }
  return out
})

const libFiltered = computed(() => {
  const q = libQuery.value.trim().toLowerCase()
  let all = libInfo.value.items
  if (libCampaign.value) all = all.filter(l => l.campaign === libCampaign.value)
  return (q ? all.filter(l => (l.requirement + ' ' + l.category + ' ' + l.campaign).toLowerCase().includes(q)) : all).slice(0, 80)
})

// Akordeon kategori: yang dibuka manual disimpan di openGroups; tanpa pilihan manual, hanya kategori pertama yang masih
// perlu tindakan yang terbuka. Dengan filter atau pencarian aktif semua kategori terbuka (isinya sudah disaring).
const openGroups = ref({})
const firstTodo = computed(() => (draft.value.items.find(i => ['cek', 'belum'].includes(statusOf(i))) || {}).category)
const isOpen = c => (tab.value !== 'all' || query.value.trim() ? true : c in openGroups.value ? openGroups.value[c] : c === firstTodo.value)
const toggleGroup = c => {
  const opening = !isOpen(c)
  openGroups.value = { ...openGroups.value, [c]: opening }
  if (opening) { const first = draft.value.items.find(i => i.category === c); if (first) openCode.value = first.item_code }
}
const openGroup = c => { if (!isOpen(c)) openGroups.value = { ...openGroups.value, [c]: true } }

const allOpen = computed(() => tableRows.value.length > 0 && tableRows.value.every(i => tableOpen.value[i.item_code]))
function toggleAllRows() {
  const open = !allOpen.value
  const next = { ...tableOpen.value }
  for (const i of tableRows.value) next[i.item_code] = open
  tableOpen.value = next
}
function setView(v) {
  viewMode.value = v
  try { localStorage.setItem('builder_view', v) } catch (e) { /* abaikan */ }
}
function editInCard(i) {
  setView('kartu'); tab.value = 'all'; query.value = ''; openCode.value = i.item_code; openGroup(i.category)
  setTimeout(() => document.getElementById('it-' + i.item_code)?.scrollIntoView({ block: 'center' }), 80)
}
const preview = ref('')
const previewRaw = ref(false)
function togglePreview(k) { preview.value = preview.value === k ? '' : k }
const previewRows = computed(() => {
  if (!art.value || !preview.value) return []
  try {
    const rows = JSON.parse(art.value[preview.value])
    return Array.isArray(rows) ? rows.filter(r => r && (r.item_code || r.kb_code)) : []
  } catch { return [] }
})
function exportCsv() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const head = ['Kode', 'Kategori', 'Poin penilaian', 'Bobot', 'Boleh ditoleransi', 'Berlaku untuk', 'Status', 'Perlu perhatian', 'Jumlah contoh kalimat', 'Contoh kalimat', 'Cara menilai']
  const varian = { SUPL: 'Kartu tambahan', MUS: 'Asuransi MUS' }
  const rows = draft.value.items.map(i => [i.item_code, i.category, i.requirement, i.weight, i.tolerable === 'YES' ? 'Ya' : 'Tidak', varian[i.applies_to] || 'Semua',
    statusLabel[statusOf(i)], flagTexts(i).join(' | '), activePhrases(i).length, activePhrases(i).map(p => p.text).join(' | '), i.kb?.scoring_rule || ''])
  download(`ringkasan_${draft.value.name}.csv`, '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
}

async function loadLibrary() {
  if (!libInfo.value.items.length) {
    const r = await run('Memuat campaign lain...', () => apiClient.get('/builder/library'))
    if (r) libInfo.value = r.data
  }
  const s = await run('Mencari contoh serupa...', () => apiClient.get(`/builder/drafts/${draft.value.id}/suggestions`))
  if (s) sugg.value = s.data.saran
}
async function patch(i, body) {
  const r = await run('Menyimpan...', () => apiClient.put(`/builder/drafts/${draft.value.id}/items/${i.item_code}`, body))
  if (r) { applyDraft(r.data); return true }
  return false
}

// Setujui/Tolak: setelah berhasil, poin berikutnya yang masih perlu dicek terbuka otomatis (kategori yang sama dulu).
const approveLabel = i => (i.flags.includes('penting') && !i.ditinjau_manual ? 'Sudah saya baca, setujui' : 'Setujui')
const approve = (i, advance = true) => decide(i, i.flags.includes('penting') && !i.ditinjau_manual ? { ditinjau_manual: true, decision: 'accepted' } : { decision: 'accepted' }, advance)
async function decide(i, body, advance = true) {
  const ok = await patch(i, body)
  if (!ok || !advance) return
  const todo = x => x.item_code !== i.item_code && ['cek', 'belum'].includes(statusOf(x)) && matches(x)
  const flat = groups.value.flatMap(g => g.items)
  const idx = flat.findIndex(x => x.item_code === i.item_code)
  const ordered = idx < 0 ? flat : [...flat.slice(idx + 1), ...flat.slice(0, idx)]
  const next = ordered.find(x => todo(x) && x.category === i.category) || ordered.find(todo)
  openCode.value = next ? next.item_code : null
  if (next) {
    openGroup(next.category)
    await nextTick()
    document.getElementById('it-' + next.item_code)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}
async function acceptSafe() {
  if (!window.confirm(`Setujui sekitar ${safeCount.value} poin yang aman? Poin penting dan yang bercatatan perhatian tidak ikut.`)) return
  const r = await run('Menyetujui...', () => apiClient.post(`/builder/drafts/${draft.value.id}/accept_clean`)); if (r) applyDraft(r.data)
}

const addForms = ref({})
const addForm = c => (addForms.value[c] ||= { requirement: '', weight: 1, tolerable: 'NO' })
async function addItem(category) {
  const f = addForm(category)
  const before = new Set(draft.value.items.map(i => i.item_code))
  const r = await run('Menambah poin...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items`, { category, ...f }))
  if (!r) return
  applyDraft(r.data)
  const added = draft.value.items.find(i => !before.has(i.item_code))
  addForms.value[category] = { requirement: '', weight: 1, tolerable: 'NO' }
  addOpen.value[category] = false
  if (added) openCode.value = added.item_code
  await generateCategory(category)  // hanya poin BELUM di kategori itu; poin lain tidak ditimpa
}
async function reuse(i, campaign, kb_code) {
  const r = await run('Memakai isi dari campaign lain...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items/${i.item_code}/reuse`, { campaign, kb_code }))
  if (r) { applyDraft(r.data); openCode.value = i.item_code }
}
function reuseWithConfirm(i, c) {
  if (i.source !== 'BELUM' && !window.confirm('Isi poin ini akan diganti.')) return
  reuse(i, c.campaign, c.kb_code)
}
const fieldTables = ref([])
const normCat = c => String(c || '').replace(/\s+/g, ' ').trim().toLowerCase()
const fieldTable = c => fieldTables.value.find(t => normCat(t.category) === normCat(c) || normCat(c).startsWith(normCat(t.category)) || normCat(t.category).startsWith(normCat(c)))
async function loadFieldTables() {
  try { fieldTables.value = (await apiClient.get(`/builder/drafts/${draft.value.id}/field_tables`)).data.tabel } catch (e) { fieldTables.value = [] }
}
async function expandFields(g) {
  const t = fieldTable(g.category)
  if (!window.confirm(`Ganti poin pertama kategori "${g.category}" dengan ${t.dinilai} poin, satu per kolom isian Wajib dari tabel di gambar script (kolom otomatis dan Optional tidak dijadikan poin)?`)) return
  const r = await run('Memecah per kolom isian...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items/expand_fields`, { category: g.category }))
  if (!r) return
  applyDraft(r.data)
  await generateCategory(g.category)
}
const newCat = ref({ name: '', requirement: '', weight: 1, tolerable: 'NO' })
async function addCategory() {
  const f = newCat.value, category = f.name.trim()
  if (draft.value.items.some(i => i.category === category)) { error.value = `Kategori "${category}" sudah ada; pakai "+ Tambah poin" di kategori itu.`; errorRaw.value = ''; return }
  const r = await run('Menambah kategori...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items`, { category, requirement: f.requirement, weight: f.weight, tolerable: f.tolerable }))
  if (!r) return
  applyDraft(r.data); newCat.value = { name: '', requirement: '', weight: 1, tolerable: 'NO' }; catOpen.value = false
  openGroup(category)
  await generateCategory(category)
}
async function renameCategory(category) {
  const ke = (window.prompt(`Nama baru untuk kategori "${category}" (nama yang sudah ada = digabung):`, category) || '').trim()
  if (!ke || ke === category) return
  const r = await run('Mengubah nama kategori...', () => apiClient.put(`/builder/drafts/${draft.value.id}/categories`, { dari: category, ke }))
  if (r) { applyDraft(r.data); openGroup(ke) }
}
async function deleteCategory(g) {
  if (!window.confirm(`Hapus kategori "${g.category}" beserta ${g.all.length} poinnya? Tidak bisa dibatalkan.`)) return
  const r = await run('Menghapus kategori...', () => apiClient.delete(`/builder/drafts/${draft.value.id}/categories`, { params: { name: g.category } }))
  if (r) applyDraft(r.data)
}
async function splitItem(i) {
  if (!window.confirm(`Pecah poin ${i.item_code} menjadi satu poin per pertanyaan di script? Poin ini diganti poin-poin hasil pecahan (disusun AI, perlu Anda tinjau).`)) return
  const r = await run('Memecah per pertanyaan...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items/${i.item_code}/split`, null, LONG))
  if (!r) return
  applyDraft(r.data); openCode.value = null
  await generateCategory(i.category)
}
async function moveItem(i, arah) {
  const r = await run('Memindahkan poin...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items/${i.item_code}/move`, { arah }))
  if (r) applyDraft(r.data)
}
async function renumberItems() {
  if (!window.confirm('Nomori ulang semua poin (#1, #2, ...) sesuai urutan di layar? Kode poin akan berubah.')) return
  const r = await run('Menomori ulang...', () => apiClient.post(`/builder/drafts/${draft.value.id}/renumber`))
  if (r) { applyDraft(r.data); openCode.value = null }
}
async function deleteItem(i) {
  if (!window.confirm(`Hapus poin ${i.item_code}? Tidak bisa dibatalkan.`)) return
  const r = await run('Menghapus poin...', () => apiClient.delete(`/builder/drafts/${draft.value.id}/items/${i.item_code}`))
  if (r) { applyDraft(r.data); if (openCode.value === i.item_code) openCode.value = null }
}
const overAdd = ref(null)
// Poin dari campaign lain (diseret atau tombol "Tambahkan ke..."): buat poin baru lalu pakai isinya (tidak menimpa poin lain).
async function addFromLibrary(category, lib) {
  const before = new Set(draft.value.items.map(i => i.item_code))
  const r = await run('Menambah poin...', () => apiClient.post(`/builder/drafts/${draft.value.id}/items`,
    { category, requirement: lib.requirement, weight: lib.weight || 1, tolerable: lib.tolerable || 'NO' }))
  if (!r) return
  applyDraft(r.data)
  const added = draft.value.items.find(i => !before.has(i.item_code))
  if (added) await reuse(added, lib.campaign, lib.kb_code)
}
function onDropNew(category, ev) {
  overAdd.value = null
  let src
  try { src = JSON.parse(ev.dataTransfer.getData('text/plain')) } catch (e) { return }
  const lib = src && libInfo.value.items.find(l => l.campaign === src.campaign && l.kb_code === src.kb_code)
  if (lib) addFromLibrary(category, lib)
}
function onDrop(i, ev) {
  overCode.value = null
  try { const s = JSON.parse(ev.dataTransfer.getData('text/plain')); if (s.campaign && s.kb_code) reuse(i, s.campaign, s.kb_code) } catch (e) { /* bukan poin dari campaign lain */ }
}
async function generateCategory(category) {
  const r = await run(`Menyusun KB: ${category}...`, () => apiClient.post(`/builder/drafts/${draft.value.id}/generate`, { category }, LONG))
  if (r) applyDraft(r.data)
}
function togglePhrase(i, n) {
  const ph = i.kb.example_phrases.map((p, k) => (k === n ? { ...p, dibuang: !p.dibuang } : p))
  patch(i, { kb: { example_phrases: ph } })
}
function addPhrase(i) {
  const t = (newPhrase.value[i.item_code] || '').trim()
  if (!t) return
  patch(i, { kb: { example_phrases: [...(i.kb?.example_phrases || []), { text: t, source: 'MANUAL', flags: [] }] } })
  newPhrase.value[i.item_code] = ''
}

// ---- unduh hasil ----
async function runBuild() { const r = await run('Memeriksa...', () => apiClient.post(`/builder/drafts/${draft.value.id}/build`)); if (r) art.value = r.data }
const canDownload = computed(() => !!art.value && !art.value.validasi.errors.length)
const errorCodes = e => [...new Set(String(e).match(/SC_[A-Za-z0-9]+_\d+/g) || [])]
function reviewAgain() { goStep(1).then(() => { tab.value = cnt.value.cek ? 'cek' : cnt.value.belum ? 'belum' : 'all' }) }
async function openItem(code) {
  await goStep(1, true)
  tab.value = 'all'; query.value = ''
  const it = draft.value.items.find(i => i.item_code === code)
  if (!it) return
  setView('kartu'); openCode.value = code; openGroup(it.category)
  await nextTick()
  document.getElementById('it-' + code)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
function download(name, text, type = 'text/plain;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
</script>

<style scoped>
.bld { display: flex; flex-direction: column; gap: 14px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
.card.tight { padding: 14px 18px; gap: 8px; }
.card-title { font-size: 16px; font-weight: 700; }
.hint { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
.spacer { flex: 1; }
.field { display: flex; flex-direction: column; gap: 5px; }
label { font-size: 12px; font-weight: 600; }
.req { color: var(--red); } .opt { color: var(--text-muted); font-weight: 500; }
.inp { padding: 8px 10px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; outline: none; background: #fff; }
.inp:focus { border-color: var(--blue); } .inp.sm { padding: 5px 8px; font-size: 12px; }
.ta { width: 100%; resize: vertical; font-family: inherit; line-height: 1.45; }
.btn { padding: 8px 14px; border: 1.5px solid var(--border); background: #fff; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.btn:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); } .btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.sm { padding: 4px 10px; font-size: 12px; } .btn.primary { background: var(--blue); color: #fff; border-color: var(--blue); }
.btn.primary:hover:not(:disabled) { background: #2563eb; color: #fff; } .btn.danger { color: var(--red); } .btn.ok { color: #16a34a; }
.btn.ok-solid { background: #16a34a; border-color: #16a34a; color: #fff; } .btn.ok-solid:hover:not(:disabled) { background: #15803d; border-color: #15803d; color: #fff; }
.btn.ico { font-size: 14px; line-height: 1; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.err { background: var(--red-bg); color: var(--red); border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; white-space: pre-wrap; }
.raw { margin-top: 6px; font-size: 12px; } .raw summary { cursor: pointer; } .raw pre { white-space: pre-wrap; word-break: break-word; margin: 4px 0 0; }
.ok-box { background: var(--green-bg); color: #16a34a; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 14px; font-weight: 700; }
.okstats { font-size: 13px; font-weight: 600; margin-top: 4px; }
.note { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 12px; line-height: 1.5; }
.note.warn-n { background: #fffbeb; border-color: #fde68a; } .warn-t { color: #b45309; font-weight: 600; }
.warnmsg { color: var(--red); font-size: 13px; font-weight: 600; }
.plain { margin: 2px 0 0; padding-left: 18px; }
.busy { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); }
.spin { width: 14px; height: 14px; border: 2px solid #cbd5e1; border-top-color: var(--blue); border-radius: 50%; animation: sp .7s linear infinite; display: inline-block; }
@keyframes sp { to { transform: rotate(360deg); } }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; } .tbl th { text-align: left; font-size: 12px; color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
.tbl td { padding: 8px; border-bottom: 1px solid #f1f2f4; vertical-align: top; } .act { white-space: nowrap; display: flex; gap: 6px; align-items: center; }
.det summary { cursor: pointer; font-size: 13px; font-weight: 600; margin: 4px 0; }
.drop { display: block; border: 2px dashed var(--border); border-radius: 10px; padding: 18px; text-align: center; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text-muted); max-width: 520px; }
.drop:hover { border-color: var(--blue); } .drop.has { border-style: solid; color: inherit; background: #f8fafc; }
.drop input { display: none; }
/* langkah proses buat draf */
.cstages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.cstages li { display: flex; align-items: center; gap: 10px; color: var(--text-muted); } .cstages li.done, .cstages li.run { color: inherit; } .cstages li.fail { color: var(--red); font-weight: 600; }
.cmark { width: 18px; display: inline-flex; justify-content: center; } .cstages li.done .cmark { color: #16a34a; font-weight: 800; }
/* kerangka */
.topline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; } .dname { font-size: 20px; font-weight: 700; }
.steps { display: flex; gap: 8px; flex-wrap: wrap; }
.step { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px 8px 8px; border: 1.5px solid var(--border); border-radius: 999px; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.step small { font-weight: 500; opacity: .85; }
.snum { width: 22px; height: 22px; border-radius: 50%; background: #eef0f3; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
.step.on { background: var(--blue); border-color: var(--blue); color: #fff; } .step.on .snum { background: #fff; color: var(--blue); }
.step.done .snum { background: #16a34a; color: #fff; }
.toast { position: fixed; right: 24px; bottom: 24px; z-index: 100; background: #16a34a; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.18); pointer-events: none; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; } .toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
.pv { border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #f8fafc; }
.pvscroll { max-height: 480px; overflow: auto; background: #fff; border-radius: 8px; }
.pvraw { max-height: 480px; overflow: auto; margin: 0; padding: 10px; background: #fff; border-radius: 8px; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
.pvlist { margin: 0; padding-left: 18px; }
.btn.on, .seg button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.menu { position: relative; display: inline-block; }
.menu-pop { position: absolute; right: 0; top: 100%; margin-top: 4px; z-index: 30; background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 240px; padding: 4px; display: flex; flex-direction: column; }
.menu-pop.up { top: auto; bottom: 100%; margin: 0 0 4px; }
.menu-pop button { text-align: left; background: none; border: none; padding: 8px 10px; font-size: 13px; border-radius: 6px; cursor: pointer; }
.menu-pop button:hover:not(:disabled) { background: #f1f5f9; } .menu-pop button:disabled { opacity: .45; cursor: not-allowed; } .menu-pop button.danger { color: var(--red); }
/* langkah 1 */
.info-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 14px; line-height: 1.5; }
.info-list li.none { color: var(--text-muted); } .tick { font-weight: 800; margin-right: 6px; } .tick.y { color: #16a34a; } .tick.n { color: var(--text-muted); }
.quote { font-style: italic; margin-top: 2px; padding-left: 22px; }
.tbl-scroll { overflow-x: auto; }
.blk { min-width: 860px; } .blk td { font-size: 12px; line-height: 1.5; } .blk td.nowrap { white-space: nowrap; }
.blk td:nth-child(2) { min-width: 150px; } .blk td:nth-child(3) { min-width: 340px; } .blk td:nth-child(4) { min-width: 220px; }
.blk tr.phase td { background: #f1f5f9; font-weight: 700; font-size: 12px; padding: 6px 8px; }
.prewrap { white-space: pre-wrap; font-size: 12px; line-height: 1.5; }
.imgbox { margin-top: 8px; padding: 8px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; }
.imgtxt { margin: 6px 0 0; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
/* langkah 2 */
.items-wrap { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; } .items-wrap.withLib { grid-template-columns: minmax(0, 1fr) 340px; }
.items-main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.banner { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 14px; font-size: 13px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.toolbar { position: sticky; top: 62px; z-index: 5; background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 12px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
.prog { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.bar { height: 6px; background: #eef0f3; border-radius: 999px; overflow: hidden; } .bar i { display: block; height: 100%; background: #22c55e; }
.bar.mini { width: 70px; height: 5px; display: inline-block; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.tab { padding: 5px 12px; border: 1.5px solid var(--border); border-radius: 999px; background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; }
.tab.on { background: var(--blue); border-color: var(--blue); color: #fff; } .tabs.sm .tab { padding: 3px 9px; }
.seg { display: inline-flex; border: 1.5px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { border: none; background: #fff; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
.seg button.on { background: var(--blue); color: #fff; }
.ghead { display: flex; align-items: center; gap: 10px; }
.ghead.acc { cursor: pointer; flex-wrap: wrap; padding: 4px 2px; border-radius: 8px; user-select: none; } .ghead.acc:hover { background: #f8fafc; }
.ghead .chev { width: 14px; color: var(--text-muted); } .gbody { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.item { border: 1.5px solid var(--border); border-radius: 10px; background: #fff; scroll-margin-top: 190px; }
.item.over { border-color: var(--blue); background: var(--blue-bg); box-shadow: 0 0 0 3px #dbeafe; }
.item.s-accepted { border-left: 4px solid #22c55e; } .item.s-rejected { border-left: 4px solid #9ca3af; } .item.s-cek { border-left: 4px solid #f59e0b; } .item.s-belum { border-left: 4px solid #f472b6; }
.item.s-rejected .req-text { text-decoration: line-through; opacity: .6; }
.ihead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; }
.code, .codecell { font-weight: 600; font-size: 12px; min-width: 34px; color: var(--text-muted); } .req-text { flex: 1 1 260px; font-size: 13px; }
.wt { font-size: 12px; color: var(--text-muted); } .star { color: #d97706; } .warnic { color: #d97706; cursor: help; }
.badge { font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }
.b-cek { background: #fef3c7; color: #b45309; } .b-accepted { background: #dcfce7; color: #16a34a; } .b-rejected { background: #eef0f3; color: #6b7280; text-decoration: line-through; } .b-belum { background: #fce7f3; color: #be185d; }
.ibody { padding: 10px 12px 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.attn { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; font-size: 13px; } .attn ul { margin: 4px 0 0; padding-left: 18px; line-height: 1.5; }
.setgrid { display: grid; grid-template-columns: 3fr 1fr 1.2fr 1.4fr; gap: 10px; align-items: end; }
.belumbox { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px dashed #f472b6; border-radius: 8px; background: #fdf2f8; font-size: 13px; }
.phrase { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #eceef1; } .phrase.gone .ptext { text-decoration: line-through; opacity: .5; } .ptext { flex: 1 1 280px; font-size: 13px; }
.fromscript { font-size: 11px; color: #16a34a; font-weight: 600; }
.sugg { background: #f8fafc; border-radius: 8px; padding: 8px 10px; } .sugg summary { cursor: pointer; font-size: 13px; font-weight: 600; }
.srow { display: flex; align-items: center; gap: 8px; padding: 4px 0; } .stext { flex: 1; font-size: 12px; }
.ifoot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 4px; }
.addrow { padding: 8px 10px; border: 1.5px dashed var(--border); border-radius: 10px; margin: 8px 0 4px; font-size: 13px; display: flex; flex-direction: column; gap: 6px; } .addrow.over { border-color: var(--blue); background: var(--blue-bg); }
.addrow a, .card a { color: var(--blue); font-weight: 600; text-decoration: none; }
/* tabel KB */
.kbtbl { min-width: 1020px; } .kbtbl td { font-size: 12px; } .kbtbl .nowrap { white-space: nowrap; } .kbtbl .cat { width: 120px; color: var(--text-muted); }
.kbtbl .wreq { min-width: 190px; } .kbtbl .wphr { min-width: 230px; max-width: 300px; } .kbtbl .wrule { min-width: 240px; max-width: 340px; }
.kbtbl .tg { cursor: pointer; width: 20px; color: var(--text-muted); user-select: none; }
.kbtbl tr.s-accepted td:first-child { box-shadow: inset 3px 0 0 #22c55e; } .kbtbl tr.s-cek td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
.kbtbl tr.s-belum td:first-child { box-shadow: inset 3px 0 0 #f472b6; } .kbtbl tr.s-rejected td:first-child { box-shadow: inset 3px 0 0 #9ca3af; }
.kbtbl tr.s-rejected { opacity: .55; } .kbtbl tr.rowopen > td, .kbtbl tr.exp > td { background: #f8fafc; }
.ptrunc, .rtrunc { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; -webkit-line-clamp: 3; line-height: 1.4; }
.exp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 8px 0; }
/* panel campaign lain */
.lib { position: sticky; top: 74px; background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 100px); }
.lib-top { display: flex; align-items: center; justify-content: space-between; } .lib-h { font-weight: 700; font-size: 14px; }
.lib-list { overflow: auto; display: flex; flex-direction: column; gap: 6px; }
.lrow { border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; cursor: grab; background: #fafbfc; } .lrow:hover { border-color: var(--blue); } .lrow:active { cursor: grabbing; }
.ltext { font-size: 12px; margin: 3px 0; }
@media (max-width: 1100px) {
  .items-wrap.withLib { grid-template-columns: 1fr; } .lib { position: static; max-height: 420px; }
  .setgrid, .exp-grid { grid-template-columns: 1fr; }
}
</style>
