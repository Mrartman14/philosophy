import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLectureById, getLectures, getTranscript } from "@/api/lecture-api";
import { LecturePlayer } from "./lecture-player";

interface LecturePageParams {
  id: string;
}

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  const result = await getLectures(1, 100);
  return (result.data ?? [])
    .filter((lecture): lecture is typeof lecture & { id: string } => !!lecture.id)
    .map((lecture) => ({ id: lecture.id }));
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

  let lecture, transcript;
  try {
    [lecture, transcript] = await Promise.all([
      getLectureById(id),
      getTranscript(id),
    ]);
  } catch {
    return notFound();
  }

  return (
    <LecturePlayer
      lecture={lecture}
      segments={transcript.segments ?? []}
    />
  );
}
