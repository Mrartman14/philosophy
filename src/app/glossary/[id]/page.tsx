import { notFound } from "next/navigation";
import {
  getTermById,
  GlossaryDetail,
  GlossaryExportLinks,
} from "@/features/glossary";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <GlossaryDetail term={term} />
      {term.id && <GlossaryExportLinks termId={term.id} />}
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  return { title: term?.title ?? "Термин" };
}
