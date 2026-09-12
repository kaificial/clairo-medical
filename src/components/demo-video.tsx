"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const SRC = "/demo.mp4";
const POSTER_ALT =
  "Clairo beside a discharge summary, listing which lab results are out of range";

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

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) video?.pause();
  }, []);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) void video.play();
    else video.pause();
  }

  return (
    <div
      className={cn(
        "border-border/70 bg-card relative aspect-[4/3] w-full overflow-hidden rounded-xl border shadow-sm sm:aspect-[16/10]",
        className,
      )}
    >
      <Image
        src="/demo-poster.webp"
        alt={POSTER_ALT}
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="object-cover object-left-top dark:hidden"
        priority
      />
      <Image
        src="/demo-poster-dark.webp"
        alt={POSTER_ALT}
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="hidden object-cover object-left-top dark:block"
      />

      {failed ? null : (
        <>
          <video
            ref={videoRef}
            className="relative size-full object-cover"
            src={SRC}
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
            onClick={toggle}
            aria-label={playing ? "Pause the demo" : "Play the demo"}
            className="rounded-pill border-border/70 bg-card/75 text-foreground hover:bg-card focus-visible:ring-ring/50 absolute right-3 bottom-3 flex size-9 items-center justify-center border backdrop-blur-md transition focus-visible:ring-[3px] focus-visible:outline-none"
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
