import Link from "next/link";

// The logo: the square "rk." icon (the same one as the browser tab, phone and
// extension icon, app/icon.svg, drawn by brand/make_icons.py) followed by the
// wordmark, lowercase "readkernel" with an ember full stop.
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-xl tracking-tight" aria-label="ReadKernel home">
      <RkIcon className="size-7 shrink-0 rounded-[7px] ring-1 ring-line" />
      <span>
        read<span className="font-bold">kernel</span>
        <span className="text-accent">.</span>
      </span>
    </Link>
  );
}

/** app/icon.svg, inline so it shows at once and stays sharp. */
function RkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#17150f" />
      <path
        d="M13 48 L13 26 M13 32 L13.4 31.1 L13.84 30.27 L14.33 29.5 L14.86 28.81 L15.43 28.19 L16.04 27.64 L16.69 27.16 L17.38 26.75 L18.1 26.41 L18.85 26.14 L19.64 25.94 L20.45 25.81 L21.3 25.75 L22.17 25.77 L23.07 25.85 L24 26 M32 48 L32 14 M32 37 L45 26 M37 33 L47 48"
        fill="none"
        stroke="#fbfaf7"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="53" cy="46" r="4.5" fill="#c2410c" />
    </svg>
  );
}
