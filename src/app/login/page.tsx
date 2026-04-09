import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getMe } from "@/utils/me";

export const metadata = {
  title: "Вход — Философия-ликбез",
};

export default async function LoginPage() {
  const me = await getMe();
  if (me) {
    redirect("/");
  }

  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <LoginForm />
    </div>
  );
}
