/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright is used only in Node runtime route handlers; keep it external to the bundle.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
