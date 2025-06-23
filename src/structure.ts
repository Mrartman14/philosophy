export type PageData = {
  /** заголовок лекции */
  title: string;
  /** номер лекции */
  order: number;
  /** url сегмент в url страницы после /lectures */
  slug: string;
  /** путь до docx файла лекции */
  docxUrl: string;
  /** путь до обдожки лекции */
  cover?: string;

  /** любая мета-инфа */
  meta: {
    description: string;
  };
};

export const structure: PageData[] = [
  {
    title: "Вступление",
    order: 1,
    slug: "introduction",
    docxUrl: "/introduction.docx",
    cover: "/lesson-previews/lesson-3-preview.jpeg",
    meta: { description: "Test metadata" },
  },
  {
    title: "Экспериментальная наука",
    order: 2,
    slug: "experimental-science",
    meta: { description: "Test metadata" },
    cover: "/lesson-previews/lesson-13-preview.jpeg",
    docxUrl: "/experimental-science.docx",
  },
  {
    title: "Античная этика",
    order: 3,
    slug: "ancient-ethics",
    docxUrl: "/ancient-ethics.docx",
    cover: "/lesson-previews/lesson-17-preview.jpeg",
    meta: { description: "Test metadata" },
  },
  {
    title: "Новоевропейская теория познания",
    order: 4,
    slug: "new-european-theory-of-knowledge",
    meta: { description: "Test metadata" },
    docxUrl: "/new-european-theory-of-knowledge.docx",
    cover: "/lesson-previews/lesson-30-preview.jpeg",
  },
];
