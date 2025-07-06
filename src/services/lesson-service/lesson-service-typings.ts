export interface ILessonService {
  getLastLessonsCount(): Promise<number>;
  setLastLessonsCount(nextCount: number): Promise<void>;
}
//   getLastViewedLesson(): Promise<string>;
//   setLastViewedLesson(): Promise<string>;
