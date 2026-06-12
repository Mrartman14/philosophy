"use client";
// src/features/banners/ui/banner-delete-button.tsx
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteBanner } from "../actions";

interface Props {
  id: string;
}

export function BannerDeleteButton({ id }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить баннер?"
      description="Действие необратимо. Баннер исчезнет со всех страниц сайта."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteBanner(id);
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({
              title: "Нет прав",
              description: "У вас нет прав на удаление баннера.",
            });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
          return;
        }
        // С edit-страницы — на список; из списка — refresh.
        if (pathname.startsWith(`/admin/banners/${id}`)) {
          startTransition(() => router.push("/admin/banners"));
        } else {
          startTransition(() => router.refresh());
        }
      }}
    />
  );
}
