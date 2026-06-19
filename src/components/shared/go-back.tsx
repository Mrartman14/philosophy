"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/components/ui";
import { useT } from "@/i18n/client";

export const GoBack: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className }) => {
  const router = useRouter();
  const t = useT("common");

  return (
    <button
      onClick={() => { router.back(); }}
      className={cn("underline text-2xl cursor-pointer", className)}
    >
      {children ?? t("back")}
    </button>
  );
};
