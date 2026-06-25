"use client";
// src/features/share-links/ui/share-dialog.tsx
// Контролируемый Dialog «Поделиться»: форма создания ссылки + список. Извлечён
// из ShareButton, чтобы открываться и из пункта dropdown-меню (без триггера).
import { useRouter } from "next/navigation";
import { useActionState, useEffect, type ReactNode } from "react";

import { createTypedForm, Button, Dialog, Form, IdempotencyField, Inline, TextInput, useToast } from "@/components/ui";
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
  initialLinks: ShareLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Необязательный триггер (для ShareButton); в меню-режиме не передаётся. */
  trigger?: ReactNode;
}

const initialState = initialActionState<ShareLink | null>(null);
const { Field, f, errors } = createTypedForm<ShareLinkCreateFormInput>();

export function ShareDialog({
  resourceType,
  resourceId,
  initialLinks,
  open,
  onOpenChange,
  trigger,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("shareLinks");
  const tErrors = useT("errors");
  const [state, formAction, pending] = useActionState(createShareLink, initialState);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: t("linkCreatedToast") });
      router.refresh();
    } else if (!state.success && state.code !== "validation") {
      toastActionError(toast, tErrors, state, {
        action: t("createLinkAction"),
        forbiddenTitle: tErrors("failureTitle"),
      });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
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
        <ShareLinkList links={initialLinks} resourceType={resourceType} resourceId={resourceId} />
      </div>
    </Dialog>
  );
}
