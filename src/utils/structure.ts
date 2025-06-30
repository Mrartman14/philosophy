type Section =
  | "Интро"
  | "Экспериментальная наука"
  | "Античная этика"
  | "Новоевропейская теория познания";

export type SourceVersion = "Конспект" | "LLM" | "Тезисы" | "Вопросы";

export type PageData = {
  /** заголовок лекции */
  title: string;
  /** номер лекции */
  order: number;
  /** url сегмент в url страницы после /lectures */
  slug: string;
  /** путь до docx файлов лекции */
  sources: { path: string; name: SourceVersion }[];
  /** путь до обдожки лекции */
  cover?: string;

  /** упомянутые в лекции личности */
  mentions: string[];
  /** раздел лекций */
  section: Section;

  meta?: {
    description?: string;
    creator?: null | string | undefined;
    category?: null | string | undefined;
    keywords?: null | string | Array<string> | undefined;
  };
};

export const structure: PageData[] = [
  {
    title: "Не ассорти",
    order: 1,
    slug: "lesson-1",
    sources: [
      { path: "/lesson-1.docx", name: "Конспект" },
      { path: "/lesson-1-llm.docx", name: "LLM" },
      { path: "/lesson-1-theses.docx", name: "Тезисы" },
      { path: "/lesson-1-faq.docx", name: "Вопросы" },
    ],
    cover: "/lesson-previews/lesson-1-preview.jpeg",
    section: "Интро",
    mentions: ["Пифагор"],
    meta: {},
  },
  {
    title: "Презумпция ненаивности",
    order: 2,
    slug: "lesson-2",
    sources: [
      { path: "/lesson-2.docx", name: "Конспект" },
      { path: "/lesson-2-theses.docx", name: "Тезисы" },
      { path: "/lesson-2-faq.docx", name: "Вопросы" },
    ],
    cover: "/lesson-previews/lesson-2-preview.jpeg",
    section: "Интро",
    mentions: ["Пифагор"],
    meta: {},
  },
  {
    title: "Отцы философии",
    order: 3,
    slug: "lesson-3",
    sources: [
      { path: "/lesson-3.docx", name: "Конспект" },
      { path: "/lesson-3-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-3-preview.jpeg",
    section: "Интро",
    mentions: ["Парменид", "Гераклит"],
    meta: {},
  },
  {
    title: "Неразрешимые противоречия",
    order: 4,
    slug: "lesson-4",
    sources: [
      { path: "/lesson-4.docx", name: "Конспект" },
      { path: "/lesson-4-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-4-preview.jpeg",
    section: "Интро",
    mentions: ["Зенон", "Парменид", "Гераклит"],
    meta: {},
  },
  {
    title: "Предельное основание",
    order: 5,
    slug: "lesson-5",
    sources: [
      { path: "/lesson-5.docx", name: "Конспект" },
      { path: "/lesson-5-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-5-preview.jpeg",
    section: "Интро",
    mentions: ["Сократ"],
    meta: {},
  },
  {
    title: "От суда к сотворению",
    order: 6,
    slug: "lesson-6",
    sources: [
      { path: "/lesson-6.docx", name: "Конспект" },
      { path: "/lesson-6-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-6-preview.jpeg",
    section: "Интро",
    mentions: ["Фома Аквинский"],
    meta: {},
  },
  {
    title: "Свобода воли, грех и спасение",
    order: 7,
    slug: "lesson-7",
    sources: [
      { path: "/lesson-7.docx", name: "Конспект" },
      { path: "/lesson-7-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-7-preview.jpeg",
    section: "Интро",
    mentions: ["Августин Аврелий", "Пелагий", "Мартин Лютер"],
    meta: {},
  },
  {
    title: "Gracia",
    order: 8,
    slug: "lesson-8",
    sources: [
      { path: "/lesson-8.docx", name: "Конспект" },
      { path: "/lesson-8-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-8-preview.jpeg",
    section: "Интро",
    mentions: ["Августин Аврелий", "Пелагий", "Мартин Лютер", "Жан Кальвин"],
    meta: {},
  },
  {
    title: "Лоскутное одеяло",
    order: 9,
    slug: "lesson-9",
    sources: [
      { path: "/lesson-9.docx", name: "Конспект" },
      { path: "/lesson-9-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-9-preview.jpeg",
    section: "Интро",
    mentions: ["Рене Декарт", "Галилей"],
    meta: {},
  },
  {
    title: "Точка опоры",
    order: 10,
    slug: "lesson-10",
    sources: [
      { path: "/lesson-10.docx", name: "Конспект" },
      { path: "/lesson-10-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-10-preview.jpeg",
    section: "Интро",
    mentions: ["Рене Декарт"],
    meta: {},
  },
  {
    title: "Бог из логики",
    order: 11,
    slug: "lesson-11",
    sources: [
      { path: "/lesson-11.docx", name: "Конспект" },
      { path: "/lesson-11-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-11-preview.jpeg",
    section: "Интро",
    mentions: ["Рене Декарт"],
    meta: {},
  },
  {
    title: "Очень холодная ночь",
    order: 12,
    slug: "lesson-12",
    sources: [
      { path: "/lesson-12.docx", name: "Конспект" },
      { path: "/lesson-12-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-12-preview.jpeg",
    section: "Интро",
    mentions: ["Рене Декарт", "Гоббс"],
    meta: {},
  },
  {
    title: "Непознаваемый стул",
    order: 13,
    slug: "lesson-13",
    sources: [
      { path: "/lesson-13.docx", name: "Конспект" },
      { path: "/lesson-13-llm.docx", name: "LLM" },
      { path: "/lesson-13-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-13-preview.jpeg",
    section: "Экспериментальная наука",
    mentions: ["Платон"],
    meta: {},
  },
  {
    title: "Слепой бог",
    order: 14,
    slug: "lesson-14",
    sources: [
      { path: "/lesson-14.docx", name: "Конспект" },
      { path: "/lesson-14-llm.docx", name: "LLM" },
      { path: "/lesson-14-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-14-preview.jpeg",
    section: "Экспериментальная наука",
    mentions: ["Аристотель"],
    meta: {},
  },
  {
    title: "Схоластика",
    order: 15,
    slug: "lesson-15",
    sources: [
      { path: "/lesson-15.docx", name: "Конспект" },
      { path: "/lesson-15-llm.docx", name: "LLM" },
      { path: "/lesson-15-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-15-preview.jpeg",
    section: "Экспериментальная наука",
    mentions: ["Фома Аквинский", "Уильям Оккам"],
    meta: {},
  },
  {
    title: "Порывая со здравым смыслом",
    order: 16,
    slug: "lesson-16",
    sources: [
      { path: "/lesson-16.docx", name: "Конспект" },
      { path: "/lesson-16-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-16-preview.jpeg",
    section: "Экспериментальная наука",
    mentions: ["Галилей", "Коперник", "Френсис Бэкон"],
    meta: {},
  },
  {
    title: "Единственный в своём роде",
    order: 17,
    slug: "lesson-17",
    sources: [
      { path: "/lesson-17.docx", name: "Конспект" },
      { path: "/lesson-17-llm.docx", name: "LLM" },
      { path: "/lesson-17-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-17-preview.jpeg",
    section: "Античная этика",
    mentions: ["Диоген Синопский"],
    meta: {},
  },
  {
    title: "Одно мгновение",
    order: 18,
    slug: "lesson-18",
    sources: [
      { path: "/lesson-18.docx", name: "Конспект" },
      { path: "/lesson-18-llm.docx", name: "LLM" },
      { path: "/lesson-18-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-18-preview.jpeg",
    section: "Античная этика",
    mentions: ["Хрисипп", "Марк Аврелий"],
    meta: {},
  },
  {
    title: "Сходство с пылью",
    order: 19,
    slug: "lesson-19",
    sources: [
      { path: "/lesson-19.docx", name: "Конспект" },
      { path: "/lesson-19-llm.docx", name: "LLM" },
      { path: "/lesson-19-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-19-preview.jpeg",
    section: "Античная этика",
    mentions: ["Марк Аврелий"],
    meta: {},
  },
  {
    title: "Сорта удовольствий",
    order: 20,
    slug: "lesson-20",
    sources: [
      { path: "/lesson-20.docx", name: "Конспект" },
      { path: "/lesson-20-llm.docx", name: "LLM" },
      { path: "/lesson-20-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-20-preview.jpeg",
    section: "Античная этика",
    mentions: ["Эпикур"],
    meta: {},
  },
  {
    title: "Второй шанс",
    order: 21,
    slug: "lesson-21",
    sources: [
      { path: "/lesson-21.docx", name: "Конспект" },
      { path: "/lesson-21-llm.docx", name: "LLM" },
      { path: "/lesson-21-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-21-preview.jpeg",
    section: "Античная этика",
    mentions: ["Эпикур"],
    meta: {},
  },
  {
    title: "Четыре варианта смерти",
    order: 22,
    slug: "lesson-22",
    sources: [
      { path: "/lesson-22.docx", name: "Конспект" },
      { path: "/lesson-22-llm.docx", name: "LLM" },
      { path: "/lesson-22-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-22-preview.jpeg",
    section: "Античная этика",
    mentions: ["Эпикур"],
    meta: {},
  },
  {
    title: "Секст и пустота",
    order: 23,
    slug: "lesson-23",
    sources: [
      { path: "/lesson-23.docx", name: "Конспект" },
      { path: "/lesson-23-llm.docx", name: "LLM" },
      { path: "/lesson-23-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-23-preview.jpeg",
    section: "Античная этика",
    mentions: ["Секст Эмпирик", "Мелани Кляйн"],
    meta: {},
  },
  {
    title: "Что со мной не так",
    order: 24,
    slug: "lesson-24",
    sources: [
      { path: "/lesson-24.docx", name: "Конспект" },
      { path: "/lesson-24-llm.docx", name: "LLM" },
      { path: "/lesson-24-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-24-preview.jpeg",
    section: "Античная этика",
    mentions: ["Секст Эмпирик"],
    meta: {},
  },
  {
    title: "Бесконечное падение",
    order: 25,
    slug: "lesson-25",
    sources: [
      { path: "/lesson-25.docx", name: "Конспект" },
      { path: "/lesson-25-llm.docx", name: "LLM" },
      { path: "/lesson-25-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-25-preview.jpeg",
    section: "Античная этика",
    mentions: ["Иисус Христос", "Апостол Павел"],
    meta: {},
  },
  {
    title: "Фокусы со временем",
    order: 26,
    slug: "lesson-26",
    sources: [
      { path: "/lesson-26.docx", name: "Конспект" },
      { path: "/lesson-26-llm.docx", name: "LLM" },
      { path: "/lesson-26-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-26-preview.jpeg",
    section: "Античная этика",
    mentions: ["Апостол Павел", "Джордж Агамбен"],
    meta: {},
  },
  {
    title: "Потеряли счёт",
    order: 27,
    slug: "lesson-27",
    sources: [
      { path: "/lesson-27.docx", name: "Конспект" },
      { path: "/lesson-27-llm.docx", name: "LLM" },
      { path: "/lesson-27-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-27-preview.jpeg",
    section: "Античная этика",
    mentions: [
      "Савеллий",
      "Тертуллиан",
      "Арий",
      "Евномий",
      "Василий Великий",
      "Григорий Богослов",
      "Григорий Нисский",
      "Жак Деррида",
    ],
    meta: {},
  },
  {
    title: "И от сына тоже",
    order: 28,
    slug: "lesson-28",
    sources: [
      { path: "/lesson-28.docx", name: "Конспект" },
      { path: "/lesson-28-llm.docx", name: "LLM" },
      { path: "/lesson-28-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-28-preview.jpeg",
    section: "Античная этика",
    mentions: ["Василий Великий", "Григорий Богослов", "Григорий Нисский"],
    meta: {},
  },
  {
    title: "Si fallor, sum",
    order: 29,
    slug: "lesson-29",
    sources: [
      { path: "/lesson-29.docx", name: "Конспект" },
      { path: "/lesson-29-llm.docx", name: "LLM" },
      { path: "/lesson-29-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-29-preview.jpeg",
    section: "Античная этика",
    mentions: ["Августин Аврелий", "Рене Декарт"],
    meta: {},
  },
  {
    title: "Esse est percepi",
    order: 30,
    slug: "lesson-30",
    sources: [
      { path: "/lesson-30.docx", name: "Конспект" },
      { path: "/lesson-30-llm.docx", name: "LLM" },
      { path: "/lesson-30-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-30-preview.jpeg",
    section: "Новоевропейская теория познания",
    mentions: ["Локк", "Беркли"],
    meta: {},
  },
  {
    title: "Быть",
    order: 31,
    slug: "lesson-31",
    sources: [
      { path: "/lesson-31.docx", name: "Конспект" },
      { path: "/lesson-31-llm.docx", name: "LLM" },
      { path: "/lesson-31-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-31-preview.jpeg",
    section: "Новоевропейская теория познания",
    mentions: ["Беркли", "Молинью"],
    meta: {},
  },
  {
    title: "Никаких больше субстанций",
    order: 32,
    slug: "lesson-32",
    sources: [
      { path: "/lesson-32.docx", name: "Конспект" },
      { path: "/lesson-32-llm.docx", name: "LLM" },
      { path: "/lesson-32-theses.docx", name: "Тезисы" },
    ],
    cover: "/lesson-previews/lesson-32-preview.jpeg",
    section: "Новоевропейская теория познания",
    mentions: ["Юм"],
    meta: {},
  },
  {
    title: "Случайность",
    order: 33,
    slug: "lesson-33",
    sources: [
      { path: "/lesson-33.docx", name: "Конспект" },
      { path: "/lesson-33-llm.docx", name: "LLM" },
    ],
    cover: "/lesson-previews/lesson-33-preview.jpeg",
    section: "Новоевропейская теория познания",
    mentions: ["Юм"],
    meta: {},
  },
  {
    title: "В поисках дна",
    order: 34,
    slug: "lesson-34",
    sources: [
      { path: "/lesson-34.docx", name: "Конспект" },
      { path: "/lesson-34-llm.docx", name: "LLM" },
    ],
    cover: "/lesson-previews/lesson-34-preview.jpeg",
    section: "Новоевропейская теория познания",
    mentions: [
      "Юм",
      "Эйнштейн",
      "Пуанкаре",
      // "Анри Мишо"
    ],
    meta: {},
  },
  // {
  //   title: "???",
  //   order: 35,
  //   slug: "lesson-35",
  //   sources: [
  //     {
  //       path: "/lesson-35.docx",
  //       name: "Конспект",
  //     },
  //     { path: "", name: "LLM" },
  //   ],
  //   cover: "/lesson-previews/lesson-35-preview.jpeg",
  //   section: "Новоевропейская теория познания",
  //   mentions: ["Юм"],
  //   meta: {},
  // },
];
