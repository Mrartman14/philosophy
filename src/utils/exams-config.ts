import { PageData } from "./structure";

export type ExamConfig = PageData & { description: string };

export const examsConfig: ExamConfig[] = [
  {
    title: "Тест первый",
    slug: "exam-1",
    order: 1,
    cover: "/exams/exam-1/exam-1-cover.jpeg",
    description: "Уроки 1-35",
    // TODO: remove version
    sources: [{ path: "/exams/exam-1/rules.json", version: "Тезисы" }],
  },
];
