import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {},
  // Ships a self-contained server bundle so the Docker image stays small.
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  // Runtime state lives beside the code in development. It is mounted as a
  // volume in production and must never be traced into the build output.
  outputFileTracingExcludes: {
    '*': ['storage/**', 'data/**', 'waha/**', 'docs/**', '.wwebjs_cache/**'],
  },
  // The Google Sheets guide reads this script from disk rather than duplicating
  // it, so the standalone build has to carry the file.
  outputFileTracingIncludes: {
    '/help/google-sheets': ['scripts/apps-script/capture.gs'],
  },
}

export default nextConfig
