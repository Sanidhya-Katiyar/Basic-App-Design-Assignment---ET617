import { useEffect, useRef, useState } from "react";
import { track } from "../track";

// A tracked HTML5 video player. Emits: play, pause, seek, rate change,
// progress milestones (25/50/75%), completion, and fullscreen toggle — the
// full range of "video actions" the assignment asks us to capture.

export function VideoPlayer({ src, title, targetId }: { src: string; title: string; targetId: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastTime = useRef(0);
  const milestones = useRef<Set<number>>(new Set());
  const [feed, setFeed] = useState<{ t: string; n: string }[]>([]);

  const log = (event_name: string, extra: Record<string, any> = {}) => {
    track(event_name, {
      component: "Media", target_type: "video", target_id: targetId, title, ...extra,
    });
    setFeed((f) => [{ t: new Date().toLocaleTimeString(), n: event_name }, ...f].slice(0, 12));
  };

  useEffect(() => {
    const v = ref.current!;
    const onPlay = () => log("Video played", { at: v.currentTime });
    const onPause = () => { if (!v.ended) log("Video paused", { at: v.currentTime }); };
    const onRate = () => log("Video playback rate changed", { rate: v.playbackRate, at: v.currentTime });
    const onEnded = () => log("Video completed", { at: v.duration });
    const onSeeked = () => {
      const from = lastTime.current;
      if (Math.abs(v.currentTime - from) > 1) log("Video seeked", { from, at: v.currentTime });
    };
    const onTimeUpdate = () => {
      lastTime.current = v.currentTime;
      if (!v.duration) return;
      const pct = (v.currentTime / v.duration) * 100;
      for (const m of [25, 50, 75]) {
        if (pct >= m && !milestones.current.has(m)) {
          milestones.current.add(m);
          log("Video progress", { percent: m, at: v.currentTime });
        }
      }
    };
    const onFs = () => log("Video fullscreen toggled", { meta: { fullscreen: document.fullscreenElement === v } });

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ratechange", onRate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("fullscreenchange", onFs);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ratechange", onRate);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("fullscreenchange", onFs);
    };
  }, [targetId]);

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <div className="video-shell">
        <video ref={ref} src={src} controls preload="metadata" playsInline />
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Video events (live)</strong>
          <span className="badge-live"><span className="pulse" /> capturing</span>
        </div>
        <div className="event-feed">
          {feed.length === 0 && <div className="muted" style={{ padding: 8 }}>Press play, seek, or change speed — events appear here.</div>}
          {feed.map((e, i) => (
            <div className="ev" key={i}><span className="t">{e.t}</span><span className="n">{e.n}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
