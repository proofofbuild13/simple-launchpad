import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fraunces, mono, ink, paper, signal } from "../theme";

// SCENE 2 — FLIP (90-225 / 4.5s)
// "Proof of Build flips the script. Post a real challenge."
// Massive logotype reveal on ink, with a "challenge brief" card sliding in.
export const Scene2Flip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry: type strikes through from left.
  const wipe = interpolate(frame, [0, 28], [-100, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const cardSpring = spring({ frame: frame - 50, fps, config: { damping: 18, stiffness: 110 } });
  const cardX = interpolate(cardSpring, [0, 1], [600, 0]);

  // Stamp: "POSTED" appears around frame 95
  const stamp = spring({ frame: frame - 95, fps, config: { damping: 6, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ background: ink, color: paper, overflow: "hidden" }}>
      {/* Diagonal signal sweep */}
      <div style={{ position: "absolute", inset: 0,
        background: `linear-gradient(115deg, transparent 40%, ${signal}11 50%, transparent 60%)`,
        transform: `translateX(${interpolate(frame, [0, 135], [-800, 800])}px)` }} />

      {/* Massive serif headline */}
      <div style={{ position: "absolute", left: 140, top: 220, maxWidth: 1100, overflow: "hidden" }}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 3, color: "#777", marginBottom: 28 }}>
          CHAPTER · 02 — THE FLIP
        </div>
        <div style={{ fontFamily: fraunces, fontSize: 168, lineHeight: 0.92, letterSpacing: -5,
          transform: `translateX(${wipe}%)` }}>
          Post the<br/>
          <em style={{ color: signal, fontWeight: 300 }}>challenge.</em>
        </div>
        <div style={{ marginTop: 36, fontFamily: mono, fontSize: 22, color: "#aaa", letterSpacing: 1, opacity: subOp, maxWidth: 720 }}>
          Real brief. Real budget. Real deadline.<br/>Public, unlisted, or invite-only.
        </div>
      </div>

      {/* Right-side "brief card" */}
      <div style={{ position: "absolute", right: 140, top: 200, width: 520,
        transform: `translateX(${cardX}px)`, opacity: cardSpring }}>
        <div style={{ background: paper, color: ink, borderRadius: 18, padding: 36, boxShadow: "0 40px 120px rgba(0,0,0,0.5)",
          position: "relative", overflow: "hidden" }}>
          <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: 2, color: "#888" }}>BRIEF · #4821</div>
          <div style={{ fontFamily: fraunces, fontSize: 38, lineHeight: 1.05, marginTop: 12 }}>
            Real-time fraud<br/>signal dashboard
          </div>
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontFamily: mono, fontSize: 13 }}>
            <div><div style={{ color: "#888" }}>BUDGET</div><div style={{ fontSize: 18 }}>$8,400</div></div>
            <div><div style={{ color: "#888" }}>DEADLINE</div><div style={{ fontSize: 18 }}>14 days</div></div>
            <div><div style={{ color: "#888" }}>STACK</div><div style={{ fontSize: 18 }}>TS · Supabase</div></div>
            <div><div style={{ color: "#888" }}>SLOTS</div><div style={{ fontSize: 18 }}>3 finalists</div></div>
          </div>
          {/* Stamp */}
          <div style={{ position: "absolute", right: -10, top: 24, transform: `rotate(${interpolate(stamp,[0,1],[-30,-8])}deg) scale(${stamp})`,
            border: `4px solid ${signal}`, color: signal, padding: "10px 22px", fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 4,
            background: ink, borderRadius: 6, opacity: stamp }}>
            POSTED
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
