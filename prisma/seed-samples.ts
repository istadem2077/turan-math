/**
 * DEVELOPMENT ONLY: fills the bank with synthetic, auto-generated questions
 * (prefixed "[Sample]") so the app can be exercised before the real bank is
 * imported. Remove them later with:  DELETE FROM "Question" WHERE "externalId" LIKE 'sample-%';
 *   npm run db:seed:samples -- 40     (questions per skill, default 40)
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import type { Difficulty, QuestionType } from "../src/generated/prisma/enums";

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

type Gen = (d: Difficulty) => { stem: string; answer: number | string; distractors?: (number | string)[] };

const scale = (d: Difficulty) => (d === "EASY" ? 1 : d === "MEDIUM" ? 3 : 7);

const GENERATORS: Record<string, Gen> = {
  LIN_EQ_1VAR: (d) => {
    const x = ri(-9, 12) * (d === "HARD" ? 1 : 1), a = ri(2, 4 + scale(d)), b = ri(-20, 20);
    return { stem: `If $${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${a * x + b}$, what is the value of $x$?`, answer: x, distractors: [x + 1, -x || 2, x + a] };
  },
  LIN_FUNC: (d) => {
    const m = ri(2, 3 + scale(d)), c = ri(-10, 15), x = ri(1, 9);
    return { stem: `The function $f$ is defined by $f(x) = ${m}x ${c < 0 ? "-" : "+"} ${Math.abs(c)}$. What is the value of $f(${x})$?`, answer: m * x + c, distractors: [m * x - c, m + x + c, m * (x + 1) + c] };
  },
  LIN_EQ_2VAR: (d) => {
    const a = ri(2, 4 + scale(d)), b = ri(2, 9), y = ri(1, 8), x = ri(1, 8);
    return { stem: `The equation $${a}x + ${b}y = ${a * x + b * y}$ is satisfied when $y = ${y}$. What is the value of $x$?`, answer: x, distractors: [x + 2, y, x * 2 + 1] };
  },
  LIN_SYSTEMS: (d) => {
    const x = ri(-5, 9), y = ri(-5, 9), a = ri(1, 2 + scale(d));
    return { stem: `$$\\begin{aligned} x + y &= ${x + y} \\\\ ${a}x - y &= ${a * x - y} \\end{aligned}$$ If $(x, y)$ is the solution to the system of equations above, what is the value of $x$?`, answer: x, distractors: [y, x + 1, x - 2] };
  },
  LIN_INEQ: (d) => {
    const a = ri(2, 3 + scale(d)), b = ri(1, 20), lim = ri(10, 60);
    const max = Math.floor((lim - b) / a);
    return { stem: `What is the greatest integer value of $n$ that satisfies $${a}n + ${b} \\le ${lim}$?`, answer: max, distractors: [max + 1, max - 1, Math.ceil((lim - b) / a) + 2] };
  },
  NONLIN_FUNC: (d) => {
    const a = ri(1, 1 + scale(d)), b = ri(1, 9), x = ri(-4, 5);
    return { stem: `The function $g$ is defined by $g(x) = ${a === 1 ? "" : a}x^2 - ${b}$. What is the value of $g(${x})$?`, answer: a * x * x - b, distractors: [a * x - b, a * x * x + b, (a * x) ** 2 - b] };
  },
  NONLIN_EQ: (d) => {
    const r1 = ri(1, 4 + scale(d)), r2 = ri(1, 9);
    const s = r1 + r2, p = r1 * r2;
    return { stem: `What is the greatest solution to the equation $x^2 - ${s}x + ${p} = 0$?`, answer: Math.max(r1, r2), distractors: [s, p, Math.min(r1, r2) - 1] };
  },
  EQUIV_EXPR: (d) => {
    const a = ri(2, 2 + scale(d)), b = ri(1, 9);
    return { stem: `Which of the following is equivalent to $${a}(x + ${b}) - ${a}x$?`, answer: a * b, distractors: [b, a + b, 2 * a * b] };
  },
  RATIOS: (d) => {
    const speed = ri(30, 30 + 10 * scale(d)), hours = ri(2, 6);
    return { stem: `A car travels at a constant speed of ${speed} miles per hour. How many miles does it travel in ${hours} hours?`, answer: speed * hours, distractors: [speed + hours, speed * (hours + 1), speed * hours / 2] };
  },
  PERCENT: (d) => {
    const base = ri(2, 20) * 20, p = pick([5, 10, 15, 20, 25, 30, 40]) + (d === "HARD" ? 5 : 0);
    return { stem: `What is $${p}\\%$ of $${base}$?`, answer: (p * base) / 100, distractors: [p + base / 10, (p * base) / 10, base - p] };
  },
  DATA_1VAR: (d) => {
    const n = 4 + scale(d) % 4, xs = Array.from({ length: n }, () => ri(1, 20));
    const sum = xs.reduce((a, b) => a + b, 0);
    const extra = n - (sum % n);
    xs.push(extra === n ? n : extra);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return { stem: `What is the mean of the data set $${xs.join(", ")}$?`, answer: Math.round(mean * 100) / 100, distractors: [Math.max(...xs), Math.min(...xs) + 1, Math.round(mean) + 2] };
  },
  DATA_2VAR: (d) => {
    const m = ri(2, 3 + scale(d)), c = ri(5, 40), x = ri(2, 12);
    return { stem: `The line of best fit for a scatterplot is $y = ${m}x + ${c}$. What $y$-value does the line predict when $x = ${x}$?`, answer: m * x + c, distractors: [m + x + c, m * x, c * x] };
  },
  PROBABILITY: (d) => {
    const r = ri(2, 10), b = ri(2, 10 + scale(d));
    return { stem: `A bag contains ${r} red marbles and ${b} blue marbles. If one marble is chosen at random, what is the probability that it is red? (Express as a fraction.)`, answer: `${r}/${r + b}`, distractors: [`${b}/${r + b}`, `${r}/${b}`, `1/${r + b}`] };
  },
  INFERENCE: (d) => {
    const est = ri(20, 80), moe = ri(2, 4 + scale(d));
    return { stem: `A survey estimates that $${est}\\%$ of residents support a proposal, with a margin of error of $${moe}\\%$. What is the greatest plausible percentage of residents who support the proposal?`, answer: est + moe, distractors: [est, est - moe, est + 2 * moe] };
  },
  STAT_CLAIMS: () => {
    const n = ri(100, 900);
    return { stem: `Researchers randomly assigned ${n} volunteers to two groups to test a new study method. What is the number of volunteers in each group if the groups are equal in size?`, answer: n % 2 === 0 ? n / 2 : (n + 1) / 2, distractors: [n, n / 4, n - 2] };
  },
  AREA_VOLUME: (d) => {
    const l = ri(2, 6 + scale(d)), w = ri(2, 9), h = ri(2, 9);
    return { stem: `A rectangular box has length ${l}, width ${w}, and height ${h}. What is the volume of the box?`, answer: l * w * h, distractors: [l + w + h, 2 * (l * w + w * h + l * h), l * w] };
  },
  LINES_ANGLES: (d) => {
    const a = ri(20, 70), b = ri(20, 80 - (scale(d) > 3 ? 0 : 10));
    return { stem: `In triangle $ABC$, the measure of angle $A$ is $${a}^\\circ$ and the measure of angle $B$ is $${b}^\\circ$. What is the measure, in degrees, of angle $C$?`, answer: 180 - a - b, distractors: [a + b, 90 - a, 360 - a - b] };
  },
  RIGHT_TRIG: () => {
    const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]);
    const k = ri(1, 3);
    return { stem: `A right triangle has legs of length ${a * k} and ${b * k}. What is the length of its hypotenuse?`, answer: c * k, distractors: [(a + b) * k, c * k + 1, b * k] };
  },
  CIRCLES: (d) => {
    const r = ri(2, 4 + scale(d));
    return { stem: `A circle in the $xy$-plane has equation $(x - 2)^2 + (y + 1)^2 = ${r * r}$. What is the radius of the circle?`, answer: r, distractors: [r * r, 2 * r, r + 1] };
  },
};

async function main() {
  const perSkill = Number(process.argv[2] ?? 40);
  const skills = await db.skill.findMany();
  if (!skills.length) throw new Error("Run `npm run db:seed` first.");
  const diffs: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
  const rows = [];
  for (const skill of skills) {
    const gen = GENERATORS[skill.code];
    if (!gen) continue;
    for (let i = 0; i < perSkill; i++) {
      const difficulty = diffs[i % 3];
      const type: QuestionType = i % 4 === 3 ? "SPR" : "MCQ";
      const q = gen(difficulty);
      const answer = String(q.answer);
      const base = {
        externalId: `sample-${skill.code}-${i}`,
        domain: skill.domain,
        skillId: skill.id,
        difficulty,
        type,
        stem: `[Sample] ${q.stem}`,
        explanation: `The correct answer is $${answer}$.`,
      };
      if (type === "SPR") {
        rows.push({ ...base, sprAnswers: [answer] });
      } else {
        const opts = [answer, ...new Set((q.distractors ?? []).map(String).filter((x) => x !== answer))];
        let k = 1;
        while (opts.length < 4) opts.push(String(Number(q.answer) + 10 * k++));
        const shuffled = opts.slice(0, 4).sort(() => Math.random() - 0.5);
        const keys = ["A", "B", "C", "D"];
        rows.push({
          ...base,
          choices: shuffled.map((t, j) => ({ key: keys[j], text: `$${t}$` })),
          correctChoice: keys[shuffled.indexOf(answer)],
        });
      }
    }
  }
  const res = await db.question.createMany({ data: rows, skipDuplicates: true });
  console.log(`Inserted ${res.count} sample questions (${rows.length - res.count} already existed).`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
