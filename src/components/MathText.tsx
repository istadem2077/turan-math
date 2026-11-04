import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

/** Renders question markdown with $inline$ and $$display$$ LaTeX. */
export function MathText({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose-q ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
