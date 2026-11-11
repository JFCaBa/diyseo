type ProxyConfigInput = {
  /** DIYSEO origin, e.g. https://diyseo.online (no trailing slash). */
  origin: string;
  siteId: string;
};

function originHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export function buildWorkerScript({ origin, siteId }: ProxyConfigInput): string {
  return `const DIYSEO_ORIGIN = "${origin}";
const SITE_ID = "${siteId}";
const BLOG_BASE = "/blog";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD"
        }
      });
    }

    if (url.pathname !== BLOG_BASE && !url.pathname.startsWith(BLOG_BASE + "/")) {
      return new Response("Not found", { status: 404 });
    }

    let originPath = "";

    if (url.pathname === BLOG_BASE || url.pathname === BLOG_BASE + "/") {
      originPath = "/blog/" + SITE_ID;
    } else if (url.pathname === BLOG_BASE + "/sitemap.xml") {
      originPath = "/blog/" + SITE_ID + "/sitemap.xml";
    } else if (url.pathname === BLOG_BASE + "/rss.xml") {
      originPath = "/blog/" + SITE_ID + "/rss.xml";
    } else if (url.pathname === BLOG_BASE + "/atom.xml") {
      originPath = "/blog/" + SITE_ID + "/atom.xml";
    } else {
      const remainder = url.pathname.slice((BLOG_BASE + "/").length).replace(/\\/$/, "");

      if (!remainder || remainder.includes("/")) {
        return new Response("Not found", { status: 404 });
      }

      originPath = "/blog/" + SITE_ID + "/" + remainder;
    }

    const originUrl = new URL(originPath + url.search, DIYSEO_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    headers.set("x-diyseo-site-id", SITE_ID);

    const response = await fetch(originUrl.toString(), {
      method: request.method,
      headers,
      redirect: "manual"
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
};`;
}

export function buildNginxConfig({ origin, siteId }: ProxyConfigInput): string {
  const host = originHost(origin);
  const proxy = `        proxy_pass ${origin};
        proxy_set_header Host ${host};
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;`;

  return `# Add inside the server { } block of your domain, then run:
#   nginx -t && systemctl reload nginx

# /blog  ->  blog home
location ~ ^/blog/?$ {
        rewrite ^ /blog/${siteId} break;
${proxy}
}

# /blog/<article>, /blog/sitemap.xml, /blog/rss.xml, /blog/atom.xml
location ~ ^/blog/([^/]+)/?$ {
        rewrite ^/blog/([^/]+)/?$ /blog/${siteId}/$1 break;
${proxy}
}
`;
}

export function buildApacheConfig({ origin, siteId }: ProxyConfigInput): string {
  return `# Add inside the <VirtualHost *:443> block of your domain.
# Required modules: proxy, proxy_http, ssl, rewrite, headers
#   a2enmod proxy proxy_http ssl rewrite headers && systemctl reload apache2

SSLProxyEngine On
SSLProxyCheckPeerName On
ProxyPreserveHost Off
ProxyAddHeaders On
RequestHeader set X-Forwarded-Proto "https"

RewriteEngine On
# /blog  ->  blog home
RewriteRule ^/blog/?$ ${origin}/blog/${siteId} [P,L]
# /blog/<article>, /blog/sitemap.xml, /blog/rss.xml, /blog/atom.xml
RewriteRule ^/blog/([^/]+)/?$ ${origin}/blog/${siteId}/$1 [P,L]
`;
}
