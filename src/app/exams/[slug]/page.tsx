import { Metadata } from "next";
import Image from "next/image";

import { processSource } from "@/utils/parse-docx";
import { getExamBySlug, getPageConfig } from "@/api/pages-api";
import { ScrollButton } from "@/components/shared/scroll-button";
import { DocxViewer } from "@/components/docx/docx-viewer/docx-viewer";

const getExamListFromFs = async () => {
  const pageConfig = await getPageConfig();
  return pageConfig.exams;
};

export async function generateStaticParams() {
  const exams = await getExamListFromFs();
  return exams.map((data) => ({ slug: data.slug }));
}

interface ExamPageParams {
  slug: string;
}

type GenerateMetadataProps = {
  params: Promise<ExamPageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

interface PageProps {
  params: Promise<ExamPageParams>;
}
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getExamBySlug(slug);

  const result: Metadata = {
    title: data?.title,
  };

  return result;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const data = await getExamBySlug(slug);

  if (!data) {
    return null;
  }
  const parsedData = await processSource(data.sources[0], true);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const imgSrc = `${basePath}${data.cover}`;
  return (
    <>
      <div
        className={`w-full grid grid-cols-1 md:grid-cols-2 relative border-b border-(--border)`}
      >
        <div className="p-4 order-2 md:order-1 md:border-r md:border-(--border)">
          <div className={`relative grid grid-cols-1 aspect-square`}>
            <Image
              fill
              src={`${imgSrc}`}
              alt={`Обложка экзамена "${data.title}"`}
              className="sensitive-image"
            />
          </div>
        </div>
        <div className="grid content-start gap-4 order-1 md:order-2">
          <div className="md:border-b md:border-(--border) md:p-4 max-md:absolute p-0.5 max-md:bottom-4 max-md:right-4 max-md:left-4 max-md:bg-(--text-pane) max-md:text-right max-md:p-2">
            <h1 className="text-3xl md:text-5xl font-bold">{data.title}</h1>
          </div>
        </div>
      </div>

      <div className="w-full grid justify-items-center">
        <DocxViewer data={data.sources[0]} parsedData={parsedData} />
        <div />
        <ScrollButton className="z-10 sticky bottom-2 p-4 flex" />
      </div>
    </>
  );
}
