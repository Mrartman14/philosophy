import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { structure } from "@/structure";
import DocxViewer from "@/components/docx/docx-viewer/docx-viewer";

export async function generateStaticParams() {
  return structure.map((page) => ({ slug: page.slug }));
}

interface LecturePageParams {
  slug: string;
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const pageConfig = structure.find((p) => p.slug === slug);

  const result: Metadata = {
    title: pageConfig?.title,
  };

  return result;
}

interface PageProps {
  params: Promise<LecturePageParams>;
}
export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const pageConfig = structure.find((p) => p.slug === slug);
  if (!pageConfig) return notFound();

  const prevPageConfig =
    structure.find((p) => p.order === pageConfig.order - 1) ?? null;
  const nextPageConfig =
    structure.find((p) => p.order === pageConfig.order + 1) ?? null;

  // const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  // const url = `${baseUrl}${pageConfig.docxUrl}`;
  // const response = await fetch(url);
  // const docxArrayBuffer = await response.arrayBuffer();

  return (
    <div className="grid grid-cols-1">
      <DocxViewer
        data={pageConfig}
        prevData={prevPageConfig}
        nextData={nextPageConfig}
        // docxArrayBuffer={docxArrayBuffer}
      />
    </div>
  );
}
