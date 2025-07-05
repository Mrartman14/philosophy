import { formatRelative } from "date-fns";
import { ru } from "date-fns/locale";

export function getRelativeDate(date?: Date) {
  if (!date) return null;
  return formatRelative(date, new Date(), { locale: ru });
}
