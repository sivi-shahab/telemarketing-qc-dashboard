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
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4006
