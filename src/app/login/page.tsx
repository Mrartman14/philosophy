import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getMe } from "@/utils/me";

export const metadata = {
  title: "Вход — Философия-ликбез",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const me = await getMe();
  if (me) {
    redirect("/");
  }
  const { next } = await searchParams;

  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <LoginForm {...(next ? { next } : {})} />
    </div>
  );
}
