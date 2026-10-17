import type { Metadata } from "next";
import { Suspense } from "react";

import { unsubscribeAction } from "@/app/actions";
import { TokenAction } from "@/components/TokenAction";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <Suspense>
      <Unsubscribe searchParams={searchParams} />
    </Suspense>
  );
}

async function Unsubscribe({ searchParams }: { searchParams: PageProps<"/unsubscribe">["searchParams"] }) {
  const { token } = await searchParams;
  return (
    <TokenAction
      token={typeof token === "string" ? token : ""}
      action={unsubscribeAction}
      title="Unsubscribe"
      description="You'll stop getting the daily ReadKernel email. You can sign up again any time."
      button="Unsubscribe me"
    />
  );
}
