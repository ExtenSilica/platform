/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
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
