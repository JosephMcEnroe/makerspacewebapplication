/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit reads bundled font metrics from disk in the Node.js runtime.
  serverExternalPackages: ["pdfkit"],
  async redirects() {
    return [
      { source: "/stripe/checkout/success", destination: "/membership/checkout-return", permanent: false },
      { source: "/stripe/checkout", destination: "/membership?cancelled=true", permanent: false },
    ];
  },
  outputFileTracingIncludes: {
    "/api/reports/financial": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
