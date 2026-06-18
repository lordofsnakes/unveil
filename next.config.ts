import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in a parent dir isn't picked up.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Native/binary packages used by the auto-blur server code must NOT be bundled
  // (the ffmpeg/ffprobe installers ship platform binaries + non-JS files the
  // bundler can't trace). Load them from node_modules at runtime instead.
  serverExternalPackages: [
    "sharp",
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "fluent-ffmpeg",
    "replicate",
  ],
  // sharp loads its native libvips .so via a dynamic require the file tracer
  // can't follow, so force the platform binaries into the blur functions.
  outputFileTracingIncludes: {
    "/api/blur/**": ["./node_modules/@img/**", "./node_modules/sharp/**"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.private.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable the service worker in dev so Turbopack HMR isn't interfered with.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
