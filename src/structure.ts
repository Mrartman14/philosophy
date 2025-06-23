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
    description?: string;
  };
};

export const structure: PageData[] = [
  {
    title: "Введение",
    order: 1,
    slug: "lesson-1",
    docxUrl: "/lesson-1.docx",
    meta: {},
  },
  {
    title: "Миф и презумпция ненаивности",
    order: 2,
    slug: "lesson-2",
    docxUrl: "/lesson-2.docx",
    meta: {},
  },
  {
    title: "Отцы философии",
    order: 3,
    slug: "lesson-3",
    docxUrl: "/lesson-3.docx",
    cover: "/lesson-previews/lesson-3-preview.jpeg",
    meta: {},
  },
  {
    title: "Зенон и апории",
    order: 4,
    slug: "lesson-4",
    docxUrl: "/lesson-4.docx",
    meta: {},
  },
  {
    title: "Суд Сократа",
    order: 5,
    slug: "lesson-5",
    docxUrl: "/lesson-5.docx",
    cover: "/lesson-previews/lesson-5-preview.jpeg",
    meta: {},
  },
  {
    title: "Введение в монотеизм",
    order: 6,
    slug: "lesson-6",
    docxUrl: "/lesson-6.docx",
    cover: "/lesson-previews/lesson-6-preview.jpeg",
    meta: {},
  },
  {
    title: "Свобода воли, грех и спасение",
    order: 7,
    slug: "lesson-7",
    docxUrl: "/lesson-7.docx",
    cover: "/lesson-previews/lesson-7-preview.jpeg",
    meta: {},
  },
  {
    title: "Gracia",
    order: 8,
    slug: "lesson-8",
    docxUrl: "/lesson-8.docx",
    cover: "/lesson-previews/lesson-8-preview.jpeg",
    meta: {},
  },
  {
    title: "Введение в модерн",
    order: 9,
    slug: "lesson-9",
    docxUrl: "/lesson-9.docx",
    cover: "/lesson-previews/lesson-9-preview.jpeg",
    meta: {},
  },
  {
    title: "Точка опоры",
    order: 10,
    slug: "lesson-10",
    docxUrl: "/lesson-10.docx",
    cover: "/lesson-previews/lesson-10-preview.jpeg",
    meta: {},
  },
  {
    title: "Бог из логики",
    order: 11,
    slug: "lesson-11",
    docxUrl: "/lesson-11.docx",
    cover: "/lesson-previews/lesson-11-preview.jpeg",
    meta: {},
  },
  {
    title: "Очень короткое одеяло",
    order: 12,
    slug: "lesson-12",
    docxUrl: "/lesson-12.docx",
    cover: "/lesson-previews/lesson-12-preview.jpeg",
    meta: {},
  },
  // {
  //   title: "Экспериментальная наука",
  //   order: 2,
  //   slug: "experimental-science",
  //   meta: { description: "Test metadata" },
  //   cover: "/lesson-previews/lesson-13-preview.jpeg",
  //   docxUrl: "/experimental-science.docx",
  // },
  // {
  //   title: "Античная этика",
  //   order: 3,
  //   slug: "ancient-ethics",
  //   docxUrl: "/ancient-ethics.docx",
  //   cover: "/lesson-previews/lesson-17-preview.jpeg",
  //   meta: { description: "Test metadata" },
  // },
  // {
  //   title: "Новоевропейская теория познания",
  //   order: 4,
  //   slug: "new-european-theory-of-knowledge",
  //   meta: { description: "Test metadata" },
  //   docxUrl: "/new-european-theory-of-knowledge.docx",
  //   cover: "/lesson-previews/lesson-30-preview.jpeg",
  // },
];
