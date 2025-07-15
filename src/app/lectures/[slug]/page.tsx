import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getLectureList, getLectureBySlug } from "@/api/pages-api";

interface LecturePageParams {
  slug: string;
}

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  const lectures = await getLectureList();
  const result = lectures.flatMap((page) => ({
    slug: page.slug,
  }));
  return result;
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLectureBySlug(slug);

  const result: Metadata = {
    title: data?.title,
  };

  return result;
}

interface PageProps {
  params: Promise<LecturePageParams>;
}
export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const lecture = await getLectureBySlug(slug);
  const firstSource = lecture?.sources[0];

  if (!lecture || !firstSource) return notFound();
  redirect(`/lectures/${slug}/sources/${firstSource.slug}`);
}
