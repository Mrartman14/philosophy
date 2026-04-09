import { redirect } from "next/navigation";

import { RegisterForm } from "@/features/auth/register-form";
import { getMe } from "@/utils/me";

export const metadata = {
  title: "Регистрация — Философия-ликбез",
};

interface RegisterPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const me = await getMe();
  if (me) {
    redirect("/");
  }

  const { next } = await searchParams;

  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <RegisterForm {...(next ? { next } : {})} />
    </div>
  );
}
