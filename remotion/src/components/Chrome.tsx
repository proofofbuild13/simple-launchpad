import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { mono, signal } from "../theme";

// Persistent corner chrome: ticker + timecode, like an editorial film slate.
export const Chrome: React.FC<{ color?: string }> = ({ color = "#6B6B70" }) => {
  const frame = useCurrentFrame();
  const tc = `T+${String(Math.floor(frame / 30)).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}>
      <div style={{ position: "absolute", top: 48, left: 64, display: "flex", alignItems: "center", gap: 12, fontFamily: mono, fontSize: 16, color, letterSpacing: 1 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: signal, boxShadow: `0 0 12px ${signal}` }} />
        PROOF_OF_BUILD / FILM 001
      </div>
      <div style={{ position: "absolute", top: 48, right: 64, fontFamily: mono, fontSize: 16, color, letterSpacing: 1 }}>{tc}</div>
      <div style={{ position: "absolute", bottom: 48, left: 64, fontFamily: mono, fontSize: 14, color, letterSpacing: 2 }}>
        EXECUTION-BASED HIRING · MMXXVI
      </div>
      <div style={{ position: "absolute", bottom: 48, right: 64, fontFamily: mono, fontSize: 14, color, letterSpacing: 2 }}>
        REEL · 01 / 05
      </div>
    </div>
  );
};
