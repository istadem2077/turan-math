/**
 * Converts College Board question HTML (with MathML and inline SVG/img
 * figures) into the Markdown + $LaTeX$ that Turan Math stores in
 * Question.stem / choices / explanation.
 *
 * Figures are not embedded: each one is returned in `figures` and replaced in
 * the Markdown by `![](figure:<name>)`. scripts/import-questions.ts turns those
 * references into Asset rows when run with --figures <dir>.
 */
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { MathMLToLaTeX } from "mathml-to-latex";

export type Figure = { name: string; mimeType: string; data: Buffer };
export type Converted = { markdown: string; figures: Figure[] };

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", emDelimiter: "*" });
turndown.use(gfm);
// CB marks up a lot of screen-reader-only text; it would duplicate the math.
// Never drop an element that holds converted math or a figure, though: some
// items wrap the visible equation itself in aria-hidden, and dropping it
// silently loses e.g. the function definition the question refers to.
turndown.remove((node) => {
  const el = node as unknown as Element;
  if (/QQ[MF]\d+ZZ/.test(el.textContent ?? "")) return false;
  const cls = el.getAttribute?.("class") ?? "";
  return /\b(sr-only|visually-hidden)\b/.test(cls) || el.getAttribute?.("aria-hidden") === "true";
});

/** Placeholders are plain alphanumerics so Turndown neither escapes nor splits them. */
const PH = (kind: "M" | "F", i: number) => `QQ${kind}${i}ZZ`;
const PH_RE = /QQ([MF])(\d+)ZZ/g;


export function mathmlToLatex(mathml: string): string {
  return (
    MathMLToLaTeX.convert(mathml)
      .replace(/\s+/g, " ")
      // "|" would split a GFM table cell; \vert renders identically in KaTeX.
      .replace(/\\\|/g, "\\Vert ")
      .replace(/\|/g, "\\vert ")
      .trim()
  );
}

const INLINE_TAGS = new Set(["SPAN", "EM", "STRONG", "B", "I", "A", "SUB", "SUP", "U"]);

/** True when text or inline content sits right before or after the node (same line). */
function inSentence(node: Element): boolean {
  const near = (dir: "previousSibling" | "nextSibling") => {
    let n = node[dir];
    // Skip whitespace and already-converted neighbouring formulas (placeholders).
    const neutral = (x: ChildNode) =>
      (x.nodeType === 3 && /^\s*(QQM\d+ZZ\s*)*$/.test(x.textContent ?? "")) ||
      (x.nodeType === 1 && (x as Element).tagName.toUpperCase() === "MATH");
    while (n && neutral(n)) n = n[dir];
    if (!n) return false;
    if (n.nodeType === 3) return true;
    return n.nodeType === 1 && INLINE_TAGS.has((n as Element).tagName.toUpperCase());
  };
  return near("previousSibling") || near("nextSibling");
}

/**
 * @param html     source HTML fragment (may be empty)
 * @param figBase  prefix for figure file names, e.g. "cbqb-abc123-stem"
 */
export function htmlToMarkdown(html: string | null | undefined, figBase: string): Converted {
  if (!html || !html.trim()) return { markdown: "", figures: [] };
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  const root = document.getElementById("root")!;

  const maths: string[] = [];
  const figures: Figure[] = [];
  const figRefs: string[] = [];

  // 1. MathML -> LaTeX placeholders
  for (const m of Array.from(root.querySelectorAll("math"))) {
    // display="block" in the middle of a sentence is really inline math
    // ("what is the value of f(−1)?"); only a formula standing alone is display.
    const display = m.getAttribute("display") === "block" && !inSentence(m);
    let tex = "";
    try {
      tex = mathmlToLatex(m.outerHTML);
    } catch {
      tex = (m.textContent ?? "").trim();
    }
    const idx = maths.push(display ? `\n\n$$${tex}$$\n\n` : `$${tex}$`) - 1;
    m.replaceWith(document.createTextNode(PH("M", idx)));
  }

  // 2. Figures (inline SVG and images) -> files + placeholders
  const addFigure = (el: Element, mimeType: string, data: Buffer, ext: string) => {
    const name = `${figBase}-${figures.length + 1}.${ext}`;
    figures.push({ name, mimeType, data });
    const alt = (el.getAttribute("aria-label") ?? el.getAttribute("alt") ?? "").replace(/[\[\]\n]/g, " ").trim();
    const idx = figRefs.push(`\n\n![${alt}](figure:${name})\n\n`) - 1;
    el.replaceWith(document.createTextNode(PH("F", idx)));
  };

  for (const svg of Array.from(root.querySelectorAll("svg"))) {
    // Skip SVGs nested in another SVG (only top-level ones are figures).
    if (svg.parentElement?.closest("svg")) continue;
    if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (svg.outerHTML.includes("xlink:") && !svg.getAttribute("xmlns:xlink"))
      svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    addFigure(svg, "image/svg+xml", Buffer.from(svg.outerHTML, "utf8"), "svg");
  }

  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(src);
    if (m) {
      const ext = m[1] === "image/svg+xml" ? "svg" : m[1].split("/")[1].replace("jpeg", "jpg");
      addFigure(img, m[1], Buffer.from(m[2], "base64"), ext);
    }
    // Remote images are left as normal Markdown images; the scraper reports them.
  }

  // 3. HTML -> Markdown
  let md = turndown.turndown(root.innerHTML);

  // A literal "$" outside math (currency) would start a math span in remark-math.
  md = md.replace(/\$/g, "\\$");

  // 4. Restore placeholders
  md = md.replace(PH_RE, (_, kind: string, i: string) => (kind === "M" ? maths[+i] : figRefs[+i]));

  // Tidy whitespace left by display math / figures.
  md = md
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { markdown: md, figures };
}

/** Remote <img> URLs left in the Markdown (not downloaded). */
export function remoteImages(md: string): string[] {
  return [...md.matchAll(/!\[[^\]]*\]\((https?:[^)]+)\)/g)].map((m) => m[1]);
}
