/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  optimizeFonts: true,
  experimental: {
    outputFileTracingIncludes: {
      "/*": [
        "./submodules/EIPs/EIPS/*.md",
        "./submodules/ERCs/ERCS/*.md",
        "./submodules/RIPs/RIPS/*.md",
        "./submodules/CAIPs/CAIPs/*.md",
      ],
    },
  },
};

export default nextConfig;
