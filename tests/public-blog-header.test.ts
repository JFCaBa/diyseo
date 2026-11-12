import assert from "node:assert/strict";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { getPublicBlogTheme } from "@/lib/public-blog-theme";

// tsconfig keeps JSX as "preserve" (Next compiles it); under tsx the component needs React in scope.
(globalThis as { React?: typeof React }).React = React;

test("the tenant header links the brand and host back to the site, and Blog to the blog index", async () => {
  const { PublicBlogHeader } = await import("@/components/public-blog-header");
  const html = renderToStaticMarkup(
    createElement(PublicBlogHeader, {
      siteName: "SerFuncionario",
      siteOrigin: "https://serfuncionario.com",
      blogPath: "/blog",
      theme: getPublicBlogTheme("light"),
      className: "max-w-4xl"
    })
  );
  assert.match(html, /<header[^>]*max-w-4xl/);
  assert.match(html, /href="https:\/\/serfuncionario\.com\/"[^>]*>SerFuncionario</);
  assert.match(html, /<span[^>]*>serfuncionario\.com<\/span>/);
  assert.equal((html.match(/href="https:\/\/serfuncionario\.com\/"/g) ?? []).length, 1);
  assert.match(html, /href="\/blog"[^>]*>Blog</);
});
