# nginx depan (reverse proxy host)

Isi folder ini **bukan** nginx yang ada di dalam image dashboard. Ada dua nginx
dan gampang tertukar:

| File | Jalan di mana | Tugas |
|---|---|---|
| `../../nginx.conf` | **di dalam container** `qc-dashboard`, `listen 4006` | menyajikan file statis hasil build + SPA fallback (`try_files … /index.html`) |
| `call-qc.bankmega.local.conf` | **di host**, `listen 443` | TLS + reverse proxy: membagi satu domain ke App A/B/C dan ke container di atas |

File `call-qc.bankmega.local.conf` adalah salinan **apa adanya** dari
`/etc/nginx/sites-available/default` di server `call-qc.bankmega.local`
(diambil 2026-08-26). Sengaja tidak diberi komentar tambahan supaya bisa
di-`cp` balik ke server tanpa diedit. Penjelasannya ditaruh di sini.

## Kenapa disimpan di repo

`VITE_API_URL` di-*bake* ke bundle saat build, dan nilainya (`/api-b`) hanya
berfungsi kalau nginx host punya `location` yang cocok. Jadi bundle dan config
ini adalah satu pasangan — kalau salah satu berubah sendiri, login mati.
Sebelumnya config ini cuma hidup di server dan tidak terlacak di mana pun.

## Peta routing

Satu domain `call-qc.bankmega.local` melayani beberapa aplikasi:

| Prefix | Diteruskan ke | Dipakai oleh |
|---|---|---|
| `/api-b/` | App B `:4000` (prefix di-strip) | dashboard ini — `VITE_API_URL`, semua request `apiClient` |
| `/api-a/` | App A `:8000` (prefix di-strip) | dashboard ini — `VITE_API_BASE`, STT / upload audio |
| `/api/download`, `/api/view-streams/` | `:8010` (path utuh) | dashboard ini — PDF, `VITE_PDF_API_BASE` dibiarkan kosong |
| `/auth/login`, `/auth/logout`, `/me`, `/tickets`, `/tickets-daily`, `/api/refresh`, `/qc-result-logs` | App C `:8008` | **aplikasi lain**, bukan dashboard ini |
| `/voice-to-text-dm/` | MinIO `cdn.bankmega.local:9000` | file audio |
| `/` | container dashboard `:4006` | frontend |

### Trailing slash pada `proxy_pass` menentukan strip prefix

```
location /api-b/ { proxy_pass http://localhost:4000/; }   # ADA slash -> prefix dibuang
    /api-b/auth/login   ->   App B menerima /auth/login

location /api/download { proxy_pass http://localhost:8010; }   # TANPA slash -> path utuh
    /api/download/xxx   ->   :8010 menerima /api/download/xxx
```

Kalau slash di ujung `proxy_pass` untuk `/api-b/` terhapus, App B akan menerima
`/api-b/auth/login` dan menjawab 404.

## Jebakan: `VITE_API_URL` tidak boleh origin polos

Perhatikan bahwa vhost yang sama punya `location /auth/login` yang menunjuk
**App C `:8008`** — API login berbeda yang meminta JSON `{nip, password}`.
Kalau `VITE_API_URL` diisi origin polos (`https://call-qc.bankmega.local`) atau
dikosongkan, request login dashboard jadi `POST /auth/login` dan nyasar ke
App C → dijawab **422 Unprocessable Content**. Prefix `/api-b` wajib ada.

Efek turunannya di kode: `apiClient` sudah membawa `baseURL = '/api-b'`,
sehingga endpoint App A harus dipanggil dengan `fetch()` polos — lewat
`apiClient` path-nya menumpuk jadi `/api-b/api-a/…` dan 404
(lihat `src/views/upload/UploadAudioView.vue`).

## Cara pakai

```bash
sudo cp deploy/nginx/call-qc.bankmega.local.conf /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
```

Yang perlu sudah tersedia di server:

- sertifikat di `/etc/ssl/bankmegalocal/bankmegalocal.crt` + `.key`
- App A `:8000`, App B `:4000`, App C `:8008` dan `:8010` berjalan di localhost
- container dashboard mendengarkan `:4006`

Kalau deploy ke host lain (mis. varian *huawei* yang disebut di komentar
`.env.example`), yang berubah hanya `server_name` dan path sertifikat — peta
prefix di atas harus tetap sama, karena `/api-b` sudah terkunci di dalam bundle.

## Kalau config di server berubah

File ini salinan manual, tidak ada sinkronisasi otomatis. Setelah mengubah
nginx di server, salin balik ke sini dan commit:

```bash
diff /etc/nginx/sites-available/default deploy/nginx/call-qc.bankmega.local.conf
```
