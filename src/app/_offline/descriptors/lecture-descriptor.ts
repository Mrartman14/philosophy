// src/app/_offline/descriptors/lecture-descriptor.ts
// Дескриптор офлайн-снимка лекции. Живёт в композиционном корне app/_offline (НЕ в
// features/lectures): assemble кросс-фичевый (lectures+tags+comments), а ESLint запрещает
// cross-feature импорты внутри features/*. server-only: assemble зовёт server-фетчеры.
import "server-only";

import { Tags } from "@/api/tags";
import { getLectureComments, type RootSubtree } from "@/features/comments";
import {
  getLectureById,
  getLectureDocuments,
  type Lecture,
  type LectureDocument,
} from "@/features/lectures";
import { getLectureTags, type Tag } from "@/features/tags";
import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";

/** Офлайн-снимок лекции (форма знает дескриптор + SavedLectureView из L2). */
export interface LectureSnapshot {
  lecture: Lecture;
  tags: Tag[];
  documents: LectureDocument[];
  comments: RootSubtree[];
}

/** Тип AST-блока выводим из документа — без угадывания пути импорта ast.Block. */
type SnapshotBlock = NonNullable<LectureDocument["blocks"]>[number];

const STORAGE_KEY_RE = /^[0-9a-f]{64}$/i;

/** Рекурсивно собрать валидные storage_key картинок из AST-блоков (вкл. вложенные content). */
export function extractImageKeysFromBlocks(
  blocks: readonly SnapshotBlock[],
): string[] {
  const acc: string[] = [];
  const walk = (nodes: readonly SnapshotBlock[]): void => {
    for (const b of nodes) {
      if (b.type === "image") {
        const k = b.attrs?.storage_key;
        if (typeof k === "string" && STORAGE_KEY_RE.test(k)) acc.push(k);
      }
      if (Array.isArray(b.content)) {
        walk(b.content as SnapshotBlock[]);
      }
    }
  };
  walk(blocks);
  return acc;
}

/** Бэк пагинирует комменты — тянем ВСЕ страницы (§225: офлайн-снимок не усекаем,
 *  в отличие от онлайн-CommentSection без «показать ещё»). all-or-nothing: сбой страницы → throw. */
const COMMENTS_PAGE = 100;
async function fetchAllComments(id: string): Promise<RootSubtree[]> {
  const first = await getLectureComments(id, { offset: 0, limit: COMMENTS_PAGE });
  const subtrees = [...first.subtrees];
  for (let off = COMMENTS_PAGE; off < first.total; off += COMMENTS_PAGE) {
    const page = await getLectureComments(id, { offset: off, limit: COMMENTS_PAGE });
    subtrees.push(...page.subtrees);
  }
  return subtrees;
}

export const lectureDescriptor: OfflineDescriptor<LectureSnapshot> = {
  entity: Tags.LECTURES,
  pathSegment: "lectures",

  assemble: async (id) => {
    const lecture = await getLectureById(id);
    if (!lecture) return null;
    const [tags, documents, comments] = await Promise.all([
      getLectureTags(id),
      getLectureDocuments(id),
      fetchAllComments(id),
    ]);
    return { lecture, tags, documents, comments };
  },

  extractImageKeys: (snap) => {
    const keys: string[] = [];
    if (snap.lecture.cover_image_key) keys.push(snap.lecture.cover_image_key);
    for (const doc of snap.documents) {
      keys.push(...extractImageKeysFromBlocks(doc.blocks ?? []));
    }
    for (const st of snap.comments) {
      keys.push(...extractImageKeysFromBlocks(st.root?.blocks ?? []));
      for (const d of st.descendants ?? []) {
        keys.push(...extractImageKeysFromBlocks(d.blocks ?? []));
      }
    }
    return [...new Set(keys)].filter((k) => STORAGE_KEY_RE.test(k));
  },
};
