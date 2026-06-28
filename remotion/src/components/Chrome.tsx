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
      <div style={{ position: "absolute", top: 28, left: 64, display: "flex", alignItems: "center", gap: 12, fontFamily: mono, fontSize: 14, color: "#999", letterSpacing: 2 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: signal, boxShadow: `0 0 12px ${signal}` }} />
        PROOF_OF_BUILD · FILM 001
      </div>
      <div style={{ position: "absolute", top: 28, right: 64, fontFamily: mono, fontSize: 14, color: "#999", letterSpacing: 2 }}>{tc}</div>
      <div style={{ position: "absolute", bottom: 28, left: 64, fontFamily: mono, fontSize: 12, color: "#777", letterSpacing: 3 }}>
        EXECUTION-BASED HIRING · MMXXVI
      </div>
      <div style={{ position: "absolute", bottom: 28, right: 64, fontFamily: mono, fontSize: 12, color: "#777", letterSpacing: 3 }}>
        REEL · 01 / 05
      </div>
    </div>
  );
};
