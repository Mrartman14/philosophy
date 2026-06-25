"use client";
// src/app/lectures/[id]/lecture-actions-menu.tsx
// Dropdown «Действия» лекции: скачать .md/.txt + (владельцу) поделиться.
// Композиция share-links допустима на странице/острове (src/app/**), но
// запрещена внутри слайса. ShareDialog — контролируемый, открывается из пункта.
import { useState } from "react";

import { Button, Menu } from "@/components/ui";
import { ShareDialog, type ShareLink } from "@/features/share-links";
import { useT } from "@/i18n/client";

interface Props {
  exportUrls: { md: string; txt: string };
  share: { resourceId: string; initialLinks: ShareLink[] } | null;
}

export function LectureActionsMenu({ exportUrls, share }: Props) {
  const t = useT("pages");
  const tShare = useT("shareLinks");
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger render={<Button type="button" tone="quiet" compact />}>
          {t("lectureActionsMenuLabel")}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="end" className="outline-none">
            <Menu.Popup>
              <Menu.LinkItem href={exportUrls.md} target="_blank" rel="noopener noreferrer">
                {t("lectureDownloadMd")}
              </Menu.LinkItem>
              <Menu.LinkItem href={exportUrls.txt} target="_blank" rel="noopener noreferrer">
                {t("lectureDownloadTxt")}
              </Menu.LinkItem>
              {share && (
                <Menu.Item
                  onClick={() => {
                    setShareOpen(true);
                  }}
                >
                  {tShare("shareButtonLabel")}
                </Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {share && (
        <ShareDialog
          resourceType="lecture"
          resourceId={share.resourceId}
          initialLinks={share.initialLinks}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </>
  );
}
