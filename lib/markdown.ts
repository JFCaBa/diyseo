import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({
  gfm: true,
  breaks: false
});

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
];

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "title"]
};

export function renderMarkdownToHtml(markdown: string) {
  const rawHtml = marked.parse(markdown) as string;

  return sanitizeHtml(rawHtml, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer"
      })
    }
  });
}

export function getArticleEditorValue(contentMarkdown: string | null | undefined, contentHtml: string) {
  return contentMarkdown?.trim() ? contentMarkdown : contentHtml;
}

export function getArticleRenderedHtml(contentMarkdown: string | null | undefined, contentHtml: string) {
  return contentMarkdown?.trim() ? renderMarkdownToHtml(contentMarkdown) : contentHtml;
}
