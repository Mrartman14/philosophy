"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/components/ui";

export const GoBack: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className }) => {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={cn("underline text-2xl cursor-pointer", className)}
    >
      {children || "Назад"}
    </button>
  );
};
