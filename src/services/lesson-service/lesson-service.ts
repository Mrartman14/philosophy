import { ILessonService } from "./lesson-service-typings";

import { openDB } from "idb";

const DB_NAME = "lessonDB";
const STORE_NAME = "lessons";

const DB_KEYS = {
  lastCount: "lastCount",
  viewed: "viewed",
} as const;

class LessonService implements ILessonService {
  async getDB() {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  async getLastLessonsCount(): Promise<number> {
    const db = await this.getDB();
    return (await db.get(STORE_NAME, DB_KEYS.lastCount)) ?? 0;
  }

  async setLastLessonsCount(nextCount: number): Promise<void> {
    const db = await this.getDB();
    await db.put(STORE_NAME, nextCount, DB_KEYS.lastCount);
  }

  async getViewedLessonIds(): Promise<string[]> {
    const db = await this.getDB();
    const result = (await db.get(STORE_NAME, DB_KEYS.viewed)) ?? [];

    return result;
  }

  async markLessonViewed(id: string) {
    const db = await this.getDB();
    const viewed = await this.getViewedLessonIds();

    if (!viewed.includes(id)) {
      viewed.push(id);
      await db.put(STORE_NAME, viewed, DB_KEYS.viewed);
    }
  }
}

export const lessonService = new LessonService();
