import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold">Nothing here</h1>
      <p className="mt-3 text-muted">There is no brief for that date.</p>
      <Link href="/brief" className="mt-6 inline-block text-accent hover:underline">
        See all briefs
      </Link>
    </div>
  );
}
