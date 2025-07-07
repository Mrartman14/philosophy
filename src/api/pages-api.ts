import { cache } from "react";
import fs from "fs/promises";
import path from "path";

import { LessonPageData, ExamPageData } from "@/entities/page-data";

/** LECTURES */
export const getLessonBySlug = cache(async (slug: string) => {
  const list = await getLessonList();
  const res = list.find((x) => x.slug === slug);
  return res;
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
  // TODO: если файл будет получаться через фетч то настроить кеширование в sw.js
  // const res = await fetch(
  //   `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_BASE_PATH}/page-data.json`
  // );
  // return res.json().then((x) => x.lectures) as Promise<LessonPageData[]>;

  const filePath = path.join(process.cwd(), "public", "page-data.json");
  const fileContents = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(fileContents);
  return json.lectures as Promise<LessonPageData[]>;
});

/** EXAMS */
export const getExamList = cache(async () => {
  // TODO: если файл будет получаться через фетч то настроить кеширование в sw.js
  // const res = await fetch(
  //   `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_BASE_PATH}/page-data.json`
  // );
  // return res.json().then((x) => x.exams) as Promise<ExamPageData[]>;

  const filePath = path.join(process.cwd(), "public", "page-data.json");
  const fileContents = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(fileContents);
  return json.exams as Promise<ExamPageData[]>;
});

export const getExamBySlug = cache(async (slug: string) => {
  const list = await getExamList();
  const res = list.find((x) => x.slug === slug);
  return res;
});
