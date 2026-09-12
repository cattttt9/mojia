/**
 * 只生成书脊上的精简标题；原始 book.title 始终保留给搜索、详情和无障碍文本。
 */
export function getSpineTitle(title?: string): string {
  const fullTitle = (title ?? "").trim();

  if (!fullTitle) {
    return "";
  }

  const beforeBracket = fullTitle.split(/[（(]/, 1)[0].trim();
  const cleanedTitle = beforeBracket || fullTitle;
  const characters = Array.from(cleanedTitle);
  const containsChinese = /[\u3400-\u9fff]/.test(cleanedTitle);
  const maxLength = containsChinese ? 10 : 18;

  if (characters.length <= maxLength) {
    return cleanedTitle;
  }

  return `${characters.slice(0, maxLength - 1).join("")}…`;
}
