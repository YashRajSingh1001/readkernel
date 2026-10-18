import Link from "next/link";

// Placeholder mark until the real logo is designed: a kernel (dot) inside a ring.
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ReadKernel home">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink" />
        <circle cx="12" cy="12" r="4.5" className="fill-accent" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">ReadKernel</span>
    </Link>
  );
}
