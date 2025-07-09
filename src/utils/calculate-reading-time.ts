export function calculateReadingTime(
  htmlString: string,
  wordsPerMinute = 225,
  imageSeconds = 12
) {
  const text = htmlString.replace(/<\/?[^>]+(>|$)/g, "");
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const imageCount = (htmlString.match(/<img [^>]*src="[^"]*"[^>]*>/g) || [])
    .length;

  const readingTime = Math.ceil(
    wordCount / wordsPerMinute + (imageCount * imageSeconds) / 60
  );
  return readingTime;
}
