import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getLectureById,
  getLectureFiles,
  getLectures,
  getTranscript,
} from "@/features/lectures/api";
import { LectureSync } from "@/features/lectures/lecture-sync";
import { TranscriptPanel } from "@/features/transcript/transcript-panel";
// Comments (Task 3)
import { CommentList } from "@/features/comments/comment-list";

interface LecturePageParams {
  id: string;
}

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  try {
    const result = await getLectures(0, 100);
    return result.data.map((lecture) => ({ id: lecture.id }));
  } catch {
    // API недоступен на этапе сборки — страницы будут рендериться on-demand
    return [];
  }
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture.title };
}

interface PageProps {
  params: Promise<LecturePageParams>;
}
export default async function LecturePage({ params }: PageProps) {
  const { id } = await params;

  let lecture, transcript, files;
  try {
    [lecture, transcript, files] = await Promise.all([
      getLectureById(id),
      getTranscript(id),
      getLectureFiles(id),
    ]);
  } catch {
    return notFound();
  }

  const segments = transcript.segments ?? [];
  const timings = segments.map((s) => ({ id: s.id, start: s.start, end: s.end }));
  const videoFile = files.find((f) => f.type === "video");

  return (
    <LectureSync
      videoUrl={videoFile?.url}
      segments={timings}
      transcriptContent={<TranscriptPanel segments={segments} />}
      infoContent={
        <div className="p-4">
          <h1 className="text-xl font-bold">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-sm text-(--color-description) mt-2">
              {lecture.description}
            </p>
          )}
          {/* Comments (Task 3) */}
          <CommentList lectureId={id} />
        </div>
      }
    />
  );
}
