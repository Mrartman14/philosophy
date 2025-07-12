"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export const FooterPortal: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById("app-footer-slot"));
  }, []);

  if (!container) return null;
  return createPortal(children, container);
};
