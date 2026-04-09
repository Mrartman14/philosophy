import { redirect } from "next/navigation";

import { RegisterForm } from "@/features/auth/register-form";
import { getMe } from "@/utils/me";

export const metadata = {
  title: "Регистрация — Философия-ликбез",
};

export default async function RegisterPage() {
  const me = await getMe();
  if (me) {
    redirect("/");
  }

  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <RegisterForm />
    </div>
  );
}
