import { EditionView } from "@/components/EditionView";
import { SignupForm } from "@/components/SignupForm";
import { getLatestEdition } from "@/lib/brief";

export default async function Home() {
  const edition = await getLatestEdition();

  if (!edition) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-serif text-3xl font-semibold">No brief yet</h1>
        <p className="mt-3 text-muted">
          The first edition appears after the pipeline runs. Locally: run{" "}
          <code className="rounded bg-card px-1.5 py-0.5 text-sm">python -m kernel.run</code> in{" "}
          <code className="rounded bg-card px-1.5 py-0.5 text-sm">pipeline/</code>.
        </p>
      </div>
    );
  }

  return (
    <EditionView edition={edition}>
      <SignupForm />
    </EditionView>
  );
}
