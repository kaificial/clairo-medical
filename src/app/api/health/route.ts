import { chatEnabled, embeddingsEnabled } from "@/lib/ai/server";

import { version } from "../../../../package.json";

// Answer fresh every time; a cached "ok" would hide a server that is down.
export const dynamic = "force-dynamic";

/**
 * A quick "are you alive?" check for uptime monitors, the Docker health check,
 * and deploy smoke tests. It says which features are switched on, never which
 * keys or models are behind them.
 */
export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      version,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      features: {
        chat: chatEnabled,
        cloudSearch: embeddingsEnabled,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
