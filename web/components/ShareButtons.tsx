"use client";

import { useEffect, useRef, useState } from "react";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Copying again restarts the 2 seconds rather than stacking timers.
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const style = "rounded-md border border-line bg-card px-2.5 py-1 text-xs text-muted hover:border-ink hover:text-ink";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Share</span>
      {/* The button itself confirms the copy; both labels share one cell so the width never changes. */}
      <button type="button" onClick={copy} className={style}>
        <span className="rk-swap">
          <span className={copied ? "opacity-0" : ""} aria-hidden={copied}>
            Copy link
          </span>
          <span className={`font-medium text-label ${copied ? "" : "opacity-0"}`} aria-hidden={!copied}>
            ✓ Copied
          </span>
        </span>
      </button>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={style}>
          {l.label}
        </a>
      ))}
    </div>
  );
}
