import { openDB } from "idb";

const DB_NAME = "lectureDB";
const STORE_NAME = "lectures";

const DB_KEYS = {
  lastCount: "lastCount",
  viewed: "viewed",
  lastViewedLectureIds: "lastViewedLectureIds",
  favLectureIds: "favLectureIds",
} as const;

const MAX_LAST_LECTURES = 10 as const;
const MAX_FAV_LECTURES = 100 as const;

const getDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

class LectureService {
  async getLastLecturesCount(): Promise<number> {
    const db = await getDB();
    return (await db.get(STORE_NAME, DB_KEYS.lastCount)) ?? 0;
  }

  async setLastLecturesCount(nextCount: number): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, nextCount, DB_KEYS.lastCount);
  }

  async getViewedLectureIds(): Promise<string[]> {
    const db = await getDB();
    const result = (await db.get(STORE_NAME, DB_KEYS.viewed)) ?? [];

    return result;
  }

  async markLectureViewed(id: string) {
    const db = await getDB();
    const viewed = await this.getViewedLectureIds();

    if (!viewed.includes(id)) {
      viewed.push(id);
      await db.put(STORE_NAME, viewed, DB_KEYS.viewed);
    }
  }

  async getLastViewedLectureIds(): Promise<string[]> {
    const db = await getDB();
    const result =
      (await db.get(STORE_NAME, DB_KEYS.lastViewedLectureIds)) ?? [];
    return result;
  }

  async setLastViewedLectureId(id: string) {
    const db = await getDB();

    let ids: string[] =
      (await db.get(STORE_NAME, DB_KEYS.lastViewedLectureIds)) ?? [];

    ids = ids.filter((item) => item !== id);
    ids.unshift(id);

    if (ids.length > MAX_LAST_LECTURES) {
      ids = ids.slice(ids.length - MAX_LAST_LECTURES);
    }

    await db.put(STORE_NAME, ids, DB_KEYS.lastViewedLectureIds);
  }

  async getFavLectureIds(): Promise<string[]> {
    const db = await getDB();
    const result = (await db.get(STORE_NAME, DB_KEYS.favLectureIds)) ?? [];
    return result;
  }

  async checkIsLectureFav(lectureId: string): Promise<boolean> {
    const db = await getDB();
    const list: string[] =
      (await db.get(STORE_NAME, DB_KEYS.favLectureIds)) ?? [];
    const result = list.some((x) => x === lectureId);
    return result;
  }

  async setFavLectureId(id: string) {
    const db = await getDB();

    let ids: string[] = (await db.get(STORE_NAME, DB_KEYS.favLectureIds)) ?? [];

    if (ids.includes(id)) {
      ids = ids.filter((item) => item !== id);
    } else {
      ids.unshift(id);
    }

    if (ids.length > MAX_FAV_LECTURES) {
      ids = ids.slice(ids.length - MAX_FAV_LECTURES);
    }

    await db.put(STORE_NAME, ids, DB_KEYS.favLectureIds);
  }
}

export const lectureService = new LectureService();
