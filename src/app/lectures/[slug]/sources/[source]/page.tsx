import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getLessonList,
  getLessonBySlug,
  getLessonSource,
} from "@/api/pages-api";
import DocxViewer from "@/components/docx/docx-viewer/docx-viewer";

interface SourcePageParams {
  source: string;
  slug: string;
}

export async function generateStaticParams(): Promise<SourcePageParams[]> {
  const lessons = await getLessonList();
  const result = lessons.flatMap((page) =>
    page.sources.map((source) => ({ slug: page.slug, source: source.slug }))
  );
  return result;
}

type GenerateMetadataProps = {
  params: Promise<SourcePageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { slug, source } = await params;
  const data = await getLessonSource(slug, source);

  const result: Metadata = {
    title: data?.name,
  };

  return result;
}

interface PageProps {
  params: Promise<SourcePageParams>;
}
export default async function Page({ params }: PageProps) {
  const { slug, source } = await params;
  const lesson = await getLessonBySlug(slug);
  const data = await getLessonSource(slug, source);

  if (!data || !lesson) return notFound();

  // TODO: video viewer here as well
  return <DocxViewer data={data} />;
}
