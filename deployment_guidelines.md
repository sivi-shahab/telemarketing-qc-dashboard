# Deployment — telemarketing-qc-dashboard

Panduan menyalakan **dashboard** (Vue + Vite, disajikan Nginx). Panduan repo
lain: `telemarketing-qc-api/deployment_guidelines.md` dan
`telemarketing-qc-worker/deployment_guidelines.md`.

> **Dashboard dinyalakan terakhir.** Ia tidak punya `depends_on` ke API (beda
> compose file), jadi Nginx tetap naik meski API belum siap — yang gagal
> permintaannya, bukan container-nya.

---

## 1. Prasyarat

### Network `qc-net`

```bash
docker network create qc-net
```

Dibuat sekali di host, dipakai bersama tiga repo. Compose di sini memakai
`external: true` sehingga tidak membuatkannya sendiri.

Repo ini **tidak punya submodule** — berbeda dari API dan worker.

### Berkas `.env` dan variabel `VITE_*`

Ini bagian paling mudah salah di repo ini.

**`VITE_*` di-bake ke bundle saat BUILD, bukan dibaca saat runtime.** `.env`
tidak ikut ke image (lihat `.dockerignore`), jadi satu-satunya jalan masuknya
adalah `args:` di `docker-compose.yml` yang diteruskan ke `ARG` di `Dockerfile`.

Konsekuensinya: **mengubah `VITE_*` di `.env` tidak berpengaruh sampai image
di-build ulang.** `docker compose restart` saja tidak cukup.

| Variabel | Default | Keterangan |
|---|---|---|
| `VITE_API_URL` | `/api-b` | Prefix API utama (App B). Wajib cocok dengan `location /api-b/` di nginx depan. Dipakai `src/api/client.js` dan `src/stores/auth.js`. |
| `VITE_API_BASE` | `/api-a` | Prefix App A / STT. **Sudah tidak dirujuk kode** sejak Upload Audio dialihkan ke `/upload_audio` (App B); build-arg-nya dibiarkan agar tidak mengejutkan bila ada yang memakainya lagi. |
| `VITE_PDF_API_BASE` | *(kosong)* | Kosong = relatif, lewat `location /api/download` nginx depan ke `:8010`. |
| `VITE_PDF_API_KEY` | *(kosong)* | Header `X-API-Key` untuk unduh PDF. Kalau hilang, unduhan ditolak. |
| `VITE_RESULTS_GROUPING` | `client` | Mode pengelompokan tabel Results. |

> `VITE_API_URL` **tidak boleh** diisi origin tanpa prefix (mis.
> `https://call-qc.bankmega.local`). Nginx depan punya `location /auth/login`
> yang menunjuk App C `:8008`, jadi login akan nyasar ke aplikasi lain dan
> dibalas `422`.

Kalau menambah `VITE_*` baru di `src/`, tambahkan juga di **dua tempat**:
`args:` pada `docker-compose.yml` dan `ARG`/`ENV` pada `Dockerfile`. Kalau
terlewat, Vite mengganti nilainya jadi `undefined` dan kode diam-diam jatuh ke
fallback-nya.

---

## 2. Menyalakan

```bash
cd /data/scorecard_v2/telemarketing-qc-dashboard
docker compose up -d --build
```

Build dua tahap: `node:20-alpine` menjalankan `npm ci && npm run build`, lalu
hasil `dist/` disalin ke `nginx:alpine` yang mendengarkan di **4006**.

Setelah mengubah `VITE_*`, **wajib** `--build`:

```bash
docker compose up -d --build          # bukan sekadar restart
```

Memaksa container dibuat ulang tanpa mengubah kode:

```bash
docker compose up -d --force-recreate
```

---

## 3. Verifikasi

Jangan menguji lewat `http://localhost:4006` — pakai pintu masuk sebenarnya:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://call-qc.bankmega.local/     # 200

curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://call-qc.bankmega.local/api-b/auth/login \
  --data-urlencode "username=<user>" --data-urlencode "password=<pass>"      # 200
```

Memastikan bundle memuat prefix yang benar:

```bash
docker exec telemarketing-qc-dashboard-dashboard-1 \
  sh -c "grep -ro 'api-[ab]' /usr/share/nginx/html/assets/ | sort -u"
```

---

## 4. Nginx depan (di host, di luar repo)

Container ini **hanya menyajikan berkas statis**. Yang memetakan prefix API
adalah Nginx di host (`/etc/nginx/sites-available/default`):

| Path | Tujuan |
|---|---|
| `/` | dashboard `:4006` |
| `/api-b/` | API `:4000` (prefix di-strip) |
| `/api-a/` | App A / STT `:8000` |
| `/api/download`, `/api/view-streams/` | `:8010` |

Karena itu login lewat `http://localhost:4006` **selalu gagal** dengan
`405 Not Allowed`: bundle memanggil `POST /api-b/auth/login`, nginx dashboard
tidak punya `location` untuk itu dan mencoba menyajikannya sebagai berkas statis.
Itu perilaku yang benar, bukan kerusakan.

---

## 5. Cache browser

`nginx.conf` sudah mengatur dua hal, jangan dilonggarkan:

- `index.html` → `Cache-Control: no-store, must-revalidate`. Tanpa ini browser
  menahan penunjuk ke bundle lama. Pernah terjadi: tujuh jam setelah deploy,
  empat browser masih menjalankan bundle pra-perbaikan.
- `/assets/` → `immutable` selama setahun (nama berkasnya ber-hash), dan
  `try_files $uri =404` — **bukan** fallback ke `index.html`. Fallback membuat
  chunk yang sudah tidak ada dibalas HTML ber-status 200, sehingga klien basi
  tampak jalan padahal modulnya gagal dimuat. Deploy basi harus gagal
  terang-terangan.

Kalau setelah deploy pengguna masih melihat versi lama, minta hard reload
(Ctrl+Shift+R) lebih dulu sebelum mencurigai backend.

---

## 6. Pengembangan lokal

```bash
npm ci
npm run dev            # Vite dev server
npm run build          # cek build lolos sebelum commit
```

`npm run build` wajib dijalankan sebelum commit perubahan `src/` — kesalahan
template Vue baru ketahuan di tahap ini, tidak saat menyunting.

---

## 7. Masalah yang pernah terjadi

| Gejala | Sebab & penanganan |
|---|---|
| Login `405 Not Allowed` | Diakses lewat `localhost:4006`, bukan `call-qc.bankmega.local`. Prefix `/api-b/` hanya ada di nginx depan. |
| Login `422` dari aplikasi lain | `VITE_API_URL` diisi origin tanpa prefix, sehingga `/auth/login` nyasar ke App C `:8008`. |
| Unduh PDF ditolak | `VITE_PDF_API_KEY` tidak ikut saat build — cek `args:` di compose dan `ARG` di Dockerfile. |
| Perubahan `.env` tidak terasa | `VITE_*` di-bake saat build. Jalankan `docker compose up -d --build`. |
| Menu tidak muncul untuk suatu role | Menu digerakkan capability, bukan kode. Cek `permissions.js` dan izin role di menu Manage Role — dashboard tidak perlu di-build ulang untuk ini. |
| Pengguna masih melihat versi lama | Cache browser. Hard reload; pastikan aturan `index.html` di `nginx.conf` tidak diubah. |
| Compose gagal: network `qc-net` not found | `docker network create qc-net`. |
