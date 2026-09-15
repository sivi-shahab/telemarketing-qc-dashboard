import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Base path SPA. Bawaannya '/' — nginx depan melayani dashboard di root
// (`location /` -> :4006), dan bundle-nya memang terbit di /assets/.
// Bisa ditimpa lewat build arg VITE_BASE_PATH bila kelak dipasang di belakang
// reverse proxy dengan prefix, tanpa menyentuh kode: itu sebabnya `%BASE_URL%`
// dipakai di index.html alih-alih path yang ditulis mati.
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE_PATH || '/',
})
