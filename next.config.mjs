import { imageHosts } from './image-hosts.config.mjs';

const isDev = process.env.NODE_ENV === 'development';

// Supabase-origin (auth, database, storage, realtime) afgeleid uit de env,
// met een wildcard-fallback zodat een ontbrekende build-env de app nooit breekt.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : 'https://*.supabase.co';
const supabaseWsOrigin = supabaseOrigin.replace(/^https/, 'wss');

// Zelfde hosts als next/image (image-hosts.config.mjs), voor <img>/AppImage.
const imageOrigins = imageHosts.map((h) => `${h.protocol}://${h.hostname}`).join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is nodig voor de inline bootstrap-scripts van Next.js;
  // 'unsafe-eval' alleen in dev (react-refresh/HMR).
  // static.rocket.new: de Rocket-scripts in src/app/layout.tsx.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://static.rocket.new`,
  // 'unsafe-inline' voor styled-jsx/inline styles; fonts.googleapis.com voor
  // de Public Sans-@import in src/styles/tailwind.css.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' blob: data: ${imageOrigins}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  // ws: alleen in dev (HMR-websocket van Next.js).
  `connect-src 'self'${isDev ? ' ws:' : ''} ${supabaseOrigin} ${supabaseWsOrigin} https://*.rocket.new https://*.builtwithrocket.new`,
  // DocumentViewerModal embedt PDF's van Supabase Storage in een iframe.
  `frame-src 'self' ${supabaseOrigin}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    qualities: [75, 85, 100],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  webpack(
    config,
    {
      dev: dev
    }
  ) {
    if (dev) {
      const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      config.watchOptions = {
        ignored: ignoredPaths.length
          ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
          : undefined,
      };
    }
    if (dev) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: [/node_modules/],
        use: [{
          loader: '@dhiwise/component-tagger/nextLoader',
        }],
      });
    }
    return config;
  },
};
export default nextConfig;
