import tailwindcss from '@tailwindcss/vite';
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  srcDir: '.',
  ssr: false,
  css: ['~/assets/css/main.css', '~/assets/css/responsive.css', '~/assets/css/sidebar.css', '~/assets/css/refined-pages.css', '~/assets/css/ops-pages.css', '~/assets/css/compact-operations.css', '~/assets/css/library-inspired-pages.css', '~/assets/css/dense-responsive-2026.css', '~/assets/css/pqc-advanced.css'],
  build: { transpile: ['@pqfile/crypto-core'] },
  vite: { plugins: [tailwindcss()] },
  app: {head: {title: 'PQFile Secure | Bảo vệ tệp tin hậu lượng tử',meta:[{name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'},{name:'description',content:'Mã hóa và chia sẻ tệp an toàn với ML-KEM, ML-DSA và AES-256-GCM.'}],link:[{rel:'preload',as:'image',type:'image/webp',href:'/campus-background-hd.webp'}]}},
  runtimeConfig: { public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api' } },
  typescript: {strict: true}
});
