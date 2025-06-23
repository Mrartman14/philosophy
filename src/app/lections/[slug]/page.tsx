import { MDXWrapper } from "@/components/mdx/mdx-wrapper";
import { structure } from "@/structure";
import { notFound } from "next/navigation";
import Image from "next/image";

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
  const { slug } = params;
  const pageConfig = structure.find((p) => p.slug === slug);
  if (!pageConfig) return notFound();

  const { default: MDXContent } = await import(
    `@/content/${pageConfig.mdxFile}`
  );
  return (
    <div className="grid grid-cols-1">
      {/* <div
        className="relative bg-cover bg-center"
        style={{
          width: "100%",
          height: "400px",
          backgroundImage: `url(${pageConfig.cover})`,
        }}
      >
        <h1 className="text-6xl absolute p-0.5 bottom-4 right-4 backdrop-blur-lg">
          {pageConfig.title}
        </h1>
      </div> */}

      {/* {pageConfig.cover ? (
        <img
          src={pageConfig.cover}
          //   className="w-dvw"
          style={{
            width: "100vw",
            maxHeight: "500px",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <h1 className="text-6xl p-0.5">{pageConfig.title}</h1>
      )} */}

      <MDXWrapper>
        <MDXContent />
      </MDXWrapper>
    </div>
  );
}
