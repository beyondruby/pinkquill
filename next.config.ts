import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    // Use modern image formats for better compression
    formats: ["image/avif", "image/webp"],
    // Define device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Define image sizes for srcset generation
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize image quality to reduce size while maintaining appearance
    minimumCacheTTL: 31536000, // 1 year cache for optimized images
  },
  // Optimize CSS delivery
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
