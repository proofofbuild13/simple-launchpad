import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fraunces, mono, ink, paper, signal } from "../theme";

// SCENE 5 — ESCROW → HIRE → END CARD (525-720 / 6.5s)
// "Fund a milestone. Pay only when it ships. Hire the builder whose prototype already works."
// Then logo end card: "Proof of Build. Build before you hire."
export const Scene5Escrow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 (0-90): escrow milestones fill. Phase 2 (90-195): zoom out to logo card.
  const ph1 = interpolate(frame, [0, 70], [0, 1], { extrapolateRight: "clamp" });
  const ph2Op = interpolate(frame, [85, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ph1Op = interpolate(frame, [85, 105], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const milestones = [
    { label: "M1 · Spec & schema",      pct: 0.25 },
    { label: "M2 · Live prototype",     pct: 0.55 },
    { label: "M3 · Production-ready",   pct: 0.85 },
  ];

  // End card animations
  const logoSp = spring({ frame: frame - 100, fps, config: { damping: 16, stiffness: 90 } });
  const tagOp = interpolate(frame, [125, 150], [0, 1], { extrapolateRight: "clamp" });
  const lineScale = interpolate(spring({ frame: frame - 110, fps, config: { damping: 200, stiffness: 80 } }), [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ background: ink, color: paper, overflow: "hidden" }}>
      {/* === PHASE 1: ESCROW === */}
      <div style={{ position: "absolute", inset: 0, opacity: ph1Op, padding: "130px 140px" }}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 3, color: "#777", marginBottom: 16 }}>
          CHAPTER · 05 — THE PAYOFF
        </div>
        <div style={{ fontFamily: fraunces, fontSize: 108, lineHeight: 0.92, letterSpacing: -3 }}>
          Pay only when<br/>it <em style={{ color: signal, fontWeight: 300 }}>ships</em>.
        </div>

        <div style={{ marginTop: 70, maxWidth: 1100, display: "flex", flexDirection: "column", gap: 22 }}>
          {milestones.map((m, i) => {
            const localStart = i * 18;
            const fill = interpolate(frame, [localStart + 10, localStart + 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const released = fill > 0.95;
            return (
              <div key={m.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 16, color: "#bbb", marginBottom: 10 }}>
                  <span>{m.label}</span>
                  <span style={{ color: released ? signal : "#777" }}>
                    {released ? "● RELEASED" : "○ ESCROW"}
                  </span>
                </div>
                <div style={{ height: 18, background: "#1f1f22", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fill * 100}%`, background: signal,
                    boxShadow: released ? `0 0 18px ${signal}` : "none" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 56, fontFamily: mono, fontSize: 18, color: "#888", letterSpacing: 2,
          opacity: interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) }}>
          ESCROW · NDA · IP-ASSIGNMENT · CONTRACT — ALL HANDLED.
        </div>
      </div>

      {/* === PHASE 2: END CARD === */}
      <div style={{ position: "absolute", inset: 0, opacity: ph2Op, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: 6, color: "#666",
          opacity: interpolate(frame, [95, 115], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) }}>
          BUILD BEFORE YOU HIRE
        </div>

        <div style={{ marginTop: 32, fontFamily: fraunces, fontSize: 180, letterSpacing: -6, lineHeight: 1,
          transform: `scale(${interpolate(logoSp,[0,1],[0.92,1])})`, opacity: logoSp, display: "flex", alignItems: "baseline", gap: 24 }}>
          <span style={{ fontWeight: 500 }}>proof</span>
          <span style={{ fontFamily: mono, fontSize: 110, color: signal, fontWeight: 400 }}>_</span>
          <span style={{ fontWeight: 300, fontStyle: "italic" }}>of</span>
          <span style={{ fontFamily: mono, fontSize: 110, color: signal, fontWeight: 400 }}>_</span>
          <span style={{ fontWeight: 500 }}>Build</span>
        </div>

        {/* Underline draw */}
        <div style={{ marginTop: 24, height: 3, background: signal, width: 520 * lineScale,
          boxShadow: `0 0 18px ${signal}` }} />

        <div style={{ marginTop: 48, fontFamily: fraunces, fontStyle: "italic", fontWeight: 300, fontSize: 38, color: "#bbb",
          opacity: tagOp, textAlign: "center", maxWidth: 900 }}>
          Hire the builder whose prototype already works.
        </div>

        <div style={{ position: "absolute", bottom: 130, fontFamily: mono, fontSize: 16, letterSpacing: 4, color: signal,
          opacity: interpolate(frame, [150, 175], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) }}>
          PROOFBUILD.IN  →  POST YOUR FIRST CHALLENGE
        </div>
      </div>
    </AbsoluteFill>
  );
};
