import Link from "next/link";

// Wordmark: the name set in the headline serif, with the ember full stop as the mark.
export function Logo() {
  return (
    <Link href="/" className="font-serif text-xl leading-none font-semibold tracking-[-0.01em]" aria-label="ReadKernel home">
      ReadKernel<span className="text-accent">.</span>
    </Link>
  );
}
