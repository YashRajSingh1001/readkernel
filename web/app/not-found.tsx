import Link from "next/link";

import { Container } from "@/components/Container";

export default function NotFound() {
  return (
    <Container className="py-16 text-center">
      <h1 className="text-3xl font-extrabold">Nothing here</h1>
      <p className="mt-3 text-muted">We couldn&apos;t find that page. The story or date may not exist.</p>
      <Link href="/" className="mt-6 inline-block text-accent hover:underline">
        Go to today&apos;s brief
      </Link>
    </Container>
  );
}
