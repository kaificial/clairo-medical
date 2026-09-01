import type { NextConfig } from "next";

// Validate environment variables at build start; fail fast on a bad config.
import "./src/env";

const nextConfig: NextConfig = {
  // Options land with the milestones that need them (PPR, bundle analysis, …).
};

export default nextConfig;
