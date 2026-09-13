"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Plays public/demo.mp4 beside the headline. Until that file exists the panel
 * hides itself rather than leaving an empty box on the landing page.
 */
export function DemoVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (
      video?.error ||
      video?.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
    ) {
      setFailed(true);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video?.pause();
    }
  }, []);

  if (failed) return null;

  return (
    <div
      className={cn(
        "border-border/70 bg-card relative aspect-[4/3] w-full overflow-hidden rounded-xl border shadow-sm sm:aspect-[16/10]",
        className,
      )}
    >
      <video
        ref={videoRef}
        className="size-full object-cover"
        src="/demo.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="A walkthrough of Clairo reading a lab report"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={() => {
          const video = videoRef.current;
          if (video?.paused) void video.play();
          else video?.pause();
        }}
        aria-label={playing ? "Pause the demo" : "Play the demo"}
        className="rounded-pill border-border/70 bg-card/75 text-foreground hover:bg-card focus-visible:ring-ring/50 absolute right-3 bottom-3 flex size-9 items-center justify-center border backdrop-blur-md transition focus-visible:ring-[3px] focus-visible:outline-none"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  );
}
