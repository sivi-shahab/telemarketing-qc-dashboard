<template>
  <div class="login-page">
    <!-- Latar dari Mba Ifo. Dipasang sebagai lapisan sendiri (bukan background-image
         di .login-page) supaya bisa diberi overlay gelap tanpa ikut meredupkan kartu
         login di atasnya. Belum ada slideshow: satu gambar statis, sesuai keputusan
         28 Agustus 2026. Menambah gambar berikutnya tinggal menaruh berkasnya di
         assets/brand/ dan mengubah `bgImage` di bawah. -->
    <div class="login-bg" :style="{ backgroundImage: `url(${bgImage})` }"></div>
    <div class="login-bg-veil"></div>

    <div class="login-card">
      <!-- Logo diberi alas terang sendiri. Wordmark "BANK MEGA" berwarna abu-abu
           #626565; di atas kartu kaca yang gelap kontrasnya hanya ~1,9:1 alias tidak
           terbaca. Mencerahkan berkasnya lewat filter CSS akan menggeser warna emas
           & jingga pada mark "M" — untuk logo bank itu tidak boleh. Alas terang
           menjaga warna brand tetap persis seperti aslinya. -->
      <span class="logo-chip">
        <img :src="logoFull" class="login-logo-img" alt="Bank Mega" />
      </span>
      <h1>Telemarketing QC System</h1>
      <p class="subtitle">Masuk untuk melanjutkan</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="field">
          <label>Username</label>
          <input
            v-model="username"
            type="text"
            placeholder="Masukkan username"
            autocomplete="username"
            required
          />
        </div>

        <div class="field">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Masukkan password"
            autocomplete="current-password"
            required
          />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Memproses...' : 'Login' }}
        </button>
      </form>
    </div>

    <!-- Running text Do & Don'ts. Isinya PLACEHOLDER — teks final belum dikirim
         (28 Agustus 2026); ganti isi DOS/DONTS di bawah, tata letaknya ikut. -->
    <div class="ticker" aria-label="Do and Don'ts">
      <div class="ticker-track">
        <!-- Dirender dua kali: salinan kedua menutup celah yang muncul saat salinan
             pertama sudah bergeser habis ke kiri, jadi jalannya tampak menyambung. -->
        <div class="ticker-run" v-for="copy in 2" :key="copy" :aria-hidden="copy === 2">
          <span class="tick-item" v-for="(t, i) in tickerItems" :key="copy + '-' + i">
            <span class="tick-tag" :class="t.kind">{{ t.kind === 'do' ? 'DO' : "DON'T" }}</span>
            {{ t.text }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { playSequence, playSound } from '../utils/sound.js'
import logoFull from '../assets/brand/bank-mega-logo.png'
import bgImage from '../assets/brand/login-bg.jpeg'
import firstAudio from '../assets/brand/login-first.mp3'
import afterLoginAudio from '../assets/brand/after-login.mp3'
import secondAudio from '../assets/brand/login-second.mp3'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// PLACEHOLDER — teks Do & Don'ts final belum diterima. Isinya diambil dari temuan QC
// yang berulang supaya sudah ada gunanya sambil menunggu naskah resminya.
const DOS = [
  'Tanyakan ketersediaan waktu nasabah di awal percakapan.',
  'Sebutkan bunga dengan frasa "effective rate", bukan "efektif tahun".',
  'Lakukan verifikasi statik dan dinamis sebelum masuk final konfirmasi.',
  'Bacakan legal statement lengkap dan pastikan nasabah menyatakan persetujuan.',
  'Sebutkan nominal, tenor, bunga, dan biaya administrasi saat final konfirmasi.',
]
const DONTS = [
  'Menawarkan kepada pihak selain nasabah terundang.',
  'Menggunakan kata sarkas, kasar, atau menyinggung kepada nasabah.',
  'Menjanjikan persetujuan pengajuan atau besaran limit di luar kewenangan.',
  'Mengubah atau melengkapi data nasabah tanpa konfirmasi dari nasabah.',
  'Menutup telepon tanpa legal statement ulang bila nasabah membatalkan.',
]
// Diselang-seling DO / DON'T supaya pembaca tidak melihat lima baris bernada sama
// berturut-turut sebelum nada satunya muncul.
const tickerItems = computed(() => {
  const out = []
  for (let i = 0; i < Math.max(DOS.length, DONTS.length); i++) {
    if (DOS[i]) out.push({ kind: 'do', text: DOS[i] })
    if (DONTS[i]) out.push({ kind: 'dont', text: DONTS[i] })
  }
  return out
})

// Urutan audio yang diminta: First (halaman login) -> After login -> Second.
//
// First diputar saat halaman login dibuka. Karena browser menolak audio bersuara
// sebelum ada interaksi, ``playWhenAllowed`` mengulanginya pada klik/ketik pertama
// bila percobaan awalnya ditolak.
// Urutan audio (28 Agustus 2026): First lalu Second diputar BERURUTAN begitu
// halaman login dimuat — keduanya milik halaman login, sesuai nama berkasnya.
// After login menyusul terpisah, hanya bila login berhasil.
let intro = null
onMounted(() => {
  // retryOnGesture: browser menolak audio sebelum ada interaksi, jadi di kunjungan
  // pertama rangkaian ini diulang dari awal pada klik/ketikan pertama pengguna.
  intro = playSequence([firstAudio, secondAudio], { retryOnGesture: true })
})
// Ditinggalkan tanpa login (mis. tombol Back): hentikan, jangan sampai suaranya
// menyusul di halaman lain.
onBeforeUnmount(() => { intro?.stop() })

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(username.value, password.value)
    // Rangkaian halaman login dipotong di sini — kalau First/Second masih berbunyi
    // ia akan bertumpuk dengan After login, bukan mengantre di belakangnya.
    intro?.stop()
    // After login: dipicu klik tombol, jadi lolos kebijakan autoplay tanpa cadangan.
    // Bertahan melewati router.push karena SPA tidak memuat ulang halaman.
    playSound(afterLoginAudio)
    router.push('/dashboard/stats')
  } catch (e) {
    if (e.response?.status === 401) {
      error.value = 'Username atau password salah.'
    } else {
      error.value = 'Gagal terhubung ke server. Coba lagi.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #FAFBFC 0%, #FDF3D2 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Overlay: gambar latarnya ramai, tanpa ini teks di kartu login kehilangan kontras
   dan running text di bawah tidak terbaca. */
.login-bg-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, rgba(24, 20, 38, .42) 0%, rgba(24, 20, 38, .58) 100%);
}

