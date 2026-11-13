"use client";

/* eslint-disable @next/next/no-img-element -- favicons come from Google's favicon service */
import Link from "next/link";
import { useEffect, useRef } from "react";

import { faviconUrl } from "@/lib/format";
import type { SourceInfo } from "@/lib/sources";

// Feeds served from a different host than the outlet itself; use the outlet's icon.
const ICON_SITE: Record<string, string> = {
  "Hacker News": "https://news.ycombinator.com",
  "The Hacker News": "https://thehackernews.com",
};

const SPEED = 25; // px per second: slow enough to read the names as they pass

/**
 * The outlets ReadKernel reads, drifting slowly past. Hovering stops it; while
 * stopped, a sideways trackpad swipe or a mouse drag moves through the list.
 * Readers who ask for reduced motion get a still, wrapped list instead (CSS).
 * Names only, not links: the full list lives on /sources. These are sources we
 * read, not partners, and the note under the strip says so.
 */
export function SourcesStrip({ sources }: { sources: SourceInfo[] }) {
  const band = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vp = viewport.current!;
    const ln = lane.current!;
    const root = band.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let x = 0;
    let setWidth = 0;
    let hover = false;
    let focus = false;
    let visible = true;
    let velocity = 0;
    let drag: { startX: number; x0: number; lastX: number; lastT: number } | null = null;
    let last = performance.now();
    let frame = 0;

    const measure = () => {
      // One copy plus the gap before the next copy (the gap is in rem, so read it from CSS).
      const gap = parseFloat(getComputedStyle(ln).columnGap) || 0;
      setWidth = (ln.firstElementChild as HTMLElement).getBoundingClientRect().width + gap;
    };
    const wrap = () => {
      if (setWidth) x = -(((-x % setWidth) + setWidth) % setWidth);
    };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (reduced.matches) {
        ln.style.transform = "";
      } else {
        if (drag) {
          // position follows the pointer
        } else if (velocity) {
          x += velocity * dt;
          velocity *= Math.pow(0.005, dt);
          if (Math.abs(velocity) < 8) velocity = 0;
        } else if (!hover && !focus && visible && !document.hidden) {
          x -= SPEED * dt;
        }
        wrap();
        ln.style.transform = `translate3d(${x}px,0,0)`;
      }
      frame = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      // Only sideways swipes move the strip; vertical scrolling still scrolls the page.
      if (reduced.matches || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      velocity = 0;
      x -= e.deltaX;
    };
    const onDown = (e: PointerEvent) => {
      if (reduced.matches || e.button !== 0) return;
      drag = { startX: e.clientX, x0: x, lastX: e.clientX, lastT: e.timeStamp };
      velocity = 0;
      vp.setPointerCapture(e.pointerId);
      vp.dataset.dragging = "true";
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      x = drag.x0 + (e.clientX - drag.startX);
      const dt = (e.timeStamp - drag.lastT) / 1000;
      if (dt > 0) velocity = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
    };
    const onUp = () => {
      if (!drag) return;
      drag = null;
      delete vp.dataset.dragging;
      velocity = Math.max(-1000, Math.min(1000, velocity)); // a short glide, then settle
    };
    const enter = () => (hover = true);
    const leave = () => (hover = false);
    const focusIn = () => (focus = true);
    const focusOut = () => (focus = false);
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));

    measure();
    window.addEventListener("resize", measure);
    root.addEventListener("mouseenter", enter);
    root.addEventListener("mouseleave", leave);
    root.addEventListener("focusin", focusIn);
    root.addEventListener("focusout", focusOut);
    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    io.observe(root);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener("resize", measure);
      root.removeEventListener("mouseenter", enter);
      root.removeEventListener("mouseleave", leave);
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const items = sources.map((s) => (
    <li key={s.name} className="flex items-center gap-2 whitespace-nowrap">
      <img
        src={faviconUrl(ICON_SITE[s.name] ?? s.site)}
        alt=""
        width={18}
        height={18}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        className="pointer-events-none h-[18px] w-[18px] rounded-sm"
      />
      {s.name}
    </li>
  ));

  return (
    <section ref={band} aria-labelledby="sources-strip" className="border-y border-line py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="sources-strip" className="text-base font-bold">
          We read these {sources.length} sources every morning
        </h2>
        <Link href="/sources" className="text-sm font-medium text-accent hover:underline">
          See the full list
        </Link>
      </div>
      <div ref={viewport} className="rk-strip-viewport">
        <div ref={lane} className="rk-strip-lane">
          <ul className="rk-strip-set" aria-label="Sources">
            {items}
          </ul>
          {/* The second copy makes the loop seamless; screen readers skip it. */}
          <ul className="rk-strip-set" aria-hidden inert>
            {items}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        ReadKernel is independent. Names and icons identify the sources we read; no affiliation or endorsement is
        implied.
      </p>
    </section>
  );
}
