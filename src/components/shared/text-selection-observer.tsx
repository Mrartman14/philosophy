"use client";

import {
  flip,
  shift,
  offset,
  autoUpdate,
  useFloating,
} from "@floating-ui/react";
import Link from "next/link";
import debounce from "lodash/debounce";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CopyIcon } from "@/assets/icons/copy-icon";
import { ShareButton } from "./share-button/share-button";

export const TextSelectionObserver: React.FC<{ enabled?: boolean }> = ({
  enabled = true,
}) => {
  const [selectedText, setSelectedText] = useState("");
  const [showPopover, setShowPopover] = useState(false);
  const highlightRef = useRef<HTMLElement | null>(null);

  const searchParams = useSearchParams();

  const { refs, floatingStyles, update } = useFloating({
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement: "bottom-end",
  });

  useEffect(() => {
    if (!enabled) return;

    function highlightAndScroll(text: string) {
      if (!text) return;

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (node.nodeValue?.includes(text)) {
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

          highlightRef.current = span;
          refs.setReference(span);
          update();

          span.scrollIntoView({ behavior: "smooth", block: "center" });
          setShowPopover(true);
          setSelectedText(text);
        }
      }
    }

    if (searchParams.has("selection")) {
      setTimeout(() => {
        highlightAndScroll(searchParams.get("selection")!);
      }, 500);
    }
  }, [searchParams, enabled, refs, update]);

  useEffect(() => {
    if (!enabled) return;

    const selectionListener = debounce(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();

        if (rects.length > 0) {
          const lastRect = rects[rects.length - 1];

          const virtualEl = {
            getBoundingClientRect: () => lastRect,
            contextElement: document.body,
          };

          refs.setReference(virtualEl);
          update();

          setShowPopover(true);
          setSelectedText(selection.toString());

          return;
        }
      }

      setShowPopover(false);
      setSelectedText("");
    }, 200);

    document.addEventListener("selectionchange", selectionListener);
    return () => {
      document.removeEventListener("selectionchange", selectionListener);
    };
  }, [enabled, refs, update]);

  return (
    showPopover && (
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className="z-50 bg-(--background) border-2 border-(--border) rounded-xl grid overflow-hidden"
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
        <button className="flex items-center justify-between gap-2 p-2 hover:bg-(--text-pane)">
          <span>Ссылка на отрывок</span>
          <Link href={`${window.location.href}?selection=${selectedText}`}>
            <CopyIcon className="text-2xl" />
          </Link>
        </button>
      </div>
    )
  );
};
