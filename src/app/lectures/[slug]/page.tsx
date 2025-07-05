import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { structure } from "@/utils/structure";
// import { parseDocx } from "@/utils/parse-docx";
import DocxViewer from "@/components/docx/docx-viewer/docx-viewer";
import { DocxOutroLink } from "@/components/docx/docx-outro-link";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";

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
  const data = structure.find((p) => p.slug === slug);
  if (!data || data.sources.length === 0) return notFound();

  const prevData = structure.find((p) => p.order === data.order - 1) ?? null;
  const nextData = structure.find((p) => p.order === data.order + 1) ?? null;

  // const parsedData = await parseDocx(pageConfig);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const outroLinks = [
    {
      href: prevData ? `/lectures/${prevData?.slug}` : undefined,
      title: "← Назад",
      description: prevData?.title,
      imageSrc: `${basePath}${prevData?.cover}`,
    },
    {
      href: nextData ? `/lectures/${nextData?.slug}` : undefined,
      title: "Вперёд →",
      description: nextData?.title,
      imageSrc: `${basePath}${nextData?.cover}`,
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
      {data.cover ? (
        <div className={`p-4 ${borderClasses} ${proseClasses}`}>
          <div className={`relative`}>
            {/* <div
              style={{
                background: `url(${imgSrc}) center/cover no-repeat`,
                filter: "blur(30px)",
                position: "absolute",
                top: "20px",
                left: "20px",
                right: "20px",
                bottom: "20px",
                zIndex: -1,
              }}
            /> */}
            <img
              src={`${imgSrc}`}
              alt={`${data.title} lesson preview`}
              style={{
                margin: 0,
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
      ) : (
        <h1>{data.title}</h1>
      )}
      <DocxViewer
        data={data}
        className={`${proseClasses} ${containerClasses} ${borderClasses}`}
        // parsedData={parsedData}
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
