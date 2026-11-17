/** The text with the link appended on its own paragraph, unless the text already contains it. */
export function withLink(text: string, link: string): string {
  return text.includes(link) ? text : `${text}\n\n${link}`;
}
