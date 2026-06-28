// Proof of Build — palette mirrors the site's ink + signal-green system.
export const ink = "#0B0B0C";
export const ink2 = "#141416";
export const paper = "#F4F1EA";
export const paper2 = "#E9E4D8";
export const signal = "#C4F542"; // signal lime/green accent
export const signalDeep = "#9BD615";
export const muted = "#6B6B70";
export const line = "rgba(255,255,255,0.08)";

// Two-font system: editorial serif display + clean mono for labels.
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const fraunces = loadFraunces("normal", { weights: ["300", "500", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const inter = loadInter("normal", { weights: ["400", "500", "700"], subsets: ["latin"] }).fontFamily;
