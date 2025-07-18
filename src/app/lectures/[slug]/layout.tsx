import Image from "next/image";
import { notFound } from "next/navigation";

import { getAdjacentLecturesBySlug } from "@/api/pages-api";
// import { Mention } from "@/components/shared/mention";
import { ScrollButton } from "@/components/shared/scroll-button";
import { DocxOutroLink } from "@/components/docx/docx-outro-link";
// import { PhilosopherIcon } from "@/assets/icons/philosopher-icon";
import { LectureViewObserver } from "@/components/lecture-page/lecture-view-observer";

interface LecturePageLayoutParams {
  slug: string;
}

type LayoutProps = React.PropsWithChildren<{
  params: Promise<LecturePageLayoutParams>;
}>;
export default async function LectureLayout({ params, children }: LayoutProps) {
  const { slug } = await params;

  const { curr: data, prev, next } = await getAdjacentLecturesBySlug(slug);
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
        className={`w-full max-w-full grid grid-cols-1 md:grid-cols-2 relative overflow-hidden`}
      >
        <div className="p-4 order-2 md:order-2 md:border-l md:border-(--border)">
          <div className={`relative grid grid-cols-1 aspect-square`}>
            <Image
              fill
              src={`${imgSrc}`}
              alt={`Обложка урока "${data.title}"`}
              className="sensitive-image"
            />
            <div className="absolute top-2 right-2">
              <LectureViewObserver lecture={data} />
            </div>
          </div>
        </div>

        <div className="grid content-start gap-4 order-1 md:order-1 md:p-4">
          <div
            className="hidden dark:block absolute h-[100px] z-[-1] blur-[100px] top-0 md:top-[-50px] left-1/2 md:left-0 w-full md:w-[100px] max-md:-translate-x-1/2"
            style={{
              background: `url(${imgSrc}) center/cover no-repeat`,
            }}
          />
          <div className="max-md:absolute max-md:bottom-4 max-md:right-4 max-md:left-4 max-md:bg-(--text-pane) max-md:text-right max-md:p-2">
            <h4 className="md:text-(--description) text-lg tracking-wider">
              {data.section}
            </h4>
            <h1 className="text-3xl md:text-5xl font-black">{data.title}</h1>
          </div>
          {data.videoSrc && (
            <iframe
              style={{
                aspectRatio: "16/9",
              }}
              className="max-md:p-4"
              src={data.videoSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          )}

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

      <div className="w-full grid justify-items-center">
        {children}

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
        <ScrollButton className="z-10 sticky bottom-2 p-4 flex" />
      </div>
    </>
  );
}
