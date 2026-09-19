import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://wallet-ia-c8e77.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://wallet-ia-c8e77.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
