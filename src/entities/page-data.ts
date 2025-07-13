export type PageDataSource = {
  path: string;
  name: string;
  slug: string;
  type: "docx";
};

export type PageData = {
  /** заголовок лекции */
  title: string;
  /** номер лекции */
  order: number;
  /** уникальный url сегмент страницы, исполняет роль id */
  slug: string;
  /** путь до docx файлов */
  sources: PageDataSource[];
  /** путь до обдожки лекции */
  cover: string;
  videoSrc?: string;
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
