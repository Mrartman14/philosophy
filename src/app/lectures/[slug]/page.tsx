import { structure } from "@/structure";
import { notFound } from "next/navigation";

import DocxViewer from "@/components/shared/docx-viewer";

export async function generateStaticParams() {
  return structure.map((page) => ({ slug: page.slug }));
}

// export async function generateMetadata({ params }) {
//   const pageConfig = structure.find((p) => p.slug === params.slug);

//   return {
//     title: pageConfig?.title,
//     ...pageConfig?.meta,
//   };
// }

interface PageParams {
  slug: string;
}
interface PageProps {
  params: PageParams;
}
export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const pageConfig = structure.find((p) => p.slug === slug);
  if (!pageConfig) return notFound();

  const prevPageConfig =
    structure.find((p) => p.order === pageConfig.order - 1) ?? null;
  const nextPageConfig =
    structure.find((p) => p.order === pageConfig.order + 1) ?? null;

  return (
    <div className="grid grid-cols-1">
      <DocxViewer
        data={pageConfig}
        prevData={prevPageConfig}
        nextData={nextPageConfig}
      />
    </div>
  );
}
