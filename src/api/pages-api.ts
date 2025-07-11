import path from "path";
import fs from "fs/promises";
import { cache } from "react";

import { PageConfig } from "@/entities/page-data";

/** LECTURES */
export const getLessonBySlug = cache(async (slug: string) => {
  const list = await getLessonList();
  const res = list.find((x) => x.slug === slug);
  return res;
});

export const getLessonSource = cache(async (slug: string, source: string) => {
  const data = await getLessonBySlug(slug);
  const result = data?.sources.find((s) => s.slug === source);
  return result;
});

export const getAdjacentLessonsBySlug = cache(async (slug: string) => {
  const list = await getLessonList();

  const curr = list.find((x) => x.slug === slug) ?? null;
  const prev = curr
    ? list.find((p) => p.order === curr.order - 1) ?? null
    : null;
  const next = curr
    ? list.find((p) => p.order === curr.order + 1) ?? null
    : null;

  return { curr, prev, next };
});

export const getLessonList = cache(async () => {
  const res = await getPageConfig();
  return res.lectures;
});

/** EXAMS */
export const getExamList = cache(async () => {
  const res = await getPageConfig();
  return res.exams;
});

export const getExamBySlug = cache(async (slug: string) => {
  const list = await getExamList();
  const res = list.find((x) => x.slug === slug);
  return res;
});

export const getPageConfig = cache(async () => {
  // const res = await fetch(
  //   `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_BASE_PATH}/page-data.json`
  // );

  // return res.json() as Promise<PageConfig>;

  const filePath = path.join(process.cwd(), "public", "page-data.json");
  const fileContents = await fs.readFile(filePath, "utf-8");
  const pageConfig = JSON.parse(fileContents);

  return pageConfig as PageConfig;
});
