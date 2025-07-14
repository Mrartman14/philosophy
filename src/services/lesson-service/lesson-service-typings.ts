export interface ILessonService {
  getLastLessonsCount(): Promise<number>;
  setLastLessonsCount(nextCount: number): Promise<void>;

  getLastViewedLessonIds(): Promise<string[]>;
  setLastViewedLessonId(id: string): Promise<void>;

  getFavLessonIds(): Promise<string[]>;
  setFavLessonId(id: string): Promise<void>;
}
