"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Desmos?: { GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => { resize(): void; destroy(): void } };
  }
}

let loader: Promise<void> | null = null;
function loadDesmos(): Promise<void> {
  if (window.Desmos) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      const key = process.env.NEXT_PUBLIC_DESMOS_API_KEY ?? "dcb31709b452b1cf9dc26972add0fda6";
      s.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(key)}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loader = null;
        reject(new Error("Could not load the calculator."));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

/** Desmos graphing calculator. Stays mounted while hidden so work isn't lost. */
export function DesmosCalculator({ visible, width }: { visible: boolean; width: number }) {
  const el = useRef<HTMLDivElement>(null);
  const calc = useRef<{ resize(): void; destroy(): void } | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadDesmos()
      .then(() => {
        if (cancelled || !el.current || !window.Desmos) return;
        calc.current = window.Desmos.GraphingCalculator(el.current, {
          keypad: true,
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          border: false,
          links: false,
        });
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      calc.current?.destroy();
      calc.current = null;
    };
  }, []);

  useEffect(() => {
    if (visible) calc.current?.resize();
  }, [visible, width]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="absolute inset-0" />
      {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-bad">{error}</div>}
    </div>
  );
}
