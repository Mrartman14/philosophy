export type TranscriptItem = {
  id: number;
  start: number;
  end: number;
  speaker: string;
  text: string;
};

export type BoardState = {
  id: number;
  start: number;
  end: number;
  description: string;
  mermaid: string;
};

export type VideoLectureData = {
  transcript: TranscriptItem[];
  board_states: BoardState[];
};
