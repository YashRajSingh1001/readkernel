import type { Metadata } from "next";
import { Suspense } from "react";

import { confirmAction } from "@/app/actions";
import { TokenAction } from "@/components/TokenAction";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };

export default function ConfirmPage({ searchParams }: PageProps<"/confirm">) {
  return (
    <Suspense>
      <Confirm searchParams={searchParams} />
    </Suspense>
  );
}

async function Confirm({ searchParams }: { searchParams: PageProps<"/confirm">["searchParams"] }) {
  const { token } = await searchParams;
  return (
    <TokenAction
      token={typeof token === "string" ? token : ""}
      action={confirmAction}
      title="Confirm your subscription"
      description="Click below and the ReadKernel brief will arrive in your inbox every morning."
      button="Yes, send me the brief"
    />
  );
}
