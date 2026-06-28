import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Flip } from "./scenes/Scene2Flip";
import { Scene3Builders } from "./scenes/Scene3Builders";
import { Scene4AI } from "./scenes/Scene4AI";
import { Scene5Escrow } from "./scenes/Scene5Escrow";
import { Chrome } from "./components/Chrome";
import { Grain } from "./components/Grain";
import { ink } from "./theme";

// Scene boundaries (30fps). VO clip is 22.1s.
// 1 Hook         0  – 90    (3.0s)
// 2 Flip        90  – 225   (4.5s)
// 3 Builders   225  – 375   (5.0s)
// 4 AI         375  – 525   (5.0s)
// 5 Escrow/End 525  – 720   (6.5s)
export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  // Letterboxed cinematic feel — bars ease in over the first 12 frames, hold, fade at end.
  const bar = interpolate(frame, [0, 12, 700, 720], [120, 80, 80, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: ink }}>
      <Audio src={staticFile("audio/vo.mp3")} />

      <Sequence from={0} durationInFrames={90}><Scene1Hook /></Sequence>
      <Sequence from={90} durationInFrames={135}><Scene2Flip /></Sequence>
      <Sequence from={225} durationInFrames={150}><Scene3Builders /></Sequence>
      <Sequence from={375} durationInFrames={150}><Scene4AI /></Sequence>
      <Sequence from={525} durationInFrames={195}><Scene5Escrow /></Sequence>

      <Grain opacity={0.06} />
      {/* Cinematic letterbox */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar, background: "#000", zIndex: 50 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bar, background: "#000", zIndex: 50 }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 60 }}><Chrome /></div>
    </AbsoluteFill>
  );
};
