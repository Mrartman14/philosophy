"use client";
// import Link from "next/link";

import debounce from "lodash/debounce";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
// import { CopyIcon } from "@/assets/icons/copy-icon";
import { ShareButton } from "./share-button/share-button";

export const TextSelectionObserver: React.FC<{ enabled?: boolean }> = ({
  enabled = true,
}) => {
  const [selectedText, setSelectedText] = useState("");
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>({
    top: 0,
    left: 0,
  });
  const [showPopover, setShowPopover] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;

    function highlightAndScroll(text: string) {
      if (!text) return;

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (node.nodeValue && node.nodeValue.includes(text)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          },
        }
      );

      const node = walker.nextNode();
      if (node && node.nodeValue) {
        const index = node.nodeValue.indexOf(text);
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);

          const span = document.createElement("span");
          span.id = "highlighted";
          span.className = "text-selection-highlight";
          span.textContent = text;

          range.deleteContents();
          range.insertNode(span);

          span.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }

    if (searchParams.has("selection")) {
      setTimeout(() => {
        highlightAndScroll(searchParams.get("selection")!);
      }, 500);
    }
  }, [searchParams, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const selectionListener = debounce(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();

        if (rects.length > 0) {
          const lastRect = rects[rects.length - 1];

          setPopoverPosition({
            top: lastRect.bottom + window.scrollY,
            left: lastRect.right + window.scrollX,
          });

          setShowPopover(true);
          const nextSelectedText = selection.toString();
          setSelectedText(nextSelectedText);

          return;
        }
      }
      setPopoverPosition(null);
      setShowPopover(false);
      setSelectedText("");
    }, 200);

    document.addEventListener("selectionchange", selectionListener);
    return () => {
      document.removeEventListener("selectionchange", selectionListener);
    };
  }, [enabled]);

  return (
    showPopover &&
    popoverPosition && (
      <div
        className="absolute z-50 bg-(--background)  border-2 border-(--border) rounded-xl grid overflow-hidden"
        style={{
          top: popoverPosition.top,
          left: popoverPosition.left,
        }}
      >
        <ShareButton
          className="flex items-center justify-between gap-2 p-2 hover:bg-(--text-pane)"
          iconClassName="text-2xl"
          shareData={{
            title: "selected text",
            url: `${window.location.href}?selection=${selectedText}`,
          }}
        >
          <span>Поделиться отрывком</span>
        </ShareButton>
        {/* <button className="flex items-center justify-between gap-2 p-2 hover:bg-(--text-pane)">
          <span>Ссылка на отрывок</span>
          <Link href={`${window.location.href}?selection=${selectedText}`}>
            <CopyIcon className="text-2xl" />
          </Link>
        </button> */}
      </div>
    )
  );
};
