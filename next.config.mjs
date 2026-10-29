/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit reads bundled font metrics from disk in the Node.js runtime.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/reports/financial": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
