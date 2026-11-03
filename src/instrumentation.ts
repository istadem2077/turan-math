/**
 * Runs once when the Next.js server starts. Node-only work lives in
 * instrumentation-node.ts; this guard keeps it out of the edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startup } = await import("./instrumentation-node");
    await startup();
  }
}
