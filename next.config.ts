import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vsbwrxcarifuwrutybsn.supabase.co",
      },
    ],
  },
};

export default nextConfig;
