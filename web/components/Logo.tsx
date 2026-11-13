import Link from "next/link";

// The wordmark: lowercase "readkernel" with an ember full stop. The square "rk."
// icon (browser tab, phone, extension) is drawn by brand/make_icons.py.
export function Logo() {
  return (
    <Link href="/" className="text-xl tracking-tight" aria-label="ReadKernel home">
      read<span className="font-bold">kernel</span>
      <span className="text-accent">.</span>
    </Link>
  );
}
