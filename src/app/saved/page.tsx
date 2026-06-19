// src/app/saved/page.tsx
import { getT } from "@/i18n";

import { SavedList } from "./saved-list";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("savedTitle") };
}

export default function SavedListPage() {
  return <SavedList />;
}
