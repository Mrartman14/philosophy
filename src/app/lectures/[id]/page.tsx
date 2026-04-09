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
import { getAnnotations } from "@/features/annotations/api";
import { AnnotationList } from "@/features/annotations/annotation-list";
import { AnnotationHighlight } from "@/features/annotations/annotation-highlight";
import type { Annotation } from "@/api/types";

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

  let annotations: Annotation[] = [];
  try {
    const result = await getAnnotations(id);
    annotations = result.data;
  } catch {
    // API недоступен — покажем пустой список аннотаций
  }

  const segments = transcript.segments ?? [];
  const timings = segments.map((s) => ({ id: s.id, start: s.start, end: s.end }));
  const videoFile = files.find((f) => f.type === "video");

  const annotatedPositions = new Set<number>();
  for (const a of annotations) {
    for (const pos of a.segment_ids ?? []) annotatedPositions.add(pos);
  }

  return (
    <LectureSync
      videoUrl={videoFile?.url}
      segments={timings}
      transcriptContent={
        <AnnotationHighlight
          lectureId={id}
          annotations={annotations}
          annotationListContent={
            <AnnotationList annotations={annotations} lectureId={id} />
          }
        >
          <TranscriptPanel
            segments={segments}
            annotatedPositions={annotatedPositions}
          />
        </AnnotationHighlight>
      }
      infoContent={
        <div className="p-4">
          <h1 className="text-xl font-bold">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-sm text-(--color-description) mt-2">
              {lecture.description}
            </p>
          )}
        </div>
      }
    />
  );
}
