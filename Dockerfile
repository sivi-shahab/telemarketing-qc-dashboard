FROM node:20-alpine AS builder
# Prefix yang di-bake ke bundle. WAJIB cocok dengan `location` di nginx depan:
#   location /api-b/ { proxy_pass http://localhost:4000/; }
# Nilai same-origin tanpa prefix (mis. https://<host>) SALAH — nginx punya
# `location /auth/login` yang menunjuk App C :8008, jadi login jatuh ke
# aplikasi lain dan dijawab 422.
# Catatan: .env TIDAK ikut ke image (lihat .dockerignore), jadi build-arg ini
# satu-satunya sumber nilai saat build lewat Docker.
ARG VITE_API_URL=/api-b
ENV VITE_API_URL=$VITE_API_URL

# `.env` TIDAK ikut ke image (lihat .dockerignore), jadi setiap VITE_* yang
# dipakai src/ harus lewat build-arg — kalau tidak, Vite mengganti nilainya
# dengan undefined dan kode jatuh ke fallback-nya.
# Yang paling berdampak: VITE_PDF_API_KEY (fallback '' di
# src/views/upload/UploadAudioView.vue:364) membuat request PDF tanpa API key.
# Ditambahkan 2026-09-02 saat cutover ke repo split.
ARG VITE_API_BASE=/api-a
ENV VITE_API_BASE=$VITE_API_BASE
ARG VITE_PDF_API_BASE=
ENV VITE_PDF_API_BASE=$VITE_PDF_API_BASE
ARG VITE_PDF_API_KEY=
ENV VITE_PDF_API_KEY=$VITE_PDF_API_KEY
ARG VITE_RESULTS_GROUPING=client
ENV VITE_RESULTS_GROUPING=$VITE_RESULTS_GROUPING
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4006
