import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @eliteflow/db ships TypeScript source; let Next transpile it.
  transpilePackages: ['@eliteflow/db'],
  // Keep node-postgres out of the bundle (native-ish, server-only).
  serverExternalPackages: ['pg'],
  // The db package uses NodeNext-style `./x.js` specifiers that resolve to `.ts` source.
  // Teach webpack the same mapping so it can resolve them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
