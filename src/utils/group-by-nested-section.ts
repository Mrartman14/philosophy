import type { LecturePageData } from "@/entities/page-data";

export type SectionNode = {
  name: string;
  lectures: LecturePageData[];
  children: SectionNode[];
};

/**
 * Нормализует section в массив
 */
export function normalizeSection(section: string | string[]): string[] {
  return Array.isArray(section) ? section : [section];
}

/**
 * Группирует лекции по вложенным секциям
 * @returns дерево секций с лекциями
 */
export function groupByNestedSection(
  lectures: LecturePageData[]
): SectionNode[] {
  const root: SectionNode[] = [];

  for (const lecture of lectures) {
    const path = normalizeSection(lecture.section);
    let currentLevel = root;

    for (let i = 0; i < path.length; i++) {
      const sectionName = path[i];
      let node = currentLevel.find((n) => n.name === sectionName);

      if (!node) {
        node = { name: sectionName, lectures: [], children: [] };
        currentLevel.push(node);
      }

      // Если это последний уровень - добавляем лекцию
      if (i === path.length - 1) {
        node.lectures.push(lecture);
      }

      currentLevel = node.children;
    }
  }

  return root;
}

/**
 * Считает общее количество лекций в узле (включая вложенные)
 */
export function countLecturesInNode(node: SectionNode): number {
  let count = node.lectures.length;
  for (const child of node.children) {
    count += countLecturesInNode(child);
  }
  return count;
}

/**
 * Получает полный путь секции как строку
 */
export function getSectionPath(section: string | string[]): string {
  const path = normalizeSection(section);
  return path.join(" → ");
}
