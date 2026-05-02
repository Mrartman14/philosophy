import { notFound } from "next/navigation";
import { getTermById, GlossaryDetail } from "@/features/glossary";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <GlossaryDetail term={term} />
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  return { title: term?.title ?? "Термин" };
}
