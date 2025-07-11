import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getPageConfig,
  getLessonBySlug,
  getAdjacentLessonsBySlug,
} from "@/api/pages-api";
// import { Mention } from "@/components/shared/mention";
import { ScrollButton } from "@/components/shared/scroll-button";
import { DocxOutroLink } from "@/components/docx/docx-outro-link";
// import { PhilosopherIcon } from "@/assets/icons/philosopher-icon";
import DocxViewer from "@/components/docx/docx-viewer/docx-viewer";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";
import { LessonViewObserver } from "@/components/observers/lesson-view-observer";

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

  const imgSrc = `${basePath}${data.cover}`;
  return (
    <>
      <div
        className={`w-full max-w-full grid grid-cols-1 md:grid-cols-2 relative`}
      >
        <div className="p-4 order-2 md:order-2">
          <div className={`relative grid grid-cols-1 aspect-square`}>
            <Image
              fill
              src={`${imgSrc}`}
              alt={`Обложка урока "${data.title}"`}
              className="sensitive-image"
            />
          </div>
        </div>

        <div className="grid content-start gap-4 order-1 md:order-1 md:p-4">
          {/* <div
            style={{
              background: `url(${imgSrc}) center/cover no-repeat`,
              filter: "blur(100px)",
              position: "absolute",
              // top: "0px",
              // left: "0px",
              // right: "0px",
              // bottom: "50%",
              width: "20%",
              height: "20%",
              // bottom: "50%",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",

              // opacity: 0.5,
              zIndex: -1,
            }}
          /> */}
          <div className="max-md:absolute p-0.5 max-md:bottom-4 max-md:right-4 max-md:left-4 max-md:bg-(--text-pane) max-md:text-right max-md:p-2">
            <h4 className="text-(--description) text-lg tracking-wider">
              {data.section}
            </h4>
            <h1 className="text-3xl md:text-5xl font-bold">{data.title}</h1>
          </div>
          {/* <div className="flex gap-x-4 gap-y-1 items-center flex-wrap">
            <PhilosopherIcon className="text-2xl text-(--description)" />

            {data.mentions.map((philosopher) => (
              <Mention
                key={philosopher}
                withPopover
                name={philosopher}
                className="md:text-xl"
              />
            ))}
          </div> */}
        </div>
      </div>

      <div className="static w-full">
        <DocxViewer data={data} />

        <div className={`grid grid-cols-1 md:grid-cols-[1fr_300px] w-full`}>
          <div className="grid grid-cols-2 grid-rows-[100] gap-4 p-4 md:grid-rows-[150]">
            {outroLinks.map((link) => {
              if (link.href) {
                return <DocxOutroLink key={link.title} {...link} />;
              } else {
                return <div key={link.title} />;
              }
            })}
          </div>
        </div>

        <ScrollButton className="z-10 sticky bottom-2 right-4 justify-self-end md:fixed md:bottom-10 md:right-10" />
      </div>
      <LessonViewObserver slug={slug} />
      <ScrollProgressBar className="fixed top-0 w-full z-50" />
    </>
  );
}
