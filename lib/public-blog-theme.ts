export type PublicBlogTheme = "light" | "dark";

export function resolvePublicBlogTheme(theme?: string | null): PublicBlogTheme {
  return theme === "dark" ? "dark" : "light";
}

export function getPublicBlogTheme(theme?: string | null) {
  const mode = resolvePublicBlogTheme(theme);

  if (mode === "dark") {
    return {
      mode,
      page: "bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_55%,#020617_100%)] text-slate-100",
      surfaceText: "text-slate-100",
      shell: "border-slate-800 bg-slate-950/86",
      divider: "border-slate-800",
      eyebrow: "text-teal-300",
      title: "text-white",
      titleLink: "text-white hover:text-teal-300 hover:decoration-teal-300",
      body: "text-slate-300",
      muted: "text-slate-400",
      link: "text-teal-300 hover:text-teal-200",
      card: "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900",
      empty: "border-slate-700 bg-slate-900/60",
      imageBorder: "border-slate-800",
      navText: "text-slate-400 hover:text-white",
      navTitle: "text-white",
      footerBorder: "border-slate-800",
      footerText: "text-slate-400",
      footerHover: "hover:text-white",
      footerSeparator: "text-slate-700",
      prose:
        "prose prose-invert prose-lg max-w-none leading-relaxed prose-headings:tracking-tight prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-a:text-teal-300 prose-a:decoration-teal-400/40 prose-a:underline-offset-4 prose-blockquote:border-l-slate-600 prose-blockquote:text-slate-300 prose-code:rounded prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-slate-100 prose-pre:border prose-pre:border-slate-800 prose-pre:bg-slate-900 prose-pre:text-slate-100"
    };
  }

  return {
    mode,
    page: "bg-[radial-gradient(circle_at_top,#f8fafc_0%,#eff6ff_45%,#ffffff_100%)] text-slate-900",
    surfaceText: "text-slate-900",
    shell: "border-slate-200 bg-white/92",
    divider: "border-slate-200",
    eyebrow: "text-accent",
    title: "text-slate-950",
    titleLink: "text-slate-950 hover:text-accent hover:decoration-accent",
    body: "text-slate-600",
    muted: "text-slate-500",
    link: "text-accent hover:text-teal-700",
    card: "border-slate-200 bg-white/88 hover:border-slate-300 hover:bg-white",
    empty: "border-slate-300 bg-slate-50/85",
    imageBorder: "border-slate-200",
    navText: "text-slate-500 hover:text-slate-900",
    navTitle: "text-slate-950",
    footerBorder: "border-slate-200",
    footerText: "text-slate-500",
    footerHover: "hover:text-slate-900",
    footerSeparator: "text-slate-300",
    prose:
      "prose prose-slate prose-lg max-w-none leading-relaxed prose-headings:tracking-tight prose-headings:text-slate-950 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-950 prose-a:text-accent prose-a:decoration-teal-500/40 prose-a:underline-offset-4 prose-blockquote:border-l-slate-300 prose-blockquote:text-slate-700 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-slate-900 prose-pre:border prose-pre:border-slate-200 prose-pre:bg-slate-950 prose-pre:text-slate-100"
  };
}
