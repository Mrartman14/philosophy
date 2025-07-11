import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  getPageConfig,
  getLessonBySlug,
  getAdjacentLessonsBySlug,
} from "@/api/pages-api";

interface LecturePageParams {
  slug: string;
}

const getLessonListFromFs = async () => {
  const pageConfig = await getPageConfig();
  return pageConfig.lectures;
};

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  const lessons = await getLessonListFromFs();
  return lessons.map((page) => ({ slug: page.slug }));
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLessonBySlug(slug);

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
  const { curr: data } = await getAdjacentLessonsBySlug(slug);
  if (!data || data.sources.length === 0) return notFound();

  return redirect(`/lectures/${slug}/sources/${data.sources[0].slug}`);
}
