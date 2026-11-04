import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./convert";

/** mathml-to-latex puts spaces between tokens; they don't affect rendering. */
const tight = (md: string) => md.replace(/\$[^$]*\$/g, (m) => m.replace(/ /g, ""));

const M = (inner: string, block = false) =>
  `<math xmlns="http://www.w3.org/1998/Math/MathML"${block ? ' display="block"' : ""}>${inner}</math>`;

describe("htmlToMarkdown", () => {
  it("converts inline MathML to $LaTeX$", () => {
    const { markdown } = htmlToMarkdown(
      `<p>If ${M("<mn>3</mn><mi>x</mi><mo>+</mo><mn>5</mn><mo>=</mo><mn>20</mn>")}, what is the value of ${M("<mi>x</mi>")}?</p>`,
      "t",
    );
    expect(tight(markdown)).toBe("If $3x+5=20$, what is the value of $x$?");
  });

  it("converts fractions and exponents", () => {
    const { markdown } = htmlToMarkdown(
      `<p>${M("<mfrac><mn>3</mn><mn>4</mn></mfrac><msup><mi>x</mi><mn>2</mn></msup>")}</p>`,
      "t",
    );
    expect(tight(markdown)).toBe("$\\frac{3}{4}x^{2}$");
  });

  it("renders display math as $$ on its own lines", () => {
    const { markdown } = htmlToMarkdown(`<p>Solve:</p>${M("<mi>y</mi><mo>=</mo><mn>2</mn>", true)}<p>Done.</p>`, "t");
    expect(markdown.replace(/ /g, "")).toBe("Solve:\n\n$$y=2$$\n\nDone.");
  });

  it("keeps an equation wrapped in aria-hidden (e.g. the function definition)", () => {
    const { markdown } = htmlToMarkdown(
      `<div aria-hidden="true">${M("<mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><mn>4</mn><mi>x</mi>", true)}</div><p>For the function f defined above, what is ${M("<mi>f</mi><mo>(</mo><mn>1</mn><mo>)</mo>")}?</p>`,
      "t",
    );
    expect(markdown.replace(/ /g, "")).toMatch(/^\$\$f\\left\(x\\right\)=4x\$\$\n\nForthefunctionfdefinedabove/);
  });

  it("treats display=block math inside a sentence as inline", () => {
    const { markdown } = htmlToMarkdown(`<p>What is the value of ${M("<mi>f</mi><mo>(</mo><mn>1</mn><mo>)</mo>", true)}?</p>`, "t");
    expect(tight(markdown)).toBe("What is the value of $f\\left(1\\right)$?");
  });

  it("keeps consecutive display equations on their own lines", () => {
    const { markdown } = htmlToMarkdown(`<div>${M("<mi>y</mi><mo>=</mo><mn>2</mn>", true)}${M("<mi>x</mi><mo>=</mo><mn>3</mn>", true)}</div>`, "t");
    expect(markdown.replace(/ /g, "")).toBe("$$y=2$$\n\n$$x=3$$");
  });

  it("escapes currency dollars outside math", () => {
    const { markdown } = htmlToMarkdown(`<p>A shirt costs $12 and a hat costs $8.</p>`, "t");
    expect(markdown).toBe("A shirt costs \\$12 and a hat costs \\$8.");
  });

  it("does not mangle LaTeX with markdown escapes", () => {
    const { markdown } = htmlToMarkdown(`<p>${M("<msub><mi>a</mi><mn>1</mn></msub><mo>*</mo><mi>b</mi>")}</p>`, "t");
    expect(markdown).not.toContain("\\_");
    expect(markdown.startsWith("$a_{1}")).toBe(true);
  });

  it("extracts inline SVG into a figure reference", () => {
    const { markdown, figures } = htmlToMarkdown(
      `<p>The graph is shown.</p><svg viewBox="0 0 10 10" aria-label="A line graph"><line x1="0" y1="0" x2="10" y2="10"/></svg>`,
      "cbqb-x-stem",
    );
    expect(figures).toHaveLength(1);
    expect(figures[0].name).toBe("cbqb-x-stem-1.svg");
    expect(figures[0].data.toString()).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markdown).toBe("The graph is shown.\n\n![A line graph](figure:cbqb-x-stem-1.svg)");
  });

  it("extracts base64 images", () => {
    const png = Buffer.from("fakepng").toString("base64");
    const { markdown, figures } = htmlToMarkdown(`<p><img alt="Fig" src="data:image/png;base64,${png}"></p>`, "f");
    expect(figures[0]).toMatchObject({ name: "f-1.png", mimeType: "image/png" });
    expect(figures[0].data.toString()).toBe("fakepng");
    expect(markdown).toBe("![Fig](figure:f-1.png)");
  });

  it("converts tables to GFM and keeps |x| from breaking cells", () => {
    const { markdown } = htmlToMarkdown(
      `<table><thead><tr><th>${M("<mi>x</mi>")}</th><th>${M("<mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo>")}</th></tr></thead>
       <tbody><tr><td>1</td><td>${M("<mo>|</mo><mo>-</mo><mn>4</mn><mo>|</mo>")}</td></tr></tbody></table>`,
      "t",
    );
    const lines = markdown.split("\n");
    expect(tight(lines[0])).toBe("| $x$ | $f\\left(x\\right)$ |");
    expect(lines[1]).toMatch(/^\| -+ \| -+ \|$/);
    expect(lines[2].split(/(?<!\\)\|/).length).toBe(4); // 2 cells -> 3 pipes
    expect(markdown).toContain("\\vert");
  });

  it("drops screen-reader-only duplicates", () => {
    const { markdown } = htmlToMarkdown(`<p>Value <span class="sr-only">x squared</span>${M("<msup><mi>x</mi><mn>2</mn></msup>")}</p>`, "t");
    expect(tight(markdown)).toBe("Value $x^{2}$");
  });

  it("returns empty for empty input", () => {
    expect(htmlToMarkdown("", "t")).toEqual({ markdown: "", figures: [] });
  });
});
