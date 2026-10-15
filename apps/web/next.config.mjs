/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${gatewayUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${gatewayUrl}/auth/:path*`,
      },
      {
        source: '/integrations/:path*',
        destination: `${gatewayUrl}/integrations/:path*`,
      },
    ];
  },
};

export default nextConfig;
