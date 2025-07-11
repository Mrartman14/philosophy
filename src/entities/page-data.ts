export type PageData = {
  /** заголовок лекции */
  title: string;
  /** номер лекции */
  order: number;
  /** уникальный url сегмент страницы, исполняет роль id */
  slug: string;
  /** путь до docx файлов */
  sources: { path: string; name: string; slug: string }[];
  /** путь до обдожки лекции */
  cover: string;
};

export type LessonPageData = PageData & {
  /** упомянутые в лекции личности */
  mentions: string[];
  /** раздел лекций */
  section: string;
};

export type ExamPageData = PageData & { description: string };

export type PageConfig = {
  lectures: LessonPageData[];
  exams: ExamPageData[];
};
