import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getUser } from "@/utils/get-user";

export const metadata = {
  title: "Вход — Философия-ликбез",
};

export default async function LoginPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }

  return (
    <div className="w-full flex justify-center p-4 md:p-8">
      <LoginForm />
    </div>
  );
}
