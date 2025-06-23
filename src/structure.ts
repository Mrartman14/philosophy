type PageConfig = {
  /** url сегмент страницы после /lections */
  slug: string;
  /** заголовок лекции */
  title: string;
  /** путь до mdx файла лекции */
  mdxFile: string;
  /** обложка */
  cover?: string;
  /** любая мета-инфа */
  meta: {
    description: string;
  };
};

export const structure: PageConfig[] = [
  {
    slug: "introduction",
    title: "Вступление",
    mdxFile: "introduction/page.mdx",
    cover: "/lesson-previews/lesson-3-preview.jpeg",
    meta: { description: "Test metadata" },
  },
  {
    slug: "ancient-ethics",
    title: "Античная этика",
    mdxFile: "ancient-ethics/page.mdx",
    cover: "/lesson-previews/lesson-17-preview.jpeg",
    meta: { description: "Test metadata" },
  },
  {
    title: "Экспериментальная наука",
    slug: "experimental-science",
    mdxFile: "experimental-science/page.mdx",
    meta: { description: "Test metadata" },
  },
  {
    title: "Новоевропейская теория познания",
    slug: "new-european-theory-of-knowledge",
    mdxFile: "new-european-theory-of-knowledge/page.mdx",
    meta: { description: "Test metadata" },
  },
];
