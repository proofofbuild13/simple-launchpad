import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fraunces, mono, ink, paper, signal } from "../theme";

// SCENE 4 — AI EVALUATION (375-525 / 5.0s)
// "AI scores every submission in minutes."
// A scoring panel: rows of submissions get analysed and graded.
const rows = [
  { name: "M. Okafor",   final: 92, grade: "A" },
  { name: "J. Tanaka",   final: 88, grade: "A" },
  { name: "Pixel/Iron",  final: 81, grade: "B" },
  { name: "Lin & co.",   final: 74, grade: "B" },
  { name: "K. Ahmed",    final: 63, grade: "C" },
];

export const Scene4AI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSp = spring({ frame, fps, config: { damping: 18 } });
  const titleY = interpolate(titleSp, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ background: ink, color: paper, padding: "130px 140px", overflow: "hidden" }}>
      {/* Faint scanning line */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${signal}, transparent)`,
        top: interpolate(frame % 90, [0, 90], [0, 1080]), opacity: 0.4 }} />

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", opacity: titleSp,
        transform: `translateY(${titleY}px)` }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 3, color: "#777", marginBottom: 16 }}>
            CHAPTER · 04 — THE JUDGEMENT
          </div>
          <div style={{ fontFamily: fraunces, fontSize: 112, lineHeight: 0.92, letterSpacing: -3 }}>
            AI grades<br/>every <em style={{ color: signal, fontWeight: 300 }}>build</em>.
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 14, color: "#777", textAlign: "right", letterSpacing: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <div style={{ width: 8, height: 8, background: signal, borderRadius: 99, boxShadow: `0 0 12px ${signal}` }} />
            GEMINI · EVAL v2
          </div>
          <div style={{ marginTop: 4 }}>MARKET · MODEL · MOAT · GTM · INVEST</div>
        </div>
      </div>

      {/* Score rows */}
      <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 18 }}>
        {rows.map((r, i) => {
          const start = 25 + i * 12;
          const op = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const fillP = interpolate(frame, [start + 8, start + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const score = Math.round(r.final * fillP);
          const grade = fillP > 0.95 ? r.grade : "·";
          return (
            <div key={r.name} style={{ display: "grid", gridTemplateColumns: "240px 1fr 100px 80px",
              alignItems: "center", gap: 24, opacity: op, padding: "14px 20px", borderTop: "1px solid #2a2a2e", borderBottom: "1px solid #2a2a2e" }}>
              <div style={{ fontFamily: fraunces, fontSize: 30 }}>{r.name}</div>
              <div style={{ height: 14, background: "#1f1f22", borderRadius: 99, overflow: "hidden", position: "relative" }}>
                <div style={{ width: `${fillP * r.final}%`, height: "100%", background: signal, transition: "none",
                  boxShadow: fillP > 0.95 ? `0 0 16px ${signal}` : "none" }} />
              </div>
              <div style={{ fontFamily: mono, fontSize: 32, textAlign: "right" }}>{score}</div>
              <div style={{ fontFamily: fraunces, fontSize: 44, fontWeight: 700, color: fillP > 0.95 ? signal : "#555", textAlign: "center" }}>
                {grade}
              </div>
            </div>
          );
        })}
      </div>

      {/* Caption */}
      <div style={{ position: "absolute", bottom: 100, left: 140, fontFamily: mono, fontSize: 16, color: "#888", letterSpacing: 1,
        opacity: interpolate(frame, [110, 140], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) }}>
        SHORTLIST READY · 2 MIN 14 SEC
      </div>
    </AbsoluteFill>
  );
};
