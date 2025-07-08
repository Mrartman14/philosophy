import { Metadata } from "next";

import { getExamBySlug, getPageConfig } from "@/api/pages-api";
import { ExamViewer } from "@/components/docx/exam-viewer/exam-viewer";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";

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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const proseClasses = "prose dark:prose-invert md:prose-xl";
  const containerClasses = "w-full grid gap-4";

  return (
    <div className="grid static w-full items-start justify-items-center grid-cols-1">
      <div className="fixed top-0 w-full z-50">
        <ScrollProgressBar className="sticky top-0" />
      </div>

      <div className={`p-4 width-full ${proseClasses}`}>
        {data.cover ? (
          <div className={`relative`}>
            <img
              src={`${basePath}${data.cover}`}
              alt={`${data.title} lesson preview`}
              style={{ margin: 0 }}
            />
            <div
              className="absolute p-0.5 bottom-2 right-0 w-full bg-(--text-pane)"
              style={{
                textAlign: "center",
              }}
            >
              <h1>{data.title}</h1>
            </div>
          </div>
        ) : (
          <h1>{data.title}</h1>
        )}
      </div>

      <ExamViewer className={`${proseClasses} ${containerClasses}`} />
    </div>
  );
}

// Пуанкаре — потому что количество вычислений, которые необходимо совершить для познания истины в задаче N тел, бесконечна так же, как и лестница на картинке
// Локк, потому что можно бесконечно перебирать качества субстанции (ходить по бесконечной лестнице), так никогда и не приблизившись к ее истине (волчку).
