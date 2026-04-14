/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/extension/:slug",
        destination: "/package/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
