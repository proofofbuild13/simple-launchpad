import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fraunces, mono, ink, paper, signal } from "../theme";

// SCENE 3 — BUILDERS SHIP (225-375 / 5.0s)
// "Builders ship working prototypes." — grid of submissions populating in.
const submissions = [
  { name: "M. Okafor",      url: "fraud-v1.vercel.app",   stack: "Next + Supabase" },
  { name: "J. Tanaka",      url: "signal-demo.fly.dev",   stack: "Remix + Postgres" },
  { name: "Lin & co.",      url: "ship.prototype.io",     stack: "Astro + Drizzle" },
  { name: "R. Costa",       url: "fraudwatch.live",       stack: "Solid + Convex" },
  { name: "K. Ahmed",       url: "anomaly-feed.app",      stack: "Sveltekit + d1" },
  { name: "Pixel/Iron",     url: "iron-fraud.dev",        stack: "Next + ClickHouse" },
];

export const Scene3Builders: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const headerY = interpolate(frame, [0, 20], [40, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: paper, color: ink, padding: "140px 120px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
        opacity: headerOp, transform: `translateY(${headerY}px)` }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 3, color: "#666", marginBottom: 18 }}>
            CHAPTER · 03 — THE WORK
          </div>
          <div style={{ fontFamily: fraunces, fontSize: 108, lineHeight: 0.92, letterSpacing: -3 }}>
            Builders <em style={{ fontWeight: 300, color: signal, WebkitTextStroke: `1px ${ink}` }}>ship</em>.
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 16, color: "#666", letterSpacing: 2, textAlign: "right" }}>
          BRIEF #4821<br/>
          <span style={{ color: ink, fontSize: 22 }}>
            {String(Math.min(submissions.length, Math.floor(interpolate(frame, [20, 110], [0, 6.5], { extrapolateRight: "clamp" }))))} / 6 prototypes received
          </span>
        </div>
      </div>

      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
        {submissions.map((s, i) => {
          const delay = 30 + i * 12;
          const sp = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120 } });
          const scale = interpolate(sp, [0, 1], [0.92, 1]);
          const y = interpolate(sp, [0, 1], [40, 0]);
          return (
            <div key={s.name} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${ink}15`,
              padding: 22, opacity: sp, transform: `translateY(${y}px) scale(${scale})`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.06)" }}>
              {/* Faux prototype window */}
              <div style={{ background: ink, borderRadius: 8, height: 150, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 6 }}>
                  {["#ff5f57", "#febc2e", "#28c840"].map(c => (
                    <div key={c} style={{ width: 9, height: 9, borderRadius: 99, background: c, opacity: 0.7 }} />
                  ))}
                </div>
                {/* Animated bars representing UI */}
                <div style={{ position: "absolute", left: 16, top: 40, right: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[0,1,2,3].map(b => {
                    const w = interpolate((frame + i * 7 + b * 9) % 90, [0, 45, 90], [40, 95, 60]);
                    const c = b === 0 ? signal : "#3a3a3e";
                    return <div key={b} style={{ height: 8, width: `${w}%`, background: c, borderRadius: 99 }} />;
                  })}
                </div>
                <div style={{ position: "absolute", bottom: 10, right: 14, fontFamily: mono, fontSize: 10, color: "#666" }}>
                  ▶ live
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: fraunces, fontSize: 22, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "#888" }}>{s.stack}</div>
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: "#666", marginTop: 4 }}>{s.url}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
