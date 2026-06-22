"use client";
// src/features/share-links/ui/share-button.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button, createTypedForm, Dialog, Form, IdempotencyField, Inline, TextInput, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";
import { toastActionError } from "@/utils/action-toast";

import { createShareLink } from "../actions";
import type { ShareLinkCreateFormInput } from "../schemas";
import type { ShareLink, ResourceType } from "../types";

import { ShareLinkList } from "./share-link-list";

interface Props {
  resourceType: ResourceType;
  resourceId: string;
  /** Владелец приватного ресурса? Считается на сервере (canCreateShareLink). */
  canCreate: boolean;
  /** Уже выпущенные ссылки ресурса (server fetch). */
  initialLinks: ShareLink[];
}

const initialState = initialActionState<ShareLink | null>(null);

const { Field, f, errors } = createTypedForm<ShareLinkCreateFormInput>();

/**
 * Кнопка «Поделиться» для detail-страниц. Открывает Dialog со списком
 * существующих ссылок ресурса и формой создания новой. Показывается только
 * владельцу приватного ресурса (canCreate). Создание — server action
 * createShareLink; после успеха router.refresh() обновляет список.
 */
export function ShareButton({
  resourceType,
  resourceId,
  canCreate,
  initialLinks,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("shareLinks");
  const tErrors = useT("errors");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createShareLink,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: t("linkCreatedToast") });
      router.refresh();
    } else if (!state.success && state.code !== "validation") {
      // Валидационные ошибки теперь рендерятся inline под <Field> (errors=);
      // тост оставляем только для forbidden/generic/серверных ошибок.
      toastActionError(toast, tErrors, state, {
        action: t("createLinkAction"),
        forbiddenTitle: tErrors("failureTitle"),
      });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!canCreate) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" tone="quiet">
          {t("shareButtonLabel")}
        </Button>
      }
      title={t("shareDialogTitle", { type: t(`resourceTypes.${resourceType}`) })}
      description={t("shareDialogDesc")}
    >
      <div className="flex flex-col gap-4">
        <Form action={formAction} errors={errors(state)}>
          <Inline align="end">
            <input type="hidden" name={f("resource_type")} value={resourceType} />
            <input type="hidden" name={f("resource_id")} value={resourceId} />
            <IdempotencyField result={state} />
            <Field name="expires_at" label={t("expiresAtLabel")} className="flex-1">
              <TextInput id="expires_at" type="datetime-local" name="expires_at" />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "…" : t("createLinkButton")}
            </Button>
          </Inline>
        </Form>

        <ShareLinkList
          links={initialLinks}
          resourceType={resourceType}
          resourceId={resourceId}
        />
      </div>
    </Dialog>
  );
}
