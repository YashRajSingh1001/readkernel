import { Container } from "@/components/Container";
import { FeedNav } from "@/components/FeedNav";
import { getLatestEdition } from "@/lib/brief";

export default async function FeedLayout({ children }: LayoutProps<"/feed">) {
  const edition = await getLatestEdition();
  const counts: Record<string, number> = {};
  for (const s of edition?.feed ?? []) counts[s.topic] = (counts[s.topic] ?? 0) + 1;

  return (
    <Container size="wide" className="flex gap-10 pb-20 lg:pb-0">
      <FeedNav counts={counts} total={edition?.feed.length ?? 0} discussions={edition?.discussions.length ?? 0} />
      <div className="min-w-0 flex-1">{children}</div>
    </Container>
  );
}
