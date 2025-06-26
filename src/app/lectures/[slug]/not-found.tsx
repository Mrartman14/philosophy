import Link from "next/link";
import { GoBack } from "@/components/shared/go-back";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Этой лекции ещё нет</h1>
      <Link href="/" className="underline text-2xl">
        На главную
      </Link>
      <GoBack />
    </div>
  );
}
