import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold">Nothing here</h1>
      <p className="mt-3 text-muted">We couldn&apos;t find that page. The story or date may not exist.</p>
      <Link href="/" className="mt-6 inline-block text-accent hover:underline">
        Go to today&apos;s brief
      </Link>
    </div>
  );
}
