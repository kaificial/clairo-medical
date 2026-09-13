import type { NextConfig } from "next";

// Imported for its side effect: a bad environment variable fails the build
// right here, with a readable message, instead of at runtime.
import "./src/env";

const nextConfig: NextConfig = {};

export default nextConfig;
