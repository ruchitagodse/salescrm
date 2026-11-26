import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ['pdfkit', 'nodemailer'],
  outputFileTracingIncludes: { '/**': ['./src/assets/fonts/*'] },
};

export default nextConfig;
