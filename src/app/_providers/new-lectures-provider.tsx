"use client";

import { useEffect } from "react";

export const NewLecturesProvider: React.FC = () => {
  useEffect(() => {
    async function checkForNewLectures() {}

    checkForNewLectures();
  }, []);

  return null;
};
