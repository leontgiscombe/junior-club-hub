import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The drill pack's session-plan files are read from disk by this route.
  outputFileTracingIncludes: {
    "/api/training/files": ["./drill-pack/files/**/*"],
  },
  // The players' Training Hub is one self-contained page in public/; serve it
  // at /training-hub as well as /training-hub/index.html. Financial Admin is
  // the same, at /finance.
  async rewrites() {
    return [
      { source: "/training-hub", destination: "/training-hub/index.html" },
      { source: "/finance", destination: "/finance/index.html" },
    ];
  },
  // The coaches' tools moved under /admin (Coach Admin) — keep the old links
  // working for anyone who bookmarked them. Query strings (?key=…) are
  // forwarded automatically.
  async redirects() {
    return [
      { source: "/kit/admin", destination: "/admin/kit", permanent: false },
      { source: "/kit/:team/admin", destination: "/admin/kit/:team", permanent: false },
      { source: "/camera", destination: "/admin/camera", permanent: false },
      { source: "/stats", destination: "/admin/stats", permanent: false },
      {
        source: "/stats/presentation",
        destination: "/admin/stats/presentation",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
