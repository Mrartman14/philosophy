"use client";

import { useRouter } from "next/navigation";

export const GoBack: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className }) => {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={`underline text-2xl cursor-pointer ${className}`}
    >
      {children || "Назад"}
    </button>
  );
};
