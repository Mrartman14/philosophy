// src/app/saved/[id]/page.tsx
import { SavedLectureView } from "../saved-lecture-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SavedLecturePage({ params }: Props) {
  const { id } = await params;
  return <SavedLectureView id={id} />;
}
