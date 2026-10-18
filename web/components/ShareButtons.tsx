"use client";

import { useState } from "react";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const style = "rounded-md border border-line bg-card px-2.5 py-1 text-xs text-muted hover:border-ink hover:text-ink";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Share</span>
      <button type="button" onClick={copy} className={style}>
        {copied ? "Link copied" : "Copy link"}
      </button>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={style}>
          {l.label}
        </a>
      ))}
    </div>
  );
}