/* Kartu kaca (glassmorphism), bukan panel putih pekat. Latar di belakangnya
   gelap, jadi kartunya ikut gelap — SELURUH teks di dalamnya karena itu memakai
   warna terang eksplisit, bukan token --text/--text-muted yang bernilai hitam.
   Ini satu-satunya tempat aturan "semua tulisan hitam" tidak berlaku: di atas
   kaca gelap, tulisan hitam tidak terbaca sama sekali. */
.login-card {
  position: relative;
  background: rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.20);
  border-radius: 18px;
  padding: 36px 32px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.42);
  text-align: center;
  margin-bottom: 56px; /* ruang untuk running text yang menempel di bawah layar */
}

/* Firefox lama & Safari tanpa izin backdrop-filter tidak mengaburkan apa pun —
   di sana kartunya hanya akan 10% putih di atas foto, dan teksnya tenggelam.
   Cadangannya: panel gelap pekat, tetap bukan putih. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .login-card { background: rgba(24, 20, 38, 0.82); }
}

/* Alas terang khusus logo — lihat catatan di template. */
.logo-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}
.login-logo-img { height: 44px; width: auto; display: block; }

h1 { font-size: 20px; font-weight: 700; color: #fff; }

.subtitle { color: rgba(255, 255, 255, 0.75); font-size: 13px; margin: 4px 0 26px; }

.login-form { text-align: left; }

.field { margin-bottom: 16px; }

label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.10);
  border: 1.5px solid rgba(255, 255, 255, 0.26);
  border-radius: 8px;
  font-size: 14px;
  color: #fff;
  transition: border-color .2s, background .2s;
  outline: none;
}

input::placeholder { color: rgba(255, 255, 255, 0.52); }

input:focus {
  border-color: var(--mega-gold);
  background: rgba(255, 255, 255, 0.16);
}

/* Chrome memaksa latar kuning-putih pada kolom yang diisi otomatis, yang akan
   merusak kaca DAN membuat teks putih di atasnya tak terbaca. Tidak ada properti
   resmi untuk mematikannya; cara yang dipakai luas adalah menimpanya dengan
   inset box-shadow raksasa dan mewarnai teksnya lewat -webkit-text-fill-color.
   Ini form login — autofill hampir pasti kena, jadi bukan kasus pinggiran. */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px rgba(52, 44, 72, 0.94) inset;
  -webkit-text-fill-color: #fff;
  caret-color: #fff;
  transition: background-color 5000s ease-in-out 0s;
}

.error-msg {
  background: rgba(199, 56, 56, 0.26);
  color: #FFD9D9;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}

.btn-login {
  width: 100%;
  padding: 11px;
  background: var(--mega-gradient);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  transition: filter 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-login:hover:not(:disabled) { filter: brightness(0.94); }
.btn-login:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ---- Running text Do & Don'ts ---- */
.ticker {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 12px 0;
  background: rgba(30, 31, 33, .72);
  border-top: 1px solid rgba(255, 255, 255, .14);
  overflow: hidden;
  white-space: nowrap;
}
.ticker-track {
  display: flex;
  width: max-content;
  animation: ticker-scroll 60s linear infinite;
}
/* Berhenti saat disentuh pointer supaya butir yang panjang sempat dibaca utuh. */
.ticker:hover .ticker-track { animation-play-state: paused; }

.ticker-run { display: flex; }

.tick-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 28px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}
.tick-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .06em;
}
.tick-tag.do { background: #5CE65C; color: #1E1F21; }
.tick-tag.dont { background: #9B1C1C; color: #fff; }

/* -50% = tepat satu salinan penuh, jadi loop-nya menyambung tanpa lompatan. */
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* Hormati preferensi sistem: animasi bergerak terus-menerus mengganggu sebagian
   pengguna. Teksnya tetap ada, hanya berhenti bergerak. */
@media (prefers-reduced-motion: reduce) {
  .ticker-track { animation: none; }
}
</style>
