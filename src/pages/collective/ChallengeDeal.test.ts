import { describe, it, expect } from "vitest";
import { stepIndexForStatus, CHALLENGE_STEPS } from "./ChallengeDeal";

describe("challenge timeline", () => {
  it("has the six steps in order", () => {
    expect([...CHALLENGE_STEPS]).toEqual(["Apply", "Approved", "Build", "Submit", "Reviewed", "Winner"]);
  });
  it("approved applicants are in the Build step", () => {
    expect(stepIndexForStatus("approved")).toBe(2);
  });
  it("winner reaches the final step", () => {
    expect(stepIndexForStatus("winner")).toBe(5);
  });
});
