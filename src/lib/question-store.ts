/**
 * Writing imported questions to the database, shared by the web import
 * (Question bank → Import) and scripts/import-questions.ts, and the matching
 * export. Figures travel with the questions:
 *   ![alt](figure:file.svg)              → read from a folder (CLI --figures)
 *   ![alt](data:image/png;base64,…)      → embedded (what the export writes)
 * Both are stored as Assets and rewritten to /api/assets/<id>.
 */
import { createHash } from "node:crypto";
import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";
import type { toQuestionData } from "./question-import";
import { MCQ_KEYS, type Choice } from "./taxonomy";

export type Row = ReturnType<typeof toQuestionData>["ok"][number];

const FIGURE_REF = /\]\(figure:([^)\s]+)\)/g;
const DATA_REF = /\]\((data:(image\/[\w+.-]+);base64,([A-Za-z0-9+/=]+))\)/g;
const ASSET_REF = /\]\(\/api\/assets\/([a-z0-9]+)\)/g;

const FIGURE_MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/** Stores referenced figures as Assets and rewrites the links. Returns how many were stored. */
async function storeFigures(rows: Row[], figureFile?: (name: string) => Buffer): Promise<number> {
  const stored = new Map<string, string>(); // file name or content hash → asset id
  const resolve = async (text: string | null | undefined) => {
    if (!text) return text;
    let out = text;
    for (const [, name] of text.matchAll(FIGURE_REF)) {
      if (!stored.has(name)) {
        if (!figureFile) throw new Error(`Question text references figure:${name}; import it with the command-line script and --figures <dir>.`);
        const mimeType = FIGURE_MIME[name.split(".").pop()!.toLowerCase()];
        if (!mimeType) throw new Error(`Unsupported figure type: ${name}`);
        const asset = await db.asset.create({ data: { mimeType, filename: name, data: new Uint8Array(figureFile(name)) }, select: { id: true } });
        stored.set(name, asset.id);
      }
    }
    out = out.replace(FIGURE_REF, (_, name: string) => `](/api/assets/${stored.get(name)})`);
    for (const [, , mimeType, b64] of out.matchAll(DATA_REF)) {
      const key = createHash("sha256").update(b64).digest("hex");
      if (!stored.has(key)) {
        const data = Buffer.from(b64, "base64");
        const asset = await db.asset.create({ data: { mimeType, filename: `figure-${key.slice(0, 12)}`, data: new Uint8Array(data) }, select: { id: true } });
        stored.set(key, asset.id);
      }
    }
    return out.replace(DATA_REF, (_, __, ___, b64: string) => `](/api/assets/${stored.get(createHash("sha256").update(b64).digest("hex"))})`);
  };
  for (const row of rows) {
    row.stem = (await resolve(row.stem))!;
    row.explanation = (await resolve(row.explanation)) ?? undefined;
    if ("choices" in row && row.choices) for (const c of row.choices) c.text = (await resolve(c.text))!;
  }
  return stored.size;
}

/** Text with figure links normalized, so a re-imported row compares equal to its stored copy. */
const comparable = (v: unknown) =>
  JSON.stringify(v ?? null).replace(/\]\((?:figure:[^)\s]+|\/api\/assets\/[^)\s]+|data:image\/[^)\s]+)\)/g, "](F)");

export type ImportOptions = {
  /** Replace questions whose externalId already exists (when their content changed). */
  update?: boolean;
  /** With update: also apply the row's active/inactive status (exports carry it). */
  withStatus?: boolean;
  /** Reads ![](figure:<name>) files (CLI --figures). */
  figureFile?: (name: string) => Buffer;
};

export async function importRows(ok: Row[], opts: ImportOptions = {}) {
  const ids = ok.map((r) => r.externalId).filter((x): x is string => !!x);
  const current = new Map((await db.question.findMany({ where: { externalId: { in: ids } } })).map((q) => [q.externalId!, q]));
  const fresh = ok.filter((r) => !r.externalId || !current.has(r.externalId));

  const changed = !opts.update
    ? []
    : ok.filter((r) => {
        const q = r.externalId ? current.get(r.externalId) : undefined;
        if (!q) return false;
        const choices = "choices" in r ? r.choices : null;
        return (
          comparable(r.stem) !== comparable(q.stem) ||
          comparable(r.explanation ?? null) !== comparable(q.explanation) ||
          comparable(choices) !== comparable(q.choices) ||
          (("correctChoice" in r ? r.correctChoice : null) ?? null) !== q.correctChoice ||
          comparable(r.sprAnswers) !== comparable(q.sprAnswers) ||
          r.skillId !== q.skillId ||
          r.difficulty !== q.difficulty ||
          r.type !== q.type ||
          (opts.withStatus && r.active !== q.active)
        );
      });

  const figures = await storeFigures([...fresh, ...changed], opts.figureFile);

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 1000) inserted += (await db.question.createMany({ data: fresh.slice(i, i + 1000), skipDuplicates: true })).count;
  for (const r of changed) {
    await db.question.update({
      where: { externalId: r.externalId! },
      data: {
        domain: r.domain,
        skillId: r.skillId,
        difficulty: r.difficulty,
        type: r.type,
        stem: r.stem,
        explanation: r.explanation ?? null,
        choices: "choices" in r && r.choices ? r.choices : Prisma.DbNull,
        correctChoice: "correctChoice" in r ? r.correctChoice : null,
        sprAnswers: r.sprAnswers,
        ...(opts.withStatus && { active: r.active }),
      },
    });
  }
  return { inserted, updated: changed.length, skipped: ok.length - inserted - changed.length, figures };
}

// ───────────────────────── Export ─────────────────────────

/**
 * Questions in the import format, with figures embedded as data: URIs so the
 * file is self-contained. Questions without an externalId get "local:<id>" so
 * re-importing the file elsewhere doesn't create duplicates.
 */
export async function exportQuestions(where: Prisma.QuestionWhereInput) {
  const questions = await db.question.findMany({ where, include: { skill: { select: { code: true } } }, orderBy: { createdAt: "asc" } });
  const assetIds = new Set<string>();
  const collect = (t: string | null | undefined) => {
    for (const [, id] of (t ?? "").matchAll(ASSET_REF)) assetIds.add(id);
  };
  for (const q of questions) {
    collect(q.stem);
    collect(q.explanation);
    for (const c of (q.choices as Choice[] | null) ?? []) collect(c.text);
  }
  const assets = new Map(
    (await db.asset.findMany({ where: { id: { in: [...assetIds] } } })).map((a) => [a.id, `data:${a.mimeType};base64,${Buffer.from(a.data).toString("base64")}`]),
  );
  const inline = (t: string) => t.replace(ASSET_REF, (m, id: string) => (assets.has(id) ? `](${assets.get(id)})` : m));

  return questions.map((q) => {
    const choices = (q.choices as Choice[] | null) ?? null;
    return {
      externalId: q.externalId ?? `local:${q.id}`,
      domain: q.domain,
      skill: q.skill.code,
      difficulty: q.difficulty,
      type: q.type,
      stem: inline(q.stem),
      ...(q.type === "MCQ" && choices && { choices: Object.fromEntries(MCQ_KEYS.map((k) => [k, inline(choices.find((c) => c.key === k)?.text ?? "")])) }),
      answer: q.type === "MCQ" ? q.correctChoice! : q.sprAnswers,
      ...(q.explanation && { explanation: inline(q.explanation) }),
      active: q.active,
    };
  });
}
