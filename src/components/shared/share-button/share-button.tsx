"use client";

import { ShareIcon } from "@/assets/icons/share-icon";

type ShareButtonProps = {
  className?: string;
  iconClassName?: string;
  shareData: ShareData;
};
export const ShareButton: React.FC<ShareButtonProps> = ({
  shareData: { title, url, text },
  className = "",
  iconClassName = "",
}) => {
  const handleShare = async () => {
    const safeUrl = url ?? window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: safeUrl,
        });
      } catch (error) {
        // Пользователь отменил или возникла ошибка
        console.error(error);
      }
    } else {
      // Фолбэк: копируем ссылку в буфер обмена
      try {
        await navigator.clipboard.writeText(safeUrl);
        // alert("Ссылка скопирована в буфер обмена!");
      } catch (error) {
        // alert("Не удалось скопировать ссылку");
        console.error(error);
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label="Поделиться"
      className={`flex items-center justify-center w-8 h-8 rounded-full bg-(--text-pane) ${className}`}
    >
      <ShareIcon className={iconClassName} />
    </button>
  );
};
