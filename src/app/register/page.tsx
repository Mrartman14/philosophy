import { redirect } from "next/navigation";

import { RegisterForm } from "@/features/auth/register-form";
import { getUser } from "@/utils/get-user";

export const metadata = {
  title: "Регистрация — Философия-ликбез",
};

export default async function RegisterPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }

  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <RegisterForm />
    </div>
  );
}
