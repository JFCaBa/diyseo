/**
 * Applies `fn` to the prose of a Markdown document and leaves fenced code blocks untouched. A fence closes
 * only with the same character, at least as long as the opening one (CommonMark); an unclosed fence runs
 * to the end of the document.
 */
export function mapProse(markdown: string, fn: (prose: string, index: number) => string): string {
  const out: string[] = [];
  const open = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gm;
  let cursor = 0;
  let index = 0;
  for (;;) {
    open.lastIndex = cursor;
    const start = open.exec(markdown);
    if (!start) break;
    const fence = start[1];
    const close = new RegExp(`^ {0,3}${fence[0] === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`, "gm");
    close.lastIndex = start.index + start[0].length + 1;
    const end = close.exec(markdown);
    const blockEnd = end ? end.index + end[0].length : markdown.length;
    out.push(fn(markdown.slice(cursor, start.index), index++));
    out.push(markdown.slice(start.index, blockEnd));
    cursor = blockEnd;
  }
  out.push(fn(markdown.slice(cursor), index));
  return out.join("");
}
