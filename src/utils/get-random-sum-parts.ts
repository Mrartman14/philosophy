// получает на вход число, возвращает случайное количество чисел, сумма которых равна исходному числу
export function getRandomSumParts(total: number): number[] {
  const parts = [];
  let remaining = total;

  while (remaining > 0) {
    if (remaining === 1) {
      parts.push(1);
      break;
    }

    const part = Math.floor(Math.random() * (remaining - 1)) + 1;
    parts.push(part);
    remaining -= part;
  }

  return parts;
}
