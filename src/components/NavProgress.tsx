"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin bar at the top of the page while a link navigation is loading. Starts
 * on a click on an internal link and finishes when the URL changes.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // The route changed: complete the bar.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
  }, [pathname, search]);

  useEffect(() => {
    if (state === "idle") return;
    // "done" fades out; "loading" gives up after 15 s (cancelled/failed navigation).
    const t = setTimeout(() => setState(state === "done" ? "idle" : "done"), state === "done" ? 400 : 15_000);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    // Capture phase: Next's <Link> calls preventDefault() in its own handler.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (state === "idle") return null;
  return <div key={state} className={`nav-progress ${state === "loading" ? "nav-progress-loading" : "nav-progress-done"}`} />;
}
