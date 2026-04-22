(function () {
  var scriptTag = document.currentScript;

  if (!scriptTag) {
    return;
  }

  var siteId = scriptTag.getAttribute("data-site");
  var basePath = scriptTag.getAttribute("data-base-path");
  var themeOverride = scriptTag.getAttribute("data-theme");
  var titleOverride = scriptTag.getAttribute("data-title");

  if (!siteId || !basePath) {
    console.error("Soro widget requires both data-site and data-base-path.");
    return;
  }

  var normalizedBasePath = basePath.replace(/\/$/, "");
  var container = document.getElementById("soro-widget-container");
  var widgetConfig = {
    siteName: "Articles",
    contentLanguage: "en",
    imageStyle: null,
    basePath: normalizedBasePath,
    theme: "default",
    title: "Articles"
  };

  if (!container) {
    container = document.createElement("div");
    container.id = "soro-widget-container";
    document.body.appendChild(container);
  }

  if (!document.getElementById("soro-widget-style")) {
    var style = document.createElement("style");
    style.id = "soro-widget-style";
    style.textContent =
      "#soro-widget-container{" +
      "font-family:var(--soro-font-family,inherit);" +
      "line-height:1.6;" +
      "color:var(--soro-text-color,inherit);" +
      "background:var(--soro-background,transparent);" +
      "}" +
      "#soro-widget-container[data-theme='dark']{" +
      "--soro-surface:#0f172a;" +
      "--soro-text-color:#e2e8f0;" +
      "--soro-muted-color:#94a3b8;" +
      "--soro-border-color:#334155;" +
      "--soro-link-color:#5eead4;" +
      "--soro-link-hover-color:#99f6e4;" +
      "}" +
      "#soro-widget-container *{box-sizing:border-box;}" +
      "#soro-widget-container .soro-widget-shell{" +
      "border:1px solid var(--soro-border-color,#dbe4ea);" +
      "border-radius:16px;" +
      "padding:20px;" +
      "background:var(--soro-surface,#fff);" +
      "}" +
      "#soro-widget-container .soro-widget-title{" +
      "margin:0 0 16px;" +
      "font-size:1.5rem;" +
      "line-height:1.2;" +
      "}" +
      "#soro-widget-container .soro-widget-meta{" +
      "margin:0 0 16px;" +
      "font-size:.875rem;" +
      "color:var(--soro-muted-color,#64748b);" +
      "}" +
      "#soro-widget-container .soro-article-list{" +
      "list-style:none;" +
      "padding:0;" +
      "margin:0;" +
      "display:grid;" +
      "gap:12px;" +
      "}" +
      "#soro-widget-container .soro-article-item{" +
      "padding:0 0 12px;" +
      "border-bottom:1px solid var(--soro-border-color,#dbe4ea);" +
      "}" +
      "#soro-widget-container .soro-article-item:last-child{" +
      "border-bottom:none;" +
      "padding-bottom:0;" +
      "}" +
      "#soro-widget-container .soro-link," +
      "#soro-widget-container .soro-back-button{" +
      "color:var(--soro-link-color,#0f766e);" +
      "text-decoration:underline;" +
      "cursor:pointer;" +
      "background:none;" +
      "border:none;" +
      "padding:0;" +
      "font:inherit;" +
      "}" +
      "#soro-widget-container .soro-link:hover," +
      "#soro-widget-container .soro-back-button:hover{" +
      "color:var(--soro-link-hover-color,#115e59);" +
      "}" +
      "#soro-widget-container .soro-excerpt{" +
      "margin:8px 0 0;" +
      "color:var(--soro-muted-color,#64748b);" +
      "font-size:.95rem;" +
      "}" +
      "#soro-widget-container .soro-content{" +
      "overflow-wrap:anywhere;" +
      "}" +
      "#soro-widget-container .soro-content h1," +
      "#soro-widget-container .soro-content h2," +
      "#soro-widget-container .soro-content h3{" +
      "line-height:1.2;" +
      "margin:24px 0 12px;" +
      "}" +
      "#soro-widget-container .soro-content p{" +
      "margin:0 0 16px;" +
      "}" +
      "#soro-widget-container .soro-state{" +
      "padding:20px 0;" +
      "color:var(--soro-muted-color,#64748b);" +
      "}" +
      "#soro-widget-container .soro-loading{" +
      "font-style:italic;" +
      "}";
    document.head.appendChild(style);
  }

  function formatDate(isoDate) {
    if (!isoDate) {
      return "";
    }

    var parsed = new Date(isoDate);

    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(widgetConfig.contentLanguage || undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(parsed);
    } catch (error) {
      return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getCurrentSlug() {
    var hash = window.location.hash || "";
    var prefix = "#soro-article/";

    if (hash.slice(0, prefix.length) !== prefix) {
      return null;
    }

    var slug = hash.slice(prefix.length);
    return slug ? decodeURIComponent(slug) : null;
  }

  function setHash(slug) {
    if (slug) {
      window.location.hash = "soro-article/" + encodeURIComponent(slug);
      return;
    }

    if ((window.location.hash || "").indexOf("#soro-article/") === 0) {
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search
      );
      render();
    }
  }

  function renderShell(content) {
    container.innerHTML =
      '<div class="soro-widget-shell">' + content + "</div>";
  }

  function renderState(message, className) {
    renderShell(
      '<div class="soro-state ' +
        (className || "") +
        '">' +
        escapeHtml(message) +
        "</div>"
    );
  }

  function fetchJson(path) {
    return fetch(normalizedBasePath + path, {
      headers: {
        Accept: "application/json"
      }
    }).then(function (response) {
      if (!response.ok) {
        var error = new Error("Request failed");
        error.status = response.status;
        throw error;
      }

      return response.json();
    });
  }

  function trimString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function resolveConfig(apiConfig) {
    var resolved = {
      siteName: widgetConfig.siteName,
      contentLanguage: widgetConfig.contentLanguage,
      imageStyle: widgetConfig.imageStyle,
      basePath: widgetConfig.basePath,
      theme: widgetConfig.theme,
      title: widgetConfig.title
    };

    if (apiConfig && typeof apiConfig === "object") {
      resolved.siteName = trimString(apiConfig.siteName) || resolved.siteName;
      resolved.contentLanguage =
        trimString(apiConfig.contentLanguage || apiConfig.language) || resolved.contentLanguage;
      resolved.imageStyle = trimString(apiConfig.imageStyle) || resolved.imageStyle;
      resolved.basePath = trimString(apiConfig.basePath) || resolved.basePath;
      resolved.title = trimString(apiConfig.siteName) || resolved.title;
    }

    resolved.siteId = trimString(siteId) || resolved.siteId;
    resolved.basePath = trimString(basePath).replace(/\/$/, "") || resolved.basePath;
    resolved.theme = trimString(themeOverride) || resolved.theme;
    resolved.title = trimString(titleOverride) || resolved.title;

    return resolved;
  }

  function applyContainerAttributes() {
    if (!container) {
      return;
    }

    container.setAttribute("lang", widgetConfig.contentLanguage || "en");
    container.setAttribute("data-site-name", widgetConfig.siteName || "");
    container.setAttribute("data-theme", widgetConfig.theme || "default");

    if (widgetConfig.imageStyle) {
      container.setAttribute("data-image-style", widgetConfig.imageStyle);
    } else {
      container.removeAttribute("data-image-style");
    }
  }

  function loadConfig() {
    return fetchJson("/api/public/sites/" + encodeURIComponent(siteId) + "/config")
      .then(function (payload) {
        widgetConfig = resolveConfig(payload);
        applyContainerAttributes();
      })
      .catch(function () {
        widgetConfig = resolveConfig(null);
        applyContainerAttributes();
      });
  }

  function renderList() {
    renderState("Loading articles...", "soro-loading");

    fetchJson("/api/public/sites/" + encodeURIComponent(siteId) + "/articles")
      .then(function (payload) {
        var articles = payload && Array.isArray(payload.articles) ? payload.articles : [];

        if (!articles.length) {
          renderState("No published articles are available yet for " + widgetConfig.siteName + ".");
          return;
        }

        var items = articles
          .map(function (article) {
            return (
              '<li class="soro-article-item">' +
              '<a href="#soro-article/' +
              encodeURIComponent(article.slug) +
              '" class="soro-link" data-slug="' +
              escapeHtml(article.slug) +
              '">' +
              escapeHtml(article.title) +
              "</a>" +
              (article.publishedAt
                ? '<p class="soro-widget-meta">' + escapeHtml(formatDate(article.publishedAt)) + "</p>"
                : "") +
              (article.excerpt
                ? '<p class="soro-excerpt">' + escapeHtml(article.excerpt) + "</p>"
                : "") +
              "</li>"
            );
          })
          .join("");

        renderShell(
          '<h2 class="soro-widget-title">' +
            escapeHtml(widgetConfig.title || widgetConfig.siteName || "Articles") +
            "</h2>" +
            '<ul class="soro-article-list">' +
            items +
            "</ul>"
        );

        var links = container.querySelectorAll("[data-slug]");
        for (var i = 0; i < links.length; i += 1) {
          links[i].addEventListener("click", function (event) {
            event.preventDefault();
            var slug = event.currentTarget.getAttribute("data-slug");
            setHash(slug);
          });
        }
      })
      .catch(function () {
        renderState("Unable to load articles right now.");
      });
  }

  function renderDetail(slug) {
    renderState("Loading article...", "soro-loading");

    fetchJson(
      "/api/public/sites/" +
        encodeURIComponent(siteId) +
        "/articles/" +
        encodeURIComponent(slug)
    )
      .then(function (payload) {
        var article = payload && payload.article ? payload.article : null;

        if (!article) {
          renderState("Article not found.");
          return;
        }

        renderShell(
          '<button type="button" class="soro-back-button">Back to Articles</button>' +
            '<article class="soro-article-detail">' +
            '<h1 class="soro-widget-title">' +
            escapeHtml(article.title) +
            "</h1>" +
            (article.publishedAt
              ? '<p class="soro-widget-meta">' + escapeHtml(formatDate(article.publishedAt)) + "</p>"
              : "") +
            '<div class="soro-content">' +
            (article.contentHtml || "") +
            "</div>" +
            "</article>"
        );

        var backButton = container.querySelector(".soro-back-button");
        if (backButton) {
          backButton.addEventListener("click", function () {
            setHash(null);
          });
        }
      })
      .catch(function (error) {
        if (error && error.status === 404) {
          renderState("Article not found.");
          return;
        }

        renderState("Unable to load this article right now.");
      });
  }

  function render() {
    var slug = getCurrentSlug();

    if (slug) {
      renderDetail(slug);
      return;
    }

    renderList();
  }

  window.addEventListener("hashchange", render);
  widgetConfig = resolveConfig(null);
  applyContainerAttributes();
  loadConfig().finally(render);
})();
