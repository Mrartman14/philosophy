import { GoBack } from "@/components/shared/go-back";
import { RouterLink } from "@/components/ui";


export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Страница не найдена</h1>
      <RouterLink href="/" className="underline text-2xl">
        На главную
      </RouterLink>
      <GoBack />
    </div>
  );
}
