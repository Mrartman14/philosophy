import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getLessonList,
  getLessonBySlug,
  getAdjacentLessonsBySlug,
} from "@/api/pages-api";
import DocxViewer from "@/components/docx/docx-viewer/docx-viewer";
import { DocxOutroLink } from "@/components/docx/docx-outro-link";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";

interface LecturePageParams {
  slug: string;
}

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  const lessons = await getLessonList();
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

  const { curr: data, prev, next } = await getAdjacentLessonsBySlug(slug);
  if (!data || data.sources.length === 0) return notFound();

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const outroLinks = [
    {
      href: prev ? `/lectures/${prev?.slug}` : undefined,
      title: "← Назад",
      description: prev?.title,
      imageSrc: `${basePath}${prev?.cover}`,
    },
    {
      href: next ? `/lectures/${next?.slug}` : undefined,
      title: "Вперёд →",
      description: next?.title,
      imageSrc: `${basePath}${next?.cover}`,
    },
  ];

  const proseClasses = "prose dark:prose-invert lg:prose-xl";
  const borderClasses = "md:border-l md:border-r border-(--border)";
  const containerClasses = "w-full grid gap-4";

  const imgSrc = `${basePath}${data.cover}`;
  return (
    <div className="grid gap-x-4 static w-full items-start justify-items-center grid-cols-1 md:grid-cols-[1fr_250px]">
      <div className="fixed top-0 w-full z-50">
        <ScrollProgressBar className="sticky top-0" />
      </div>

      <div className={`overflow-x-hidden p-4 ${borderClasses} ${proseClasses}`}>
        <div className={`relative`}>
          {/* <div
            style={{
              background: `url(${imgSrc}) center/cover no-repeat`,
              filter: "blur(50px)",
              position: "absolute",
              top: "20px",
              left: "20px",
              right: "20px",
              bottom: "100px",
              zIndex: -1,
            }}
          /> */}
          <img
            src={`${imgSrc}`}
            alt={`${data.title} lesson preview`}
            style={{
              margin: 0,
              width: "100vw",
              // width: "65ch",
            }}
          />
          <div
            className="absolute p-0.5 bottom-2 right-0 w-full bg-(--text-pane)"
            style={{
              textAlign: "right",
            }}
          >
            <h1>{data.title}</h1>
          </div>
        </div>
      </div>

      <DocxViewer
        data={data}
        className={`${proseClasses} ${containerClasses} ${borderClasses}`}
      />

      <div />

      <div
        className={`grid grid-cols-2 grid-rows-[100] gap-4 w-full p-4 md:grid-rows-[150] ${borderClasses}`}
      >
        {outroLinks.map((link) => {
          if (link.href) {
            return <DocxOutroLink key={link.title} {...link} />;
          } else {
            return <div key={link.title} />;
          }
        })}
      </div>
    </div>
  );
}
