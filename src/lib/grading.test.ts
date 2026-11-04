import { describe, expect, it } from "vitest";
import { estimateScaled, isCorrect, isSprCorrect, isValidSprInput } from "./grading";

describe("SPR grading", () => {
  it("accepts equivalent forms", () => {
    expect(isSprCorrect("3.5", ["7/2"])).toBe(true);
    expect(isSprCorrect("3.50", ["7/2"])).toBe(true);
    expect(isSprCorrect("7/2", ["3.5"])).toBe(true);
    expect(isSprCorrect("14/4", ["7/2"])).toBe(true);
    expect(isSprCorrect(" -2 ", ["-2"])).toBe(true);
    expect(isSprCorrect(".5", ["1/2"])).toBe(true);
  });
  it("accepts rounded or truncated decimals only when they fill the space", () => {
    expect(isSprCorrect(".6666", ["2/3"])).toBe(true);
    expect(isSprCorrect(".6667", ["2/3"])).toBe(true);
    expect(isSprCorrect("0.666", ["2/3"])).toBe(true);
    expect(isSprCorrect("0.667", ["2/3"])).toBe(true);
    expect(isSprCorrect(".66", ["2/3"])).toBe(false);
    expect(isSprCorrect("0.67", ["2/3"])).toBe(false);
    expect(isSprCorrect("-.3333", ["-1/3"])).toBe(true);
    expect(isSprCorrect("-.33", ["-1/3"])).toBe(false);
  });
  it("rejects wrong or empty answers", () => {
    expect(isSprCorrect("4", ["7/2"])).toBe(false);
    expect(isSprCorrect("", ["0"])).toBe(false);
    expect(isSprCorrect(null, ["0"])).toBe(false);
    expect(isSprCorrect("1/0", ["0"])).toBe(false);
  });
  it("validates Bluebook input length", () => {
    expect(isValidSprInput("12345")).toBe(true);
    expect(isValidSprInput("123456")).toBe(false);
    expect(isValidSprInput("-12345")).toBe(true);
    expect(isSprCorrect("3 1/2", ["7/2"])).toBe(false);
    expect(isValidSprInput("$5")).toBe(false);
  });
});

describe("MCQ grading", () => {
  it("compares the key", () => {
    expect(isCorrect({ type: "MCQ", correctChoice: "B", sprAnswers: [] }, "B")).toBe(true);
    expect(isCorrect({ type: "MCQ", correctChoice: "B", sprAnswers: [] }, "C")).toBe(false);
    expect(isCorrect({ type: "MCQ", correctChoice: "B", sprAnswers: [] }, null)).toBe(false);
  });
});

describe("scaled estimate", () => {
  it("is monotonic and bounded", () => {
    let prev = 0;
    for (let r = 0; r <= 44; r++) {
      const s = estimateScaled(r);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s % 10).toBe(0);
      prev = s;
    }
    expect(estimateScaled(0)).toBe(200);
    expect(estimateScaled(44)).toBe(800);
  });
});
