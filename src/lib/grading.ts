/** Scoring rules for MCQ and student-produced responses (SPR). */

const NUMERIC = /^-?(\d+\.?\d*|\.\d+)$/;
const FRACTION = /^-?\d+\/\d+$/;

export function normalizeSpr(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[−–]/g, "-");
}

export function parseSprNumber(raw: string): number | null {
  const s = normalizeSpr(raw);
  if (NUMERIC.test(s)) return Number(s);
  if (FRACTION.test(s)) {
    const neg = s.startsWith("-");
    const [n, d] = s.replace("-", "").split("/").map(Number);
    if (d === 0) return null;
    return (neg ? -1 : 1) * (n / d);
  }
  return null;
}

/** Bluebook entry rules: max 5 characters, 6 including a leading minus sign. */
export function isValidSprInput(raw: string): boolean {
  const s = normalizeSpr(raw);
  if (s === "") return true;
  if (!/^-?[0-9./]*$/.test(s)) return false;
  return s.length <= (s.startsWith("-") ? 6 : 5);
}

function decimals(s: string): number {
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

export function isSprCorrect(answer: string | null | undefined, accepted: string[]): boolean {
  if (!answer) return false;
  const a = normalizeSpr(answer);
  if (a === "") return false;
  const aNum = parseSprNumber(a);
  for (const acc of accepted) {
    const b = normalizeSpr(acc);
    if (a === b) return true;
    const bNum = parseSprNumber(b);
    if (aNum === null || bNum === null) continue;
    if (Math.abs(aNum - bNum) < 1e-9) return true;
    // A decimal that fills the whole answer space may be rounded or truncated.
    if (NUMERIC.test(a) && a.includes(".")) {
      const full = a.length >= (a.startsWith("-") ? 6 : 5);
      const d = decimals(a);
      if (full && d > 0) {
        const p = 10 ** d;
        const rounded = Math.round(bNum * p) / p;
        const truncated = Math.trunc(bNum * p) / p;
        if (Math.abs(aNum - rounded) < 1e-9 || Math.abs(aNum - truncated) < 1e-9) return true;
      }
    }
  }
  return false;
}

export function isCorrect(
  q: { type: "MCQ" | "SPR"; correctChoice: string | null; sprAnswers: string[] },
  answer: string | null | undefined,
): boolean {
  if (q.type === "MCQ") return !!answer && answer === q.correctChoice;
  return isSprCorrect(answer, q.sprAnswers);
}

/**
 * Approximate raw (0–44) to scaled (200–800) conversion. Real SAT scaling is
 * adaptive and form-specific; this curve is an estimate modelled on published
 * Bluebook practice-test conversions.
 */
const SCALE: [number, number][] = [
  [0, 200], [3, 240], [6, 300], [10, 360], [15, 420], [20, 480],
  [25, 530], [30, 580], [35, 640], [40, 720], [42, 760], [43, 780], [44, 800],
];

export function estimateScaled(raw: number, total = 44): number {
  const r = Math.max(0, Math.min(44, (raw / total) * 44));
  for (let i = 1; i < SCALE.length; i++) {
    const [r0, s0] = SCALE[i - 1];
    const [r1, s1] = SCALE[i];
    if (r <= r1) return Math.round((s0 + ((r - r0) / (r1 - r0)) * (s1 - s0)) / 10) * 10;
  }
  return 800;
}
