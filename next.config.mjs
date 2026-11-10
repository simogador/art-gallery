/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // Story 2.4 (AD-14) : les pages d'invitation ne transmettent jamais leur URL en référent.
  async headers() {
    return [
      // `:path*` couvre aussi /auth/invitation (zéro segment).
      { source: '/auth/invitation/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      // Story 4.9 : le lien de désinscription ne se retrouve pas non plus dans un référent.
      { source: '/auth/desinscription/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      // Story 4.5 : de même pour le lien de désinscription de l'alerte « Me prévenir ».
      { source: '/auth/desinscription-alerte/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ]
  },
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
}

export default nextConfig
