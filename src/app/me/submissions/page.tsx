// src/app/me/submissions/page.tsx
import { getMySubmissions, MySubmissionsList } from "@/features/forms";
import { requireActiveUserOrRedirect } from "@/utils/me";

export const metadata = { title: "Мои отклики" };

export default async function MySubmissionsPage() {
  await requireActiveUserOrRedirect("/me/submissions");

  const submissions = await getMySubmissions();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Мои отклики</h1>
      <MySubmissionsList submissions={submissions} />
    </div>
  );
}
