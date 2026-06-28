import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fraunces, mono, ink, paper, signal } from "../theme";

// SCENE 1 — HOOK (0-90 / 3.0s)
// "Hiring developers is broken. Resumes lie. Interviews waste weeks."
// Editorial typography reveal — three words stagger on a cream paper background,
// then a hard cut to ink wash with a redacted resume line.
export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background flips from paper -> ink around frame 60 (problem deepens).
  const bg = frame < 58 ? paper : ink;
  const fg = frame < 58 ? ink : paper;

  const word1 = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const word2 = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 90 } });
  const word3 = spring({ frame: frame - 22, fps, config: { damping: 14, stiffness: 90 } });
  const flash = interpolate(frame, [58, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const strike = interpolate(frame, [70, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const W = (p: number, txt: string, italic?: boolean) => (
    <span style={{
      display: "inline-block",
      transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
      opacity: p,
      fontStyle: italic ? "italic" : "normal",
      fontWeight: italic ? 300 : 500,
      color: italic ? signal : fg,
    }}>{txt}</span>
  );

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {/* Paper texture grid */}
      <div style={{ position: "absolute", inset: 0, opacity: frame < 58 ? 0.5 : 0.12,
        backgroundImage: `linear-gradient(${fg}10 1px, transparent 1px), linear-gradient(90deg, ${fg}10 1px, transparent 1px)`,
        backgroundSize: "80px 80px" }} />

      {/* Flash transition */}
      <div style={{ position: "absolute", inset: 0, background: signal, opacity: flash * 0.4 }} />

      <div style={{ position: "absolute", left: 160, top: "32%", maxWidth: 1500 }}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 3, color: frame < 58 ? "#888" : "#777", marginBottom: 24,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }) }}>
          CHAPTER · 01 — THE PROBLEM
        </div>
        <div style={{ fontFamily: fraunces, fontSize: 180, lineHeight: 0.95, letterSpacing: -4 }}>
          {W(word1, "Hiring ")}{W(word2, "is ")}{W(word3, "broken", true)}{W(word3, ".")}
        </div>

        {/* Redacted "Résumé" callout — appears after flip */}
        <div style={{ marginTop: 56, opacity: interpolate(frame, [62, 76], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontFamily: mono, fontSize: 22, color: fg, letterSpacing: 2, display: "flex", gap: 18, alignItems: "center" }}>
          <span style={{ color: "#888" }}>RÉSUMÉ.PDF</span>
          <span style={{ position: "relative", display: "inline-block" }}>
            <span style={{ color: fg }}>SHIPPED · LED · ARCHITECTED · 10X ENGINEER</span>
            <span style={{ position: "absolute", left: 0, top: "50%", height: 3, background: signal,
              width: `${strike * 100}%`, transform: "translateY(-50%)" }} />
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
