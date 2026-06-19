"use client";
// src/features/notifications/ui/document-subscribe-button.tsx

import { subscribeDocument, unsubscribeDocument } from "../actions";

import { SubscribeButton } from "./subscribe-button";

interface DocumentSubscribeButtonProps {
  documentId: string;
  initialSubscribed: boolean;
}

export function DocumentSubscribeButton({
  documentId,
  initialSubscribed,
}: DocumentSubscribeButtonProps) {
  return (
    <SubscribeButton
      entityId={documentId}
      initialSubscribed={initialSubscribed}
      subscribeAction={subscribeDocument}
      unsubscribeAction={unsubscribeDocument}
    />
  );
}
