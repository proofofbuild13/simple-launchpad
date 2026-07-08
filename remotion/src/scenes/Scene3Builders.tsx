import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { fraunces, mono, ink, paper, signal } from "../theme";

// SCENE 3 — REAL PRODUCT MONTAGE (225-375 / 5.0s, 150 frames)
// Ken-Burns pans across actual proof_of_Build screenshots inside a macOS-style
// browser chrome. Sells the platform by showing the platform.

type Shot = { src: string; caption: string; label: string; anchor?: "tl"|"tr"|"bl"|"br"|"c" };

const shots: Shot[] = [
  { src: "shots/hero.png",       caption: "The pitch, live.",         label: "proofbuild.in",                anchor: "tl" },
  { src: "shots/challenges.png", caption: "Real briefs. Real money.", label: "proofbuild.in/browse",         anchor: "c"  },
  { src: "shots/builders.png",   caption: "Builders who ship.",       label: "proofbuild.in/#builders",      anchor: "bl" },
];

const SHOT_LEN = 50; // frames per shot (3 * 50 = 150)

const ChromeBar: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ height: 34, background: "#1c1c1f", display: "flex", alignItems: "center",
    padding: "0 14px", gap: 10, borderBottom: "1px solid #2a2a2e" }}>
    <div style={{ display: "flex", gap: 6 }}>
      {["#ff5f57","#febc2e","#28c840"].map(c => (
        <div key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />
      ))}
    </div>
    <div style={{ flex: 1, textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#888" }}>
      {url}
    </div>
  </div>
);

const ShotFrame: React.FC<{ shot: Shot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  // Gentle Ken-Burns: scale only, no translate — keeps composition intact.
  const t = frame / SHOT_LEN;
  const scale = interpolate(t, [0, 1], [1.02, 1.08]);

  const enter = spring({ frame, fps: 30, config: { damping: 22, stiffness: 90 } });
  const y = interpolate(enter, [0, 1], [30, 0]);
  const exit = interpolate(frame, [SHOT_LEN - 10, SHOT_LEN], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const op = Math.min(enter, exit);

  return (
    <AbsoluteFill style={{ opacity: op }}>
      {/* Browser frame — top area */}
      <div style={{ position: "absolute", top: 130, left: 260, right: 260, height: 760,
        transform: `translateY(${y}px)`, borderRadius: 14, overflow: "hidden",
        boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)", background: "#000" }}>
        <ChromeBar url={shot.label} />
        <div style={{ width: "100%", height: "calc(100% - 34px)", overflow: "hidden", background: "#F4F1EA" }}>
          <Img src={staticFile(shot.src)}
            style={{ width: "100%", height: "auto", display: "block",
              transform: `scale(${scale})`, transformOrigin: "center top" }} />
        </div>
      </div>

      {/* Caption bar — bottom */}
      <div style={{ position: "absolute", left: 260, right: 260, bottom: 110,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        opacity: interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" }) }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: 3, color: signal, marginBottom: 8 }}>
            LIVE · SHIPPED
          </div>
          <div style={{ fontFamily: fraunces, fontSize: 44, lineHeight: 1, letterSpacing: -0.5, color: paper }}>
            {shot.caption}
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 13, color: "#888", letterSpacing: 1 }}>
          {shot.label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Scene3Builders: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const headerY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: ink, color: paper, overflow: "hidden" }}>
      {/* Backdrop wash */}
      <div style={{ position: "absolute", inset: 0,
        background: `radial-gradient(1200px 700px at 70% 30%, ${signal}18, transparent 60%)` }} />

      {/* Chapter header */}
      <div style={{ position: "absolute", top: 60, left: 120, right: 120, display: "flex",
        justifyContent: "space-between", alignItems: "baseline", zIndex: 5,
        opacity: headerOp, transform: `translateY(${headerY}px)` }}>
        <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: 3, color: "#888" }}>
          CHAPTER · 03 — THE PLATFORM
        </div>
        <div style={{ fontFamily: mono, fontSize: 14, letterSpacing: 2, color: signal, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: signal, boxShadow: `0 0 12px ${signal}` }} />
          PROOFBUILD.IN
        </div>
      </div>

      {/* Shot sequence */}
      {shots.map((shot, i) => (
        <Sequence key={shot.src} from={i * SHOT_LEN} durationInFrames={SHOT_LEN}>
          <ShotFrame shot={shot} />
        </Sequence>
      ))}

      {/* Progress ticks */}
      <div style={{ position: "absolute", bottom: 60, left: 120, display: "flex", gap: 10, zIndex: 5 }}>
        {shots.map((_, i) => {
          const active = frame >= i * SHOT_LEN && frame < (i + 1) * SHOT_LEN;
          const past = frame >= (i + 1) * SHOT_LEN;
          return (
            <div key={i} style={{ width: 44, height: 3, background: active || past ? signal : "#333", opacity: active ? 1 : past ? 0.6 : 1,
              boxShadow: active ? `0 0 10px ${signal}` : "none" }} />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
