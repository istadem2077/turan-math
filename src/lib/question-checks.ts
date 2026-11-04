/**
 * Sanity checks for imported question text (pure; used by the scrapers and
 * scripts/check-questions.ts).
 */

/**
 * Returns why a question can't be answered as stored, or null if it looks
 * complete: it refers to something "above"/"below" or to a figure, graph or
 * table that isn't in the text.
 */
export function missingContext(stem: string): string | null {
  const hasFigure = /!\[[^\]]*\]\([^)]+\)/.test(stem);
  const hasTable = /^\s*\|.*\|\s*$/m.test(stem);
  const hasDisplay = /\$\$[\s\S]+?\$\$|\\begin\{(aligned|array|cases)\}/.test(stem);

  const above = /\babove\b/i.exec(stem);
  if (above) {
    // Something has to come before the sentence that points "above".
    const before = stem.slice(0, above.index);
    if (!/!\[|\$\$|^\s*\||\\begin\{/m.test(before) && !hasLongInlineMath(before)) return `says "above" but nothing precedes it`;
  }
  if (/\b(figure|diagram)\b/i.test(stem) && !hasFigure) return "mentions a figure that isn't included";
  if (/\b(graph|scatterplot|histogram|dot plot|box plot|bar graph)\b[^.?!]*\b(shown|above|below)\b|\bthe (graph|scatterplot)\b(?! of)/i.test(stem) && !hasFigure)
    return "mentions a graph that isn't included";
  if (/\b(the|this) table\b|\btable (above|below|shown)\b/i.test(stem) && !hasTable && !hasFigure && !hasDisplay)
    return "mentions a table that isn't included";
  return null;
}

/** An earlier sentence with a real equation/definition in inline math also counts ("f(x) = 3x+1. For the function above…"). */
function hasLongInlineMath(text: string): boolean {
  return [...text.matchAll(/\$([^$]+)\$/g)].some((m) => /=|\\le|\\ge|<|>/.test(m[1]) && m[1].length >= 5);
}
