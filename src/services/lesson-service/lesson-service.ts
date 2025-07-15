import { ILessonService } from "./lesson-service-typings";

import { openDB } from "idb";

const DB_NAME = "lessonDB";
const STORE_NAME = "lessons";

const DB_KEYS = {
  lastCount: "lastCount",
  viewed: "viewed",
  lastViewedLessonIds: "lastViewedLessonIds",
  favLessonIds: "favLessonIds",
} as const;

const MAX_LAST_LESSONS = 10 as const;
const MAX_FAV_LESSONS = 100 as const;

const getDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

class LessonService implements ILessonService {
  async getLastLessonsCount(): Promise<number> {
    const db = await getDB();
    return (await db.get(STORE_NAME, DB_KEYS.lastCount)) ?? 0;
  }

  async setLastLessonsCount(nextCount: number): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, nextCount, DB_KEYS.lastCount);
  }

  async getViewedLessonIds(): Promise<string[]> {
    const db = await getDB();
    const result = (await db.get(STORE_NAME, DB_KEYS.viewed)) ?? [];

    return result;
  }

  async markLessonViewed(id: string) {
    const db = await getDB();
    const viewed = await this.getViewedLessonIds();

    if (!viewed.includes(id)) {
      viewed.push(id);
      await db.put(STORE_NAME, viewed, DB_KEYS.viewed);
    }
  }

  async getLastViewedLessonIds(): Promise<string[]> {
    const db = await getDB();
    const result =
      (await db.get(STORE_NAME, DB_KEYS.lastViewedLessonIds)) ?? [];
    return result;
  }

  async setLastViewedLessonId(id: string) {
    const db = await getDB();

    let ids: string[] =
      (await db.get(STORE_NAME, DB_KEYS.lastViewedLessonIds)) ?? [];

    ids = ids.filter((item) => item !== id);
    ids.unshift(id);

    if (ids.length > MAX_LAST_LESSONS) {
      ids = ids.slice(ids.length - MAX_LAST_LESSONS);
    }

    await db.put(STORE_NAME, ids, DB_KEYS.lastViewedLessonIds);
  }

  async getFavLessonIds(): Promise<string[]> {
    const db = await getDB();
    const result = (await db.get(STORE_NAME, DB_KEYS.favLessonIds)) ?? [];
    return result;
  }

  async checkIsLessonFav(lessonId: string): Promise<boolean> {
    const db = await getDB();
    const list: string[] =
      (await db.get(STORE_NAME, DB_KEYS.favLessonIds)) ?? [];
    const result = list.some((x) => x === lessonId);
    return result;
  }

  async setFavLessonId(id: string) {
    const db = await getDB();

    let ids: string[] = (await db.get(STORE_NAME, DB_KEYS.favLessonIds)) ?? [];

    if (ids.includes(id)) {
      ids = ids.filter((item) => item !== id);
    } else {
      ids.unshift(id);
    }

    if (ids.length > MAX_FAV_LESSONS) {
      ids = ids.slice(ids.length - MAX_FAV_LESSONS);
    }

    await db.put(STORE_NAME, ids, DB_KEYS.favLessonIds);
  }
}

export const lessonService = new LessonService();
