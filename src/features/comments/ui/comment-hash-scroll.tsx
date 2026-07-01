"use client";
// src/features/comments/ui/comment-hash-scroll.tsx
// Клиентский island: при заходе по deep-link /lectures/{id}#comment-{cid}
// доскролливает к узлу ответа. Нативный fragment-scroll ненадёжен —
// CommentSection стримится под Suspense, узла #comment-<id> может не быть в DOM
// в момент перехода. Island ждёт появления узла (MutationObserver + safety-
// timeout), затем scrollIntoView через useScrollToCommentThread (reduced-motion,
// block:center). Рендерит null.
import { useEffect } from "react";

import { commentNodeId, useScrollToCommentThread } from "../thread-scroll";

const HASH_PREFIX = "#comment-";
const WAIT_TIMEOUT_MS = 10_000;
// noop с непустым телом (void 0) — eslint no-empty-function запрещает `{}`.
const noop = (): void => {
  void 0;
};

export function CommentHashScroll() {
  const scroll = useScrollToCommentThread();
  useEffect(() => {
    let dispose = noop;
    function run() {
      dispose(); // очистить прошлый наблюдатель при смене hash
      dispose = noop;
      const hash = window.location.hash;
      if (!hash.startsWith(HASH_PREFIX)) return;
      const id = hash.slice(HASH_PREFIX.length);
      if (!id) return;
      if (document.getElementById(commentNodeId(id))) {
        scroll(id);
        return;
      }
      const observer = new MutationObserver(() => {
        if (document.getElementById(commentNodeId(id))) {
          dispose();
          scroll(id);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        dispose();
      }, WAIT_TIMEOUT_MS);
      dispose = () => {
        observer.disconnect();
        clearTimeout(timer);
        dispose = noop;
      };
    }
    run();
    window.addEventListener("hashchange", run);
    return () => {
      window.removeEventListener("hashchange", run);
      dispose();
    };
  }, [scroll]);
  return null;
}
