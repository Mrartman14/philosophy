export interface ILessonService {
  getLastLessonsCount(): Promise<number>;
  setLastLessonsCount(nextCount: number): Promise<void>;

  getLastViewedLessonIds(): Promise<string[]>;
  setLastViewedLessonId(id: string): Promise<void>;
}
