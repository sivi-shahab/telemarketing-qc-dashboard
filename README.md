# telemarketing-qc-dashboard

Frontend sistem QC Telemarketing: Vue 3 + Vite + Pinia + vue-router, disajikan
Nginx di port `4006`.

## Repo terkait

| Repo | Isi |
|---|---|
| `telemarketing-qc-api` | Backend FastAPI (port 4000) — sumber semua data |
| `telemarketing-qc-worker` | Celery worker + Flower |
| `telemarketing-qc-core` | Kode bersama backend (tidak dipakai repo ini) |

Repo ini **mandiri penuh** — tidak punya submodule.

## Dokumentasi arsitektur

Dokumen arsitektur sistem berlaku untuk **keempat repo** dan tinggal di repo
`telemarketing-qc-api`:

| Berkas | Isi |
|---|---|
| `telemarketing-qc-api/docs/ARSITEKTUR.md` | Topologi runtime, pembagian compose, alur data, kepemilikan skema DB, integrasi eksternal (App A/App C/object storage S3/LLM), build & deploy, urutan rilis wajib, langkah menjalankan dari nol |
| `telemarketing-qc-api/docs/README.md` | Indeks seluruh paket dokumentasi (deployment, runbook, data model, API reference, role, scoring) |

Baca `ARSITEKTUR.md` lebih dulu sebelum mengubah apa pun yang menyentuh repo lain.

## Development

```bash
npm install
cp .env.example .env      # isi VITE_API_URL
npm run dev               # http://localhost:5173
npm test
```

## Docker

```bash
docker network create qc-net    # sekali per host, dipakai bersama repo API
docker compose up -d --build
```

## VITE_API_URL

Vite mengganti nilai `VITE_API_URL` **saat build**, bukan saat container start —
jadi satu image terikat ke satu environment. Nilainya di-pass sebagai build arg
(lihat `Dockerfile` dan `Jenkinsfile`), bukan lewat `.env` container.

| Situasi | Nilai |
|---|---|
| Dev di host | `http://localhost:4000` |
| Di belakang reverse proxy | `/telemarketing_qc_system/api` |

Kalau nanti butuh satu image untuk dev+prod, ubah ke runtime config
(`/config.json` yang di-fetch saat boot) — itu perubahan kode tersendiri.

## Catatan

- `nginx.conf` sengaja menyajikan `.mjs` sebagai `text/javascript`: browser
  menolak module worker (pdf.js) yang dikirim sebagai `application/octet-stream`.
- Repo ini dibuat dengan `git init` bersih. Jangan pernah menyalin ulang folder
  `.git` lama dari monorepo — di sana ada repo nested milik proyek lain.
