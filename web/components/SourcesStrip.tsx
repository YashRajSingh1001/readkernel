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
 * read, not partners.
 */
export function SourcesStrip({ sources }: { sources: SourceInfo[] }) {
  const band = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vp = viewport.current!;
    const ln = lane.current!;
    const root = band.current!;
    const first = ln.firstElementChild as HTMLElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let x = 0;
    let setWidth = 0;
    let hover = false;
    let focus = false;
    let visible = true;
    let velocity = 0;
    let drag: { startX: number; x0: number; lastX: number; lastT: number } | null = null;
    let last = 0;
    let frame = 0;

    const wrap = () => {
      if (setWidth) x = -(((-x % setWidth) + setWidth) % setWidth);
    };
    const paint = () => {
      wrap();
      ln.style.transform = `translate3d(${x}px,0,0)`;
    };
    // The frame loop only runs while something is moving: drifting, gliding or being dragged.
    const drifting = () => !hover && !focus && visible && !document.hidden;
    const active = () => !reduced.matches && (drag !== null || velocity !== 0 || drifting());
    const tick = (t: number) => {
      frame = 0;
      if (!active()) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (drag) {
        // position follows the pointer
      } else if (velocity) {
        x += velocity * dt;
        velocity *= Math.pow(0.005, dt);
        if (Math.abs(velocity) < 8) velocity = 0;
      } else {
        x -= SPEED * dt;
      }
      paint();
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (reduced.matches) {
        ln.style.transform = "";
        return;
      }
      if (!frame && active()) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    // One copy plus the gap before the next copy. Re-measured whenever the copy's size
    // changes (web fonts arriving, window resizing), so the loop never jumps at the seam.
    const measure = () => {
      const gap = parseFloat(getComputedStyle(ln).columnGap) || 0;
      setWidth = first.getBoundingClientRect().width + gap;
      if (!reduced.matches) paint();
    };
    const ro = new ResizeObserver(measure);

    const onWheel = (e: WheelEvent) => {
      if (reduced.matches) return;
      // Sideways swipes move the strip; Shift + mouse wheel too, if the browser hasn't already
      // turned it sideways. Plain vertical scrolling is left to the page.
      let dx = e.deltaX;
      if (!dx && e.shiftKey) dx = e.deltaY;
      else if (Math.abs(dx) <= Math.abs(e.deltaY)) return;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) dx *= 16;
      else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) dx *= vp.clientWidth;
      e.preventDefault();
      velocity = 0;
      x -= dx;
      paint();
    };
    const onDown = (e: PointerEvent) => {
      if (reduced.matches || e.button !== 0) return;
      drag = { startX: e.clientX, x0: x, lastX: e.clientX, lastT: e.timeStamp };
      velocity = 0;
      vp.setPointerCapture(e.pointerId);
      vp.dataset.dragging = "true";
      wake();
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
      wake();
    };
    // Hover stops the drift for mouse and trackpad only. Taps on a phone also fire
    // mouse events, which would otherwise leave the strip stopped for good.
    const enter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hover = true;
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        hover = false;
        wake();
      }
    };
    const focusIn = () => (focus = true);
    const focusOut = () => {
      focus = false;
      wake();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });

    measure();
    ro.observe(first);
    root.addEventListener("pointerenter", enter);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("focusin", focusIn);
    root.addEventListener("focusout", focusOut);
    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    document.addEventListener("visibilitychange", wake);
    reduced.addEventListener("change", wake);
    io.observe(root);
    wake();

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", wake);
      reduced.removeEventListener("change", wake);
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
          <ul className="rk-strip-set" role="list" aria-label="Sources">
            {items}
          </ul>
          {/* The second copy makes the loop seamless; screen readers skip it. */}
          <ul className="rk-strip-set" aria-hidden inert>
            {items}
          </ul>
        </div>
      </div>
    </section>
  );
}
