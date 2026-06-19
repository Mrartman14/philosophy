// src/app/me/submissions/page.tsx
import { getMySubmissions, MySubmissionsList } from "@/features/forms";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("mySubmissionsTitle") };
}

export default async function MySubmissionsPage() {
  await requireActiveUserOrRedirect("/me/submissions");

  const submissions = await getMySubmissions();
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{t("mySubmissionsHeading")}</h1>
      <MySubmissionsList submissions={submissions} />
    </div>
  );
}
