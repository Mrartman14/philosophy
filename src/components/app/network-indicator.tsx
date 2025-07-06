"use client";

import { useEffect, useState } from "react";

import { OfflineIcon } from "@/assets/icons/offline-icon";

export const NetworkIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return isOffline ? <OfflineIcon className="text-amber-600 text-xl" /> : null;
};
