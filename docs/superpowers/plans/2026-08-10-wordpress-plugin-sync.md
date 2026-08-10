# DIYSEO Sync WordPress Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WordPress plugin (`diyseo-sync`) that pulls `PUBLISHED` articles from a DIYSEO site's Publishing API and syncs them into native WordPress posts, on a schedule and on demand.

**Architecture:** Pure-logic PHP classes (API client pagination/parsing, article→post field mapping, SEO-plugin meta mapping, cron schedule mapping) are unit-testable with plain `php` CLI and no WordPress runtime. A thin WordPress-dependent orchestration layer (Engine, Settings admin UI, Ajax handlers, bootstrap) wires those pure classes to real WordPress APIs (`wp_insert_post`, `get_posts`, `media_sideload_image`, admin screens) and is verified by `php -l` plus manual checks against a real WordPress install.

**Tech Stack:** Plain PHP (WordPress plugin conventions, PHP 8-compatible array/function style used across WP core), no Composer dependencies, no build step. Tests are standalone `php` CLI scripts under `wordpress-plugin/diyseo-sync/tests/` (no PHPUnit/WP test suite — none is set up in this repo and none is required for the pure logic being tested).

## Global Constraints

- Plugin lives at `wordpress-plugin/diyseo-sync/` in this repo.
- API base path: `/api/v1/sites/{siteId}/articles` (existing DIYSEO Publishing API v1, no DIYSEO-side changes).
- Auth: `Authorization: Bearer <key>` header, key format `diyseo_spk_...` (per `lib/site-publishing-api.ts`).
- List request always sends `status=PUBLISHED&include=content` and paginates via `cursor`/`nextCursor` until `nextCursor` is `null`.
- Article fields consumed: `id, title, slug, excerpt, coverImageUrl, seoTitle, seoDescription, updatedAt, contentHtml`.
- WordPress `post_type` is fixed to `post` for v1 — no custom post type, no category/tag mapping.
- Dedup postmeta key: `_diyseo_article_id`. Change-detection postmeta key: `_diyseo_updated_at`. Cover image cache postmeta key: `_diyseo_cover_image_source`.
- SEO meta keys: Yoast → `_yoast_wpseo_title` / `_yoast_wpseo_metadesc`; RankMath → `rank_math_title` / `rank_math_description`; neither active → no SEO meta written.
- All admin actions require the `manage_options` capability and a WordPress nonce.
- Unpublish behavior: a previously-synced post whose article is no longer in the current `PUBLISHED` set is set to `draft`. Posts are never deleted by the plugin.
- Sync interval options exposed in settings: `15min`, `30min`, `hourly`, `6hours`, `daily`.
- The API key is stored in `wp_options` as plain text (documented, accepted limitation — standard WP plugin convention).
- Pagination is capped at `DIYSEO_Sync_Client::MAX_PAGES` (50 pages) per run as a safety net against a runaway cursor loop or pathologically large catalog.
- The unpublish-to-draft pass never runs when the current fetch returned zero articles — this is a deliberate safeguard against a transient API failure or misconfiguration mass-drafting every previously synced post.
- Looking up whether a post already exists for a DIYSEO article considers all post statuses, including `trash` (WordPress's `post_status => 'any'` query excludes trash by default), to avoid creating a duplicate post when a synced post was moved to the trash.
- The plugin never deletes WordPress media/attachments; a stale featured image left over after `coverImageUrl` changes is an accepted limitation, documented in the readme, not auto-cleaned.

---

### Task 1: API client (`DIYSEO_Sync_Client`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-client.php`
- Test: `wordpress-plugin/diyseo-sync/tests/client-test.php`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `class DIYSEO_Sync_Api_Exception extends Exception {}`
  - `class DIYSEO_Sync_Client { const MAX_PAGES = 50; public function __construct($base_url, $site_id, $api_key, ?callable $http_get = null); public function list_published_articles($limit = 50): array; public function test_connection(): array; public function build_url($path, array $query): string; public function build_headers(): array; }`
  - `list_published_articles()` returns a flat array of article associative arrays (merged across all pages), each shaped like the DIYSEO API's `articles[]` entries (`id`, `title`, `slug`, `excerpt`, `coverImageUrl`, `seoTitle`, `seoDescription`, `status`, `publishedAt`, `createdAt`, `updatedAt`, `contentHtml`, ...). Throws `DIYSEO_Sync_Api_Exception` on transport/HTTP/parse errors. Stops after `MAX_PAGES` pages even if `nextCursor` keeps returning a value, so a misbehaving cursor can never hang the run indefinitely.
  - `test_connection()` sends the same `status=PUBLISHED&include=content` filters as `list_published_articles()` (with `limit=1`), so a successful test reflects the exact request the real sync will make. Returns `['ok' => bool, 'message' => string]` and never throws.
  - The optional `$http_get` constructor argument is `function(string $url, array $headers): array` returning `['status' => int, 'body' => string]`. When omitted, it defaults to a private method that calls `wp_remote_get()` (only reachable inside WordPress).

- [ ] **Step 1: Write the failing test**

Create `wordpress-plugin/diyseo-sync/tests/client-test.php`:

```php
<?php
require_once __DIR__ . '/../includes/class-diyseo-sync-client.php';

function assert_true($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: $message\n");
        exit(1);
    }
    echo "PASS: $message\n";
}

$calls = array();
$fake_transport = function ($url, $headers) use (&$calls) {
    $calls[] = $url;
    if (count($calls) === 1) {
        return array(
            'status' => 200,
            'body' => json_encode(array(
                'siteId' => 'site_1',
                'articles' => array(array('id' => 'a1', 'title' => 'One', 'slug' => 'one', 'updatedAt' => '2026-01-01T00:00:00.000Z')),
                'nextCursor' => 'cursor_2'
            ))
        );
    }
    return array(
        'status' => 200,
        'body' => json_encode(array(
            'siteId' => 'site_1',
            'articles' => array(array('id' => 'a2', 'title' => 'Two', 'slug' => 'two', 'updatedAt' => '2026-01-02T00:00:00.000Z')),
            'nextCursor' => null
        ))
    );
};

$client = new DIYSEO_Sync_Client('https://example.com', 'site_1', 'diyseo_spk_test', $fake_transport);
$articles = $client->list_published_articles();

assert_true(count($articles) === 2, 'list_published_articles merges all pages');
assert_true($articles[0]['id'] === 'a1' && $articles[1]['id'] === 'a2', 'list_published_articles preserves order');
assert_true(count($calls) === 2, 'list_published_articles stops after nextCursor is null');
assert_true(strpos($calls[0], 'status=PUBLISHED') !== false, 'request includes status=PUBLISHED filter');
assert_true(strpos($calls[0], 'include=content') !== false, 'request includes include=content');
assert_true(strpos($calls[1], 'cursor=cursor_2') !== false, 'second request includes cursor from first response');

$error_transport = function ($url, $headers) {
    return array('status' => 401, 'body' => json_encode(array('error' => 'Invalid or revoked publishing API key.')));
};
$error_client = new DIYSEO_Sync_Client('https://example.com', 'site_1', 'bad-key', $error_transport);
try {
    $error_client->list_published_articles();
    assert_true(false, 'list_published_articles throws on non-2xx response');
} catch (DIYSEO_Sync_Api_Exception $e) {
    assert_true(strpos($e->getMessage(), '401') !== false, 'list_published_articles throws on non-2xx response');
}

$result = $error_client->test_connection();
assert_true($result['ok'] === false, 'test_connection returns ok=false on failure instead of throwing');

$page_calls = 0;
$never_ending_transport = function ($url, $headers) use (&$page_calls) {
    $page_calls++;
    return array(
        'status' => 200,
        'body' => json_encode(array('siteId' => 'site_1', 'articles' => array(), 'nextCursor' => 'always-more'))
    );
};
$capped_client = new DIYSEO_Sync_Client('https://example.com', 'site_1', 'diyseo_spk_test', $never_ending_transport);
$capped_client->list_published_articles();
assert_true($page_calls === DIYSEO_Sync_Client::MAX_PAGES, 'list_published_articles stops after MAX_PAGES to avoid an unbounded loop');

$test_connection_calls = array();
$test_connection_transport = function ($url, $headers) use (&$test_connection_calls) {
    $test_connection_calls[] = $url;
    return array('status' => 200, 'body' => json_encode(array('siteId' => 'site_1', 'articles' => array(), 'nextCursor' => null)));
};
$tc_client = new DIYSEO_Sync_Client('https://example.com', 'site_1', 'diyseo_spk_test', $test_connection_transport);
$tc_client->test_connection();
assert_true(strpos($test_connection_calls[0], 'status=PUBLISHED') !== false, 'test_connection includes status=PUBLISHED filter for consistency with list requests');
assert_true(strpos($test_connection_calls[0], 'limit=1') !== false, 'test_connection requests only a single article');

echo "All client tests passed.\n";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php wordpress-plugin/diyseo-sync/tests/client-test.php`
Expected: fatal error — `class-diyseo-sync-client.php` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-client.php`:

```php
<?php
if (!defined('ABSPATH') && !defined('DIYSEO_SYNC_TESTING')) {
    define('DIYSEO_SYNC_TESTING', true);
}

class DIYSEO_Sync_Api_Exception extends Exception {}

class DIYSEO_Sync_Client {
    const MAX_PAGES = 50;

    private $base_url;
    private $site_id;
    private $api_key;
    private $http_get;

    public function __construct($base_url, $site_id, $api_key, ?callable $http_get = null) {
        $this->base_url = rtrim($base_url, '/');
        $this->site_id = $site_id;
        $this->api_key = $api_key;
        $this->http_get = $http_get ?: array($this, 'wp_http_get');
    }

    public function list_published_articles($limit = 50) {
        $articles = array();
        $cursor = null;
        $page_count = 0;

        do {
            $query = array(
                'status' => 'PUBLISHED',
                'include' => 'content',
                'limit' => $limit
            );
            if ($cursor) {
                $query['cursor'] = $cursor;
            }

            $url = $this->build_url('/api/v1/sites/' . rawurlencode($this->site_id) . '/articles', $query);
            $response = call_user_func($this->http_get, $url, $this->build_headers());
            $decoded = $this->decode_response($response);

            foreach ($decoded['articles'] as $article) {
                $articles[] = $article;
            }

            $cursor = isset($decoded['nextCursor']) ? $decoded['nextCursor'] : null;
            $page_count++;
        } while ($cursor && $page_count < self::MAX_PAGES);

        return $articles;
    }

    public function test_connection() {
        try {
            $url = $this->build_url('/api/v1/sites/' . rawurlencode($this->site_id) . '/articles', array(
                'status' => 'PUBLISHED',
                'include' => 'content',
                'limit' => 1
            ));
            $response = call_user_func($this->http_get, $url, $this->build_headers());
            $this->decode_response($response);
            return array('ok' => true, 'message' => 'Connected successfully.');
        } catch (DIYSEO_Sync_Api_Exception $e) {
            return array('ok' => false, 'message' => $e->getMessage());
        }
    }

    public function build_url($path, array $query) {
        return $this->base_url . $path . '?' . http_build_query($query);
    }

    public function build_headers() {
        return array('Authorization' => 'Bearer ' . $this->api_key);
    }

    private function decode_response($response) {
        if (!is_array($response) || !isset($response['status']) || !isset($response['body'])) {
            throw new DIYSEO_Sync_Api_Exception('Invalid HTTP transport response.');
        }
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new DIYSEO_Sync_Api_Exception('DIYSEO API returned HTTP ' . $response['status'] . ': ' . $response['body']);
        }
        $decoded = json_decode($response['body'], true);
        if (!is_array($decoded) || !isset($decoded['articles']) || !is_array($decoded['articles'])) {
            throw new DIYSEO_Sync_Api_Exception('Unexpected DIYSEO API response shape.');
        }
        return $decoded;
    }

    private function wp_http_get($url, $headers) {
        $response = wp_remote_get($url, array('headers' => $headers, 'timeout' => 20));
        if (is_wp_error($response)) {
            throw new DIYSEO_Sync_Api_Exception($response->get_error_message());
        }
        return array(
            'status' => wp_remote_retrieve_response_code($response),
            'body' => wp_remote_retrieve_body($response)
        );
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php wordpress-plugin/diyseo-sync/tests/client-test.php`
Expected: all `PASS:` lines followed by `All client tests passed.`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-client.php wordpress-plugin/diyseo-sync/tests/client-test.php
git commit -m "Add DIYSEO Sync API client with pagination and injectable transport"
```

---

### Task 2: Article-to-post mapper (`DIYSEO_Sync_Mapper`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-mapper.php`
- Test: `wordpress-plugin/diyseo-sync/tests/mapper-test.php`

**Interfaces:**
- Consumes: nothing (pure logic, no dependency on Task 1's class).
- Produces:
  - `class DIYSEO_Sync_Mapper { const ACTION_CREATE = 'create'; const ACTION_UPDATE = 'update'; const ACTION_SKIP = 'skip'; public static function decide_action(array $article, $existing_updated_at): string; public static function map_to_post_array(array $article, $author_id, $existing_post_id = null): array; public static function find_stale_post_ids(array $synced_post_ids_by_article_id, array $seen_article_ids): array; public static function is_valid_article(array $article): bool; public static function should_run_unpublish_pass(array $seen_article_ids): bool; }`
  - `map_to_post_array()` returns an array with keys `post_title`, `post_content`, `post_excerpt`, `post_name`, `post_status`, `post_type`, `post_author`, and `ID` (only when `$existing_post_id` is truthy) — this is the exact shape later tasks pass to `wp_insert_post()`.
  - `find_stale_post_ids()` takes `[$article_id => $post_id]` for all currently-published synced posts and the array of article ids seen in the current run; returns the list of `$post_id` values whose article id was not seen.
  - `is_valid_article()` returns `true` only when `id`, `title`, `slug` are non-empty and `updatedAt` is set and non-empty. The Engine (Task 6) must call this before touching an article and skip (with a logged error) anything that fails it, instead of trusting the API response shape blindly.
  - `should_run_unpublish_pass()` returns `true` only when `$seen_article_ids` is non-empty. This is the guard against the case where the DIYSEO API call succeeds but returns zero articles (transient failure, misconfiguration) — without it, every previously synced post would be mass-drafted.

- [ ] **Step 1: Write the failing test**

Create `wordpress-plugin/diyseo-sync/tests/mapper-test.php`:

```php
<?php
require_once __DIR__ . '/../includes/class-diyseo-sync-mapper.php';

function assert_true($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: $message\n");
        exit(1);
    }
    echo "PASS: $message\n";
}

$article = array(
    'id' => 'a1',
    'title' => 'Hello World',
    'slug' => 'hello-world',
    'excerpt' => 'Short summary',
    'contentHtml' => '<p>Body</p>',
    'updatedAt' => '2026-02-01T00:00:00.000Z'
);

assert_true(
    DIYSEO_Sync_Mapper::decide_action($article, null) === DIYSEO_Sync_Mapper::ACTION_CREATE,
    'decide_action returns create when no existing post'
);
assert_true(
    DIYSEO_Sync_Mapper::decide_action($article, '2026-01-01T00:00:00.000Z') === DIYSEO_Sync_Mapper::ACTION_UPDATE,
    'decide_action returns update when updatedAt changed'
);
assert_true(
    DIYSEO_Sync_Mapper::decide_action($article, '2026-02-01T00:00:00.000Z') === DIYSEO_Sync_Mapper::ACTION_SKIP,
    'decide_action returns skip when updatedAt unchanged'
);

$post = DIYSEO_Sync_Mapper::map_to_post_array($article, 5, null);
assert_true($post['post_title'] === 'Hello World', 'map_to_post_array maps title');
assert_true($post['post_content'] === '<p>Body</p>', 'map_to_post_array maps contentHtml to post_content');
assert_true($post['post_excerpt'] === 'Short summary', 'map_to_post_array maps excerpt');
assert_true($post['post_name'] === 'hello-world', 'map_to_post_array maps slug to post_name');
assert_true($post['post_status'] === 'publish', 'map_to_post_array sets post_status to publish');
assert_true($post['post_author'] === 5, 'map_to_post_array sets post_author from argument');
assert_true(!isset($post['ID']), 'map_to_post_array omits ID when creating');

$updated_post = DIYSEO_Sync_Mapper::map_to_post_array($article, 5, 42);
assert_true($updated_post['ID'] === 42, 'map_to_post_array includes ID when updating existing post');

$stale = DIYSEO_Sync_Mapper::find_stale_post_ids(
    array('a1' => 101, 'a2' => 102, 'a3' => 103),
    array('a1', 'a3')
);
assert_true($stale === array(102), 'find_stale_post_ids returns post ids no longer in the seen set');

assert_true(
    DIYSEO_Sync_Mapper::is_valid_article($article) === true,
    'is_valid_article accepts an article with all required fields'
);
assert_true(
    DIYSEO_Sync_Mapper::is_valid_article(array('title' => 'X', 'slug' => 'x', 'updatedAt' => '2026-01-01T00:00:00.000Z')) === false,
    'is_valid_article rejects an article missing id'
);
assert_true(
    DIYSEO_Sync_Mapper::is_valid_article(array('id' => 'a1', 'slug' => 'x', 'updatedAt' => '2026-01-01T00:00:00.000Z')) === false,
    'is_valid_article rejects an article missing title'
);
assert_true(
    DIYSEO_Sync_Mapper::is_valid_article(array('id' => 'a1', 'title' => 'X', 'updatedAt' => '2026-01-01T00:00:00.000Z')) === false,
    'is_valid_article rejects an article missing slug'
);
assert_true(
    DIYSEO_Sync_Mapper::is_valid_article(array('id' => 'a1', 'title' => 'X', 'slug' => 'x')) === false,
    'is_valid_article rejects an article missing updatedAt'
);

assert_true(
    DIYSEO_Sync_Mapper::should_run_unpublish_pass(array('a1')) === true,
    'should_run_unpublish_pass returns true when at least one article was seen'
);
assert_true(
    DIYSEO_Sync_Mapper::should_run_unpublish_pass(array()) === false,
    'should_run_unpublish_pass returns false when zero articles were seen, to avoid mass-unpublishing on an empty/failed fetch'
);

echo "All mapper tests passed.\n";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php wordpress-plugin/diyseo-sync/tests/mapper-test.php`
Expected: fatal error — `class-diyseo-sync-mapper.php` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-mapper.php`:

```php
<?php

class DIYSEO_Sync_Mapper {
    const ACTION_CREATE = 'create';
    const ACTION_UPDATE = 'update';
    const ACTION_SKIP = 'skip';

    public static function decide_action(array $article, $existing_updated_at) {
        if ($existing_updated_at === null || $existing_updated_at === '') {
            return self::ACTION_CREATE;
        }
        if ($existing_updated_at !== $article['updatedAt']) {
            return self::ACTION_UPDATE;
        }
        return self::ACTION_SKIP;
    }

    public static function map_to_post_array(array $article, $author_id, $existing_post_id = null) {
        $post = array(
            'post_title' => $article['title'],
            'post_content' => isset($article['contentHtml']) ? $article['contentHtml'] : '',
            'post_excerpt' => isset($article['excerpt']) ? (string) $article['excerpt'] : '',
            'post_name' => $article['slug'],
            'post_status' => 'publish',
            'post_type' => 'post',
            'post_author' => (int) $author_id
        );

        if ($existing_post_id) {
            $post['ID'] = $existing_post_id;
        }

        return $post;
    }

    public static function find_stale_post_ids(array $synced_post_ids_by_article_id, array $seen_article_ids) {
        $seen = array_flip($seen_article_ids);
        $stale = array();

        foreach ($synced_post_ids_by_article_id as $article_id => $post_id) {
            if (!isset($seen[$article_id])) {
                $stale[] = $post_id;
            }
        }

        return $stale;
    }

    public static function is_valid_article(array $article) {
        return !empty($article['id'])
            && !empty($article['title'])
            && !empty($article['slug'])
            && isset($article['updatedAt'])
            && $article['updatedAt'] !== '';
    }

    public static function should_run_unpublish_pass(array $seen_article_ids) {
        return count($seen_article_ids) > 0;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php wordpress-plugin/diyseo-sync/tests/mapper-test.php`
Expected: all `PASS:` lines followed by `All mapper tests passed.`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-mapper.php wordpress-plugin/diyseo-sync/tests/mapper-test.php
git commit -m "Add DIYSEO Sync article-to-post mapping logic"
```

---

### Task 3: SEO plugin meta mapping (`DIYSEO_Sync_Seo`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-seo.php`
- Test: `wordpress-plugin/diyseo-sync/tests/seo-test.php`
- Test: `wordpress-plugin/diyseo-sync/tests/seo-yoast-detection-test.php`
- Test: `wordpress-plugin/diyseo-sync/tests/seo-rankmath-detection-test.php`

**Interfaces:**
- Consumes: nothing (pure logic).
- Produces:
  - `class DIYSEO_Sync_Seo { const PROVIDER_YOAST = 'yoast'; const PROVIDER_RANKMATH = 'rankmath'; const PROVIDER_NONE = 'none'; public static function detect_provider(): string; public static function build_meta_for_provider($provider, $seo_title, $seo_description): array; }`
  - `detect_provider()` returns `PROVIDER_YOAST` when the `WPSEO_Options` class exists, `PROVIDER_RANKMATH` when the `RankMath` class exists, otherwise `PROVIDER_NONE`.
  - `build_meta_for_provider()` returns `[metaKey => value]` pairs to write via `update_post_meta()`, omitting any key whose value is `null` or `''`.

- [ ] **Step 1: Write the failing tests**

Create `wordpress-plugin/diyseo-sync/tests/seo-test.php`:

```php
<?php
require_once __DIR__ . '/../includes/class-diyseo-sync-seo.php';

function assert_true($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: $message\n");
        exit(1);
    }
    echo "PASS: $message\n";
}

assert_true(
    DIYSEO_Sync_Seo::detect_provider() === DIYSEO_Sync_Seo::PROVIDER_NONE,
    'detect_provider returns none when neither Yoast nor RankMath classes exist'
);

$yoast_meta = DIYSEO_Sync_Seo::build_meta_for_provider(DIYSEO_Sync_Seo::PROVIDER_YOAST, 'My SEO Title', 'My SEO description');
assert_true($yoast_meta['_yoast_wpseo_title'] === 'My SEO Title', 'build_meta_for_provider maps yoast title');
assert_true($yoast_meta['_yoast_wpseo_metadesc'] === 'My SEO description', 'build_meta_for_provider maps yoast description');

$rankmath_meta = DIYSEO_Sync_Seo::build_meta_for_provider(DIYSEO_Sync_Seo::PROVIDER_RANKMATH, 'RM Title', null);
assert_true($rankmath_meta['rank_math_title'] === 'RM Title', 'build_meta_for_provider maps rankmath title');
assert_true(!isset($rankmath_meta['rank_math_description']), 'build_meta_for_provider omits null description');

$none_meta = DIYSEO_Sync_Seo::build_meta_for_provider(DIYSEO_Sync_Seo::PROVIDER_NONE, 'Title', 'Description');
assert_true($none_meta === array(), 'build_meta_for_provider returns empty array when no provider detected');

echo "All seo tests passed.\n";
```

Create `wordpress-plugin/diyseo-sync/tests/seo-yoast-detection-test.php`:

```php
<?php
class WPSEO_Options {}
require_once __DIR__ . '/../includes/class-diyseo-sync-seo.php';

if (DIYSEO_Sync_Seo::detect_provider() !== DIYSEO_Sync_Seo::PROVIDER_YOAST) {
    fwrite(STDERR, "FAIL: detect_provider returns yoast when WPSEO_Options class exists\n");
    exit(1);
}
echo "PASS: detect_provider returns yoast when WPSEO_Options class exists\n";
```

Create `wordpress-plugin/diyseo-sync/tests/seo-rankmath-detection-test.php`:

```php
<?php
class RankMath {}
require_once __DIR__ . '/../includes/class-diyseo-sync-seo.php';

if (DIYSEO_Sync_Seo::detect_provider() !== DIYSEO_Sync_Seo::PROVIDER_RANKMATH) {
    fwrite(STDERR, "FAIL: detect_provider returns rankmath when RankMath class exists\n");
    exit(1);
}
echo "PASS: detect_provider returns rankmath when RankMath class exists\n";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php wordpress-plugin/diyseo-sync/tests/seo-test.php`
Expected: fatal error — `class-diyseo-sync-seo.php` does not exist yet. (Same for the other two files.)

- [ ] **Step 3: Write minimal implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-seo.php`:

```php
<?php

class DIYSEO_Sync_Seo {
    const PROVIDER_YOAST = 'yoast';
    const PROVIDER_RANKMATH = 'rankmath';
    const PROVIDER_NONE = 'none';

    public static function detect_provider() {
        if (class_exists('WPSEO_Options')) {
            return self::PROVIDER_YOAST;
        }
        if (class_exists('RankMath')) {
            return self::PROVIDER_RANKMATH;
        }
        return self::PROVIDER_NONE;
    }

    public static function build_meta_for_provider($provider, $seo_title, $seo_description) {
        if ($provider === self::PROVIDER_YOAST) {
            return self::filter_empty(array(
                '_yoast_wpseo_title' => $seo_title,
                '_yoast_wpseo_metadesc' => $seo_description
            ));
        }

        if ($provider === self::PROVIDER_RANKMATH) {
            return self::filter_empty(array(
                'rank_math_title' => $seo_title,
                'rank_math_description' => $seo_description
            ));
        }

        return array();
    }

    private static function filter_empty(array $meta) {
        $result = array();
        foreach ($meta as $key => $value) {
            if ($value !== null && $value !== '') {
                $result[$key] = $value;
            }
        }
        return $result;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
php wordpress-plugin/diyseo-sync/tests/seo-test.php
php wordpress-plugin/diyseo-sync/tests/seo-yoast-detection-test.php
php wordpress-plugin/diyseo-sync/tests/seo-rankmath-detection-test.php
```
Expected: all three print only `PASS:` lines and exit 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-seo.php wordpress-plugin/diyseo-sync/tests/seo-test.php wordpress-plugin/diyseo-sync/tests/seo-yoast-detection-test.php wordpress-plugin/diyseo-sync/tests/seo-rankmath-detection-test.php
git commit -m "Add DIYSEO Sync Yoast/RankMath SEO meta mapping"
```

---

### Task 4: Cron scheduling (`DIYSEO_Sync_Cron`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-cron.php`
- Test: `wordpress-plugin/diyseo-sync/tests/cron-test.php`

**Interfaces:**
- Consumes: nothing (pure logic for the tested parts).
- Produces:
  - `class DIYSEO_Sync_Cron { const HOOK = 'diyseo_sync_run_event'; public static function build_schedules(array $existing_schedules): array; public static function interval_key_for_setting($setting_value): string; public function register_hooks(): void; public static function reschedule($enabled, $setting_value): void; }`
  - `interval_key_for_setting()` maps the settings string (`'15min'|'30min'|'hourly'|'6hours'|'daily'`) to the WP cron schedule key to use, falling back to `'hourly'` for anything unrecognized. This is the exact function `DIYSEO_Sync_Settings::maybe_save_settings()` (Task 5) and `diyseo_sync_activate()` (Task 8) call through `reschedule()`.
  - `register_hooks()` hooks `build_schedules` onto the `cron_schedules` filter and `DIYSEO_Sync_Engine::run_scheduled` (Task 6) onto `self::HOOK`.

- [ ] **Step 1: Write the failing test**

Create `wordpress-plugin/diyseo-sync/tests/cron-test.php`:

```php
<?php
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);
require_once __DIR__ . '/../includes/class-diyseo-sync-cron.php';

function assert_true($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: $message\n");
        exit(1);
    }
    echo "PASS: $message\n";
}

$schedules = DIYSEO_Sync_Cron::build_schedules(array('hourly' => array('interval' => 3600, 'display' => 'Once Hourly')));
assert_true(isset($schedules['diyseo_sync_15min']) && $schedules['diyseo_sync_15min']['interval'] === 900, 'build_schedules adds a 15 minute interval');
assert_true(isset($schedules['diyseo_sync_30min']) && $schedules['diyseo_sync_30min']['interval'] === 1800, 'build_schedules adds a 30 minute interval');
assert_true(isset($schedules['diyseo_sync_6hours']) && $schedules['diyseo_sync_6hours']['interval'] === 21600, 'build_schedules adds a 6 hour interval');
assert_true(isset($schedules['hourly']), 'build_schedules preserves existing WordPress schedules');

assert_true(DIYSEO_Sync_Cron::interval_key_for_setting('15min') === 'diyseo_sync_15min', 'interval_key_for_setting maps 15min setting to custom schedule key');
assert_true(DIYSEO_Sync_Cron::interval_key_for_setting('30min') === 'diyseo_sync_30min', 'interval_key_for_setting maps 30min setting to custom schedule key');
assert_true(DIYSEO_Sync_Cron::interval_key_for_setting('hourly') === 'hourly', 'interval_key_for_setting maps hourly setting to WP core schedule');
assert_true(DIYSEO_Sync_Cron::interval_key_for_setting('6hours') === 'diyseo_sync_6hours', 'interval_key_for_setting maps 6hours setting to custom schedule key');
assert_true(DIYSEO_Sync_Cron::interval_key_for_setting('daily') === 'daily', 'interval_key_for_setting maps daily setting to WP core schedule');
assert_true(DIYSEO_Sync_Cron::interval_key_for_setting('unknown') === 'hourly', 'interval_key_for_setting falls back to hourly for unrecognized values');

echo "All cron tests passed.\n";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php wordpress-plugin/diyseo-sync/tests/cron-test.php`
Expected: fatal error — `class-diyseo-sync-cron.php` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-cron.php`:

```php
<?php

class DIYSEO_Sync_Cron {
    const HOOK = 'diyseo_sync_run_event';

    public static function build_schedules(array $existing_schedules) {
        $existing_schedules['diyseo_sync_15min'] = array(
            'interval' => 15 * MINUTE_IN_SECONDS,
            'display' => 'Every 15 Minutes (DIYSEO Sync)'
        );
        $existing_schedules['diyseo_sync_30min'] = array(
            'interval' => 30 * MINUTE_IN_SECONDS,
            'display' => 'Every 30 Minutes (DIYSEO Sync)'
        );
        $existing_schedules['diyseo_sync_6hours'] = array(
            'interval' => 6 * HOUR_IN_SECONDS,
            'display' => 'Every 6 Hours (DIYSEO Sync)'
        );
        return $existing_schedules;
    }

    public static function interval_key_for_setting($setting_value) {
        $map = array(
            '15min' => 'diyseo_sync_15min',
            '30min' => 'diyseo_sync_30min',
            'hourly' => 'hourly',
            '6hours' => 'diyseo_sync_6hours',
            'daily' => 'daily'
        );
        return isset($map[$setting_value]) ? $map[$setting_value] : 'hourly';
    }

    public function register_hooks() {
        add_filter('cron_schedules', array(__CLASS__, 'build_schedules'));
        add_action(self::HOOK, array('DIYSEO_Sync_Engine', 'run_scheduled'));
    }

    public static function reschedule($enabled, $setting_value) {
        $timestamp = wp_next_scheduled(self::HOOK);
        if ($timestamp) {
            wp_unschedule_event($timestamp, self::HOOK);
        }
        if ($enabled) {
            wp_schedule_event(time(), self::interval_key_for_setting($setting_value), self::HOOK);
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php wordpress-plugin/diyseo-sync/tests/cron-test.php`
Expected: all `PASS:` lines followed by `All cron tests passed.`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-cron.php wordpress-plugin/diyseo-sync/tests/cron-test.php
git commit -m "Add DIYSEO Sync cron schedule registration and interval mapping"
```

---

### Task 5: Settings storage and admin screen (`DIYSEO_Sync_Settings`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-settings.php`
- Create: `wordpress-plugin/diyseo-sync/includes/views/settings-page.php`
- Test: `wordpress-plugin/diyseo-sync/tests/lint-settings.sh` (lint-only, no WordPress runtime available)

**Interfaces:**
- Consumes: `DIYSEO_Sync_Cron::reschedule($enabled, $setting_value)` (Task 4).
- Produces:
  - `class DIYSEO_Sync_Settings { const OPTION_KEY = 'diyseo_sync_settings'; const NONCE_ACTION = 'diyseo_sync_settings_save'; const AJAX_TEST_ACTION = 'diyseo_sync_test_connection'; const AJAX_SYNC_ACTION = 'diyseo_sync_run_now'; public function register_hooks(): void; public static function get_settings(): array; public function add_settings_page(): void; public function maybe_save_settings(): void; public function render_settings_page(): void; }`
  - `get_settings()` always returns an array with keys `base_url`, `site_id`, `api_key`, `author_id`, `interval`, `enabled` (defaults applied via `wp_parse_args`) — this is the exact shape `DIYSEO_Sync_Engine` (Task 6) reads.
  - `register_hooks()` wires `admin_menu` → `add_settings_page`, and `admin_init` → `maybe_save_settings`. It does **not** register the `wp_ajax_*` hooks — those are registered by `DIYSEO_Sync_Ajax` in Task 7, which reuses the `AJAX_TEST_ACTION` / `AJAX_SYNC_ACTION` / `NONCE_ACTION` constants defined here.

- [ ] **Step 1: Write the (lint) verification script**

There is no WordPress runtime in this repo, so this task is verified with a PHP syntax lint rather than a behavioral unit test — the class exercises WordPress-only functions (`add_action`, `wp_parse_args`, `wp_nonce_field`, etc.) that don't exist outside WordPress.

Create `wordpress-plugin/diyseo-sync/tests/lint-settings.sh`:

```bash
#!/bin/sh
set -e
php -l "$(dirname "$0")/../includes/class-diyseo-sync-settings.php"
php -l "$(dirname "$0")/../includes/views/settings-page.php"
```

Make it executable: `chmod +x wordpress-plugin/diyseo-sync/tests/lint-settings.sh`

- [ ] **Step 2: Run the script to verify it fails**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-settings.sh`
Expected: `php -l` fails — the target files don't exist yet.

- [ ] **Step 3: Write the implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-settings.php`:

```php
<?php

class DIYSEO_Sync_Settings {
    const OPTION_KEY = 'diyseo_sync_settings';
    const NONCE_ACTION = 'diyseo_sync_settings_save';
    const AJAX_TEST_ACTION = 'diyseo_sync_test_connection';
    const AJAX_SYNC_ACTION = 'diyseo_sync_run_now';

    public function register_hooks() {
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'maybe_save_settings'));
    }

    public static function get_settings() {
        $defaults = array(
            'base_url' => '',
            'site_id' => '',
            'api_key' => '',
            'author_id' => get_current_user_id(),
            'interval' => 'hourly',
            'enabled' => false
        );
        return wp_parse_args(get_option(self::OPTION_KEY, array()), $defaults);
    }

    public function add_settings_page() {
        add_options_page(
            'DIYSEO Sync',
            'DIYSEO Sync',
            'manage_options',
            'diyseo-sync',
            array($this, 'render_settings_page')
        );
    }

    public function maybe_save_settings() {
        if (!isset($_POST['diyseo_sync_nonce'])) {
            return;
        }
        if (!current_user_can('manage_options')) {
            return;
        }
        if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['diyseo_sync_nonce'])), self::NONCE_ACTION)) {
            return;
        }

        $previous = self::get_settings();

        $settings = array(
            'base_url' => isset($_POST['diyseo_base_url']) ? esc_url_raw(wp_unslash($_POST['diyseo_base_url'])) : '',
            'site_id' => isset($_POST['diyseo_site_id']) ? sanitize_text_field(wp_unslash($_POST['diyseo_site_id'])) : '',
            'api_key' => isset($_POST['diyseo_api_key']) ? sanitize_text_field(wp_unslash($_POST['diyseo_api_key'])) : '',
            'author_id' => isset($_POST['diyseo_author_id']) ? absint($_POST['diyseo_author_id']) : get_current_user_id(),
            'interval' => isset($_POST['diyseo_interval']) ? sanitize_text_field(wp_unslash($_POST['diyseo_interval'])) : 'hourly',
            'enabled' => !empty($_POST['diyseo_enabled'])
        );

        update_option(self::OPTION_KEY, $settings);

        if ($settings['enabled'] !== $previous['enabled'] || $settings['interval'] !== $previous['interval']) {
            DIYSEO_Sync_Cron::reschedule($settings['enabled'], $settings['interval']);
        }

        add_settings_error('diyseo_sync', 'diyseo_sync_saved', 'Settings saved.', 'success');
    }

    public function render_settings_page() {
        $settings = self::get_settings();
        $last_run = get_option('diyseo_sync_last_run');
        $log = get_option('diyseo_sync_log', array());
        require DIYSEO_SYNC_PLUGIN_DIR . 'includes/views/settings-page.php';
    }
}
```

Create `wordpress-plugin/diyseo-sync/includes/views/settings-page.php`:

```php
<?php if (!defined('ABSPATH')) { exit; } ?>
<div class="wrap">
  <h1>DIYSEO Sync</h1>

  <?php settings_errors('diyseo_sync'); ?>

  <form method="post">
    <?php wp_nonce_field(DIYSEO_Sync_Settings::NONCE_ACTION, 'diyseo_sync_nonce'); ?>
    <table class="form-table">
      <tr>
        <th><label for="diyseo_base_url">DIYSEO Base URL</label></th>
        <td><input type="url" id="diyseo_base_url" name="diyseo_base_url" class="regular-text" value="<?php echo esc_attr($settings['base_url']); ?>" placeholder="https://your-app.example.com" required></td>
      </tr>
      <tr>
        <th><label for="diyseo_site_id">Site ID</label></th>
        <td><input type="text" id="diyseo_site_id" name="diyseo_site_id" class="regular-text" value="<?php echo esc_attr($settings['site_id']); ?>" required></td>
      </tr>
      <tr>
        <th><label for="diyseo_api_key">API Key</label></th>
        <td>
          <input type="password" id="diyseo_api_key" name="diyseo_api_key" class="regular-text" value="<?php echo esc_attr($settings['api_key']); ?>" required>
          <p><button type="button" class="button" id="diyseo-test-connection">Test connection</button> <span id="diyseo-test-connection-result"></span></p>
        </td>
      </tr>
      <tr>
        <th><label for="diyseo_author_id">WordPress Author</label></th>
        <td>
          <?php
          wp_dropdown_users(array(
            'name' => 'diyseo_author_id',
            'id' => 'diyseo_author_id',
            'selected' => $settings['author_id'],
            'capability' => 'edit_posts'
          ));
          ?>
        </td>
      </tr>
      <tr>
        <th><label for="diyseo_interval">Sync interval</label></th>
        <td>
          <select id="diyseo_interval" name="diyseo_interval">
            <?php
            $intervals = array(
              '15min' => 'Every 15 minutes',
              '30min' => 'Every 30 minutes',
              'hourly' => 'Hourly',
              '6hours' => 'Every 6 hours',
              'daily' => 'Daily'
            );
            foreach ($intervals as $value => $label) {
              printf(
                '<option value="%1$s"%2$s>%3$s</option>',
                esc_attr($value),
                selected($settings['interval'], $value, false),
                esc_html($label)
              );
            }
            ?>
          </select>
        </td>
      </tr>
      <tr>
        <th><label for="diyseo_enabled">Automatic sync enabled</label></th>
        <td><input type="checkbox" id="diyseo_enabled" name="diyseo_enabled" value="1" <?php checked($settings['enabled']); ?>></td>
      </tr>
    </table>
    <?php submit_button('Save Settings'); ?>
  </form>

  <p>
    <button type="button" class="button button-primary" id="diyseo-sync-now">Sync now</button>
    <span id="diyseo-sync-now-result"></span>
  </p>

  <h2>Last run</h2>
  <?php if ($last_run) : ?>
    <p>
      <?php echo esc_html(date_i18n('Y-m-d H:i:s', $last_run['timestamp'])); ?>
      &mdash;
      <?php echo esc_html(sprintf(
        '%d created, %d updated, %d unpublished, %d errors',
        $last_run['summary']['created'],
        $last_run['summary']['updated'],
        $last_run['summary']['unpublished'],
        count($last_run['summary']['errors'])
      )); ?>
    </p>
  <?php else : ?>
    <p>No sync has run yet.</p>
  <?php endif; ?>

  <h2>Log</h2>
  <ul>
    <?php foreach ($log as $entry) : ?>
      <li><?php echo esc_html($entry); ?></li>
    <?php endforeach; ?>
  </ul>
</div>

<script>
(function () {
  var nonce = <?php echo wp_json_encode(wp_create_nonce(DIYSEO_Sync_Settings::NONCE_ACTION)); ?>;
  var ajaxUrl = <?php echo wp_json_encode(admin_url('admin-ajax.php')); ?>;

  function post(action, data, onDone) {
    var body = new FormData();
    body.append('action', action);
    body.append('nonce', nonce);
    Object.keys(data || {}).forEach(function (key) {
      body.append(key, data[key]);
    });
    fetch(ajaxUrl, { method: 'POST', credentials: 'same-origin', body: body })
      .then(function (res) { return res.json(); })
      .then(onDone)
      .catch(function () { onDone({ success: false, data: { message: 'Request failed.' } }); });
  }

  document.getElementById('diyseo-test-connection').addEventListener('click', function () {
    var result = document.getElementById('diyseo-test-connection-result');
    result.textContent = 'Testing...';
    post('<?php echo esc_js(DIYSEO_Sync_Settings::AJAX_TEST_ACTION); ?>', {
      base_url: document.getElementById('diyseo_base_url').value,
      site_id: document.getElementById('diyseo_site_id').value,
      api_key: document.getElementById('diyseo_api_key').value
    }, function (response) {
      result.textContent = response.data && response.data.message ? response.data.message : (response.success ? 'OK' : 'Failed');
    });
  });

  document.getElementById('diyseo-sync-now').addEventListener('click', function () {
    var result = document.getElementById('diyseo-sync-now-result');
    result.textContent = 'Syncing...';
    post('<?php echo esc_js(DIYSEO_Sync_Settings::AJAX_SYNC_ACTION); ?>', {}, function (response) {
      if (response.success) {
        var s = response.data;
        result.textContent = s.created + ' created, ' + s.updated + ' updated, ' + s.unpublished + ' unpublished, ' + s.errors.length + ' errors';
      } else {
        result.textContent = response.data && response.data.message ? response.data.message : 'Sync failed.';
      }
    });
  });
})();
</script>
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-settings.sh`
Expected: two `No syntax errors detected in ...` lines, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-settings.php wordpress-plugin/diyseo-sync/includes/views/settings-page.php wordpress-plugin/diyseo-sync/tests/lint-settings.sh
git commit -m "Add DIYSEO Sync settings storage and admin screen"
```

---

### Task 6: Sync orchestration engine (`DIYSEO_Sync_Engine`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-engine.php`
- Test: `wordpress-plugin/diyseo-sync/tests/lint-engine.sh`

**Interfaces:**
- Consumes:
  - `DIYSEO_Sync_Settings::get_settings(): array` (Task 5) — keys `base_url`, `site_id`, `api_key`, `author_id`.
  - `DIYSEO_Sync_Client` (Task 1) — `list_published_articles()`.
  - `DIYSEO_Sync_Mapper` (Task 2) — `decide_action()`, `map_to_post_array()`, `find_stale_post_ids()`, `is_valid_article()`, `should_run_unpublish_pass()`.
  - `DIYSEO_Sync_Seo` (Task 3) — `detect_provider()`, `build_meta_for_provider()`.
- Produces:
  - `class DIYSEO_Sync_Engine { public static function run_scheduled(): void; public function run(): array; }`
  - `run()` returns `['created' => int, 'updated' => int, 'unpublished' => int, 'errors' => string[]]` — the exact shape `DIYSEO_Sync_Ajax::handle_run_now()` (Task 7) sends back as JSON, and the shape read from the `diyseo_sync_last_run` option by the settings view (Task 5, already written to expect these four keys).
  - `run()` also persists `update_option('diyseo_sync_last_run', ['timestamp' => int, 'summary' => <above array>])` and appends to the `diyseo_sync_log` option (used by the settings view).

This task is WordPress-runtime glue (`wp_insert_post`, `get_posts`, `update_post_meta`, `media_sideload_image`) and cannot run outside WordPress, so it is verified with a syntax lint plus a manual check in Task 8's end-to-end verification.

**Consenso review fixes folded into this task** (multi-agent review of the plan, 2026-08-10 — see `run_dir` under `.consenso/` for the raw findings):
- The old design ran a separate `get_posts()` query per article to check whether it already existed (N+1). `run()` now calls `load_synced_posts()` **once** per run to build an in-memory `[article_id => ['post_id' => int, 'status' => string]]` map, priming the post-meta cache with `update_meta_cache()` so the per-article `get_post_meta()` calls that follow don't each hit the database either.
- That map's `get_posts()` query includes `trash` explicitly — WordPress's `post_status => 'any'` silently excludes trashed posts, which would otherwise make the plugin create a duplicate post for an article whose WordPress post a site admin had trashed.
- Every article from the API is validated with `DIYSEO_Sync_Mapper::is_valid_article()` before it's touched; anything missing `id`/`title`/`slug`/`updatedAt` is skipped and recorded in `errors` instead of triggering a PHP warning or being silently mismapped.
- The unpublish-to-draft pass only runs when `DIYSEO_Sync_Mapper::should_run_unpublish_pass($seen_article_ids)` is true (i.e. at least one valid article was seen this run) — this is the fix for the most serious finding: without it, an API call that succeeds but returns zero articles (outage, misconfigured site id, etc.) would silently draft every previously published post.
- `unpublish_stale_posts()` now checks `is_wp_error()` on each `wp_update_post()` call and only counts a post as unpublished when it actually succeeded, instead of unconditionally trusting the attempt.

- [ ] **Step 1: Write the (lint) verification script**

Create `wordpress-plugin/diyseo-sync/tests/lint-engine.sh`:

```bash
#!/bin/sh
set -e
php -l "$(dirname "$0")/../includes/class-diyseo-sync-engine.php"
```

Make it executable: `chmod +x wordpress-plugin/diyseo-sync/tests/lint-engine.sh`

- [ ] **Step 2: Run the script to verify it fails**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-engine.sh`
Expected: `php -l` fails — the file doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-engine.php`:

```php
<?php

class DIYSEO_Sync_Engine {

    public static function run_scheduled() {
        $engine = new self();
        $engine->run();
    }

    public function run() {
        $settings = DIYSEO_Sync_Settings::get_settings();

        if (empty($settings['base_url']) || empty($settings['site_id']) || empty($settings['api_key'])) {
            $this->log('Sync skipped: settings incomplete.');
            return $this->finish($this->summary(0, 0, 0, array('Settings incomplete.')));
        }

        $client = new DIYSEO_Sync_Client($settings['base_url'], $settings['site_id'], $settings['api_key']);

        try {
            $articles = $client->list_published_articles();
        } catch (DIYSEO_Sync_Api_Exception $e) {
            $this->log('Sync failed: ' . $e->getMessage());
            return $this->finish($this->summary(0, 0, 0, array($e->getMessage())));
        }

        $synced = $this->load_synced_posts();

        $created = 0;
        $updated = 0;
        $errors = array();
        $seen_article_ids = array();

        foreach ($articles as $article) {
            if (!DIYSEO_Sync_Mapper::is_valid_article($article)) {
                $errors[] = 'Skipped article with missing required fields (id: ' . (isset($article['id']) ? $article['id'] : 'unknown') . ').';
                continue;
            }

            $seen_article_ids[] = $article['id'];
            $existing_post_id = isset($synced[$article['id']]) ? $synced[$article['id']]['post_id'] : null;

            try {
                $result = $this->sync_article($article, (int) $settings['author_id'], $existing_post_id);
                if ($result === DIYSEO_Sync_Mapper::ACTION_CREATE) {
                    $created++;
                } elseif ($result === DIYSEO_Sync_Mapper::ACTION_UPDATE) {
                    $updated++;
                }
            } catch (Exception $e) {
                $errors[] = 'Article ' . $article['id'] . ': ' . $e->getMessage();
            }
        }

        $unpublished = 0;
        if (DIYSEO_Sync_Mapper::should_run_unpublish_pass($seen_article_ids)) {
            $published_post_ids_by_article_id = array();
            foreach ($synced as $article_id => $entry) {
                if ($entry['status'] === 'publish') {
                    $published_post_ids_by_article_id[$article_id] = $entry['post_id'];
                }
            }
            $unpublished = $this->unpublish_stale_posts($published_post_ids_by_article_id, $seen_article_ids, $errors);
        } else {
            $this->log('Unpublish pass skipped: DIYSEO returned zero published articles this run.');
        }

        $summary = $this->summary($created, $updated, $unpublished, $errors);

        $this->log(sprintf(
            'Sync finished: %d created, %d updated, %d unpublished, %d errors.',
            $created,
            $updated,
            $unpublished,
            count($errors)
        ));

        return $this->finish($summary);
    }

    private function finish(array $summary) {
        update_option('diyseo_sync_last_run', array(
            'timestamp' => time(),
            'summary' => $summary
        ));
        return $summary;
    }

    private function load_synced_posts() {
        $posts = get_posts(array(
            'post_type' => 'post',
            'post_status' => array('publish', 'draft', 'pending', 'private', 'future', 'trash'),
            'meta_key' => '_diyseo_article_id',
            'numberposts' => -1,
            'fields' => 'ids'
        ));

        update_meta_cache('post', $posts);

        $synced = array();
        foreach ($posts as $post_id) {
            $article_id = get_post_meta($post_id, '_diyseo_article_id', true);
            if ($article_id) {
                $synced[$article_id] = array(
                    'post_id' => (int) $post_id,
                    'status' => get_post_status($post_id)
                );
            }
        }

        return $synced;
    }

    private function sync_article(array $article, $author_id, $existing_post_id) {
        $existing_updated_at = $existing_post_id ? get_post_meta($existing_post_id, '_diyseo_updated_at', true) : null;

        $action = DIYSEO_Sync_Mapper::decide_action($article, $existing_updated_at ?: null);

        if ($action === DIYSEO_Sync_Mapper::ACTION_SKIP) {
            return $action;
        }

        $post_array = DIYSEO_Sync_Mapper::map_to_post_array($article, $author_id, $existing_post_id);
        $post_id = wp_insert_post($post_array, true);

        if (is_wp_error($post_id)) {
            throw new Exception($post_id->get_error_message());
        }

        update_post_meta($post_id, '_diyseo_article_id', $article['id']);
        update_post_meta($post_id, '_diyseo_updated_at', $article['updatedAt']);

        if (!empty($article['coverImageUrl'])) {
            $this->maybe_sideload_cover_image($post_id, $article['coverImageUrl']);
        }

        $provider = DIYSEO_Sync_Seo::detect_provider();
        $meta = DIYSEO_Sync_Seo::build_meta_for_provider(
            $provider,
            isset($article['seoTitle']) ? $article['seoTitle'] : null,
            isset($article['seoDescription']) ? $article['seoDescription'] : null
        );
        foreach ($meta as $meta_key => $meta_value) {
            update_post_meta($post_id, $meta_key, $meta_value);
        }

        return $action;
    }

    private function maybe_sideload_cover_image($post_id, $cover_image_url) {
        $cached_source = get_post_meta($post_id, '_diyseo_cover_image_source', true);

        if ($cached_source === $cover_image_url && has_post_thumbnail($post_id)) {
            return;
        }

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $attachment_id = media_sideload_image($cover_image_url, $post_id, null, 'id');

        if (is_wp_error($attachment_id)) {
            return;
        }

        set_post_thumbnail($post_id, $attachment_id);
        update_post_meta($post_id, '_diyseo_cover_image_source', $cover_image_url);
    }

    private function unpublish_stale_posts(array $published_post_ids_by_article_id, array $seen_article_ids, array &$errors) {
        $stale_post_ids = DIYSEO_Sync_Mapper::find_stale_post_ids($published_post_ids_by_article_id, $seen_article_ids);
        $unpublished = 0;

        foreach ($stale_post_ids as $post_id) {
            $result = wp_update_post(array('ID' => $post_id, 'post_status' => 'draft'), true);
            if (is_wp_error($result)) {
                $errors[] = 'Failed to unpublish post ' . $post_id . ': ' . $result->get_error_message();
                continue;
            }
            $unpublished++;
        }

        return $unpublished;
    }

    private function summary($created, $updated, $unpublished, array $errors) {
        return array(
            'created' => $created,
            'updated' => $updated,
            'unpublished' => $unpublished,
            'errors' => $errors
        );
    }

    private function log($message) {
        $log = get_option('diyseo_sync_log', array());
        array_unshift($log, '[' . current_time('mysql') . '] ' . $message);
        $log = array_slice($log, 0, 20);
        update_option('diyseo_sync_log', $log);
    }
}
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-engine.sh`
Expected: `No syntax errors detected in ...`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-engine.php wordpress-plugin/diyseo-sync/tests/lint-engine.sh
git commit -m "Add DIYSEO Sync orchestration engine"
```

---

### Task 7: AJAX handlers (`DIYSEO_Sync_Ajax`)

**Files:**
- Create: `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-ajax.php`
- Test: `wordpress-plugin/diyseo-sync/tests/lint-ajax.sh`

**Interfaces:**
- Consumes:
  - `DIYSEO_Sync_Settings::AJAX_TEST_ACTION`, `DIYSEO_Sync_Settings::AJAX_SYNC_ACTION`, `DIYSEO_Sync_Settings::NONCE_ACTION` (Task 5).
  - `DIYSEO_Sync_Client` (Task 1) — `test_connection()`.
  - `DIYSEO_Sync_Engine` (Task 6) — `run()`.
- Produces:
  - `class DIYSEO_Sync_Ajax { public function register_hooks(): void; public function handle_test_connection(): void; public function handle_run_now(): void; }`
  - `register_hooks()` wires `wp_ajax_{DIYSEO_Sync_Settings::AJAX_TEST_ACTION}` → `handle_test_connection`, `wp_ajax_{DIYSEO_Sync_Settings::AJAX_SYNC_ACTION}` → `handle_run_now`. Both handlers call `check_ajax_referer(DIYSEO_Sync_Settings::NONCE_ACTION, 'nonce')` and require `manage_options`, matching the nonce/action names the settings view (Task 5) already posts.

- [ ] **Step 1: Write the (lint) verification script**

Create `wordpress-plugin/diyseo-sync/tests/lint-ajax.sh`:

```bash
#!/bin/sh
set -e
php -l "$(dirname "$0")/../includes/class-diyseo-sync-ajax.php"
```

Make it executable: `chmod +x wordpress-plugin/diyseo-sync/tests/lint-ajax.sh`

- [ ] **Step 2: Run the script to verify it fails**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-ajax.sh`
Expected: `php -l` fails — the file doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-ajax.php`:

```php
<?php

class DIYSEO_Sync_Ajax {

    public function register_hooks() {
        add_action('wp_ajax_' . DIYSEO_Sync_Settings::AJAX_TEST_ACTION, array($this, 'handle_test_connection'));
        add_action('wp_ajax_' . DIYSEO_Sync_Settings::AJAX_SYNC_ACTION, array($this, 'handle_run_now'));
    }

    public function handle_test_connection() {
        check_ajax_referer(DIYSEO_Sync_Settings::NONCE_ACTION, 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Not allowed.'), 403);
        }

        $base_url = isset($_POST['base_url']) ? esc_url_raw(wp_unslash($_POST['base_url'])) : '';
        $site_id = isset($_POST['site_id']) ? sanitize_text_field(wp_unslash($_POST['site_id'])) : '';
        $api_key = isset($_POST['api_key']) ? sanitize_text_field(wp_unslash($_POST['api_key'])) : '';

        $client = new DIYSEO_Sync_Client($base_url, $site_id, $api_key);
        $result = $client->test_connection();

        if ($result['ok']) {
            wp_send_json_success($result);
        }
        wp_send_json_error($result);
    }

    public function handle_run_now() {
        check_ajax_referer(DIYSEO_Sync_Settings::NONCE_ACTION, 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Not allowed.'), 403);
        }

        $engine = new DIYSEO_Sync_Engine();
        $summary = $engine->run();

        wp_send_json_success($summary);
    }
}
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-ajax.sh`
Expected: `No syntax errors detected in ...`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/diyseo-sync/includes/class-diyseo-sync-ajax.php wordpress-plugin/diyseo-sync/tests/lint-ajax.sh
git commit -m "Add DIYSEO Sync AJAX handlers for test connection and manual sync"
```

---

### Task 8: Plugin bootstrap, uninstall, readme, and end-to-end verification

**Files:**
- Create: `wordpress-plugin/diyseo-sync/diyseo-sync.php`
- Create: `wordpress-plugin/diyseo-sync/uninstall.php`
- Create: `wordpress-plugin/diyseo-sync/readme.txt`
- Test: `wordpress-plugin/diyseo-sync/tests/lint-all.sh`

**Interfaces:**
- Consumes: every class from Tasks 1–7 (`DIYSEO_Sync_Client`, `DIYSEO_Sync_Mapper`, `DIYSEO_Sync_Seo`, `DIYSEO_Sync_Cron`, `DIYSEO_Sync_Settings`, `DIYSEO_Sync_Engine`, `DIYSEO_Sync_Ajax`).
- Produces: the installable plugin — `wordpress-plugin/diyseo-sync/diyseo-sync.php` is the file WordPress reads for the plugin header, so this is the last task; nothing downstream depends on it.

- [ ] **Step 1: Write the (lint) verification script**

Create `wordpress-plugin/diyseo-sync/tests/lint-all.sh`:

```bash
#!/bin/sh
set -e
DIR="$(dirname "$0")/.."
for f in "$DIR"/diyseo-sync.php "$DIR"/uninstall.php "$DIR"/includes/*.php "$DIR"/includes/views/*.php; do
  php -l "$f"
done
```

Make it executable: `chmod +x wordpress-plugin/diyseo-sync/tests/lint-all.sh`

- [ ] **Step 2: Run the script to verify it fails**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-all.sh`
Expected: fails — `diyseo-sync.php` and `uninstall.php` don't exist yet.

- [ ] **Step 3: Write the implementation**

Create `wordpress-plugin/diyseo-sync/diyseo-sync.php`:

```php
<?php
/**
 * Plugin Name: DIYSEO Sync
 * Description: Syncs published articles from a DIYSEO site into native WordPress posts.
 * Version: 1.0.0
 * Author: DIYSEO
 * License: GPLv2 or later
 * Text Domain: diyseo-sync
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DIYSEO_SYNC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DIYSEO_SYNC_VERSION', '1.0.0');

require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-client.php';
require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-mapper.php';
require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-seo.php';
require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-cron.php';
require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-settings.php';
require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-engine.php';
require_once DIYSEO_SYNC_PLUGIN_DIR . 'includes/class-diyseo-sync-ajax.php';

function diyseo_sync_bootstrap() {
    $cron = new DIYSEO_Sync_Cron();
    $cron->register_hooks();

    $settings = new DIYSEO_Sync_Settings();
    $settings->register_hooks();

    $ajax = new DIYSEO_Sync_Ajax();
    $ajax->register_hooks();
}
add_action('plugins_loaded', 'diyseo_sync_bootstrap');

function diyseo_sync_activate() {
    $settings = DIYSEO_Sync_Settings::get_settings();
    DIYSEO_Sync_Cron::reschedule($settings['enabled'], $settings['interval']);
}
register_activation_hook(__FILE__, 'diyseo_sync_activate');

function diyseo_sync_deactivate() {
    wp_clear_scheduled_hook(DIYSEO_Sync_Cron::HOOK);
}
register_deactivation_hook(__FILE__, 'diyseo_sync_deactivate');
```

Create `wordpress-plugin/diyseo-sync/uninstall.php`:

```php
<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

global $wpdb;

delete_option('diyseo_sync_settings');
delete_option('diyseo_sync_last_run');
delete_option('diyseo_sync_log');

$wpdb->delete($wpdb->postmeta, array('meta_key' => '_diyseo_article_id'));
$wpdb->delete($wpdb->postmeta, array('meta_key' => '_diyseo_updated_at'));
$wpdb->delete($wpdb->postmeta, array('meta_key' => '_diyseo_cover_image_source'));
```

Create `wordpress-plugin/diyseo-sync/readme.txt`:

```text
=== DIYSEO Sync ===
Contributors: diyseo
Tags: seo, content sync, publishing
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Sync published articles from a DIYSEO site into native WordPress posts.

== Description ==

DIYSEO Sync pulls PUBLISHED articles from a DIYSEO site's Publishing API and creates or updates
matching native WordPress posts, so AI-generated SEO content lives as real, themeable, indexable
posts on your WordPress site instead of an embedded widget.

Features:

* Scheduled sync via WP-Cron (15 min / 30 min / hourly / every 6 hours / daily) plus a manual
  "Sync now" button
* Creates or updates WordPress posts, matched to DIYSEO articles by a stable article id
* Downloads the DIYSEO cover image into the Media Library and sets it as the Featured Image
* Maps SEO title/description into Yoast SEO or RankMath meta fields when either plugin is active
* Automatically moves a post to Draft if its DIYSEO article is no longer published (never deletes)

== Installation ==

1. Upload the `diyseo-sync` folder to `/wp-content/plugins/`.
2. Activate the plugin through the "Plugins" screen in WordPress.
3. Go to Settings > DIYSEO Sync.
4. Enter your DIYSEO Base URL, Site ID, and a Publishing API key (create one in DIYSEO under
   Settings > API for the site you want to sync).
5. Click "Test connection" to confirm the credentials work.
6. Choose a sync interval and the WordPress author to assign to synced posts, then Save Settings.
7. Click "Sync now" to run the first sync immediately.

== Known limitations ==

* The API key is stored as plain text in the WordPress options table, consistent with common
  WordPress plugin convention.
* Each sync run re-lists the site's full PUBLISHED article set (the DIYSEO Publishing API has no
  "updated since" filter) and only touches WordPress posts whose content actually changed.
* If a synced article's cover image URL changes, the plugin uploads the new image and sets it as
  the Featured Image, but does not delete the previous attachment from the Media Library — it is
  left in place rather than risk deleting an image you may have replaced intentionally.
* If DIYSEO returns zero published articles for a run (outage, wrong Site ID, etc.), the plugin
  skips moving any previously synced post to Draft rather than risk mass-unpublishing your site;
  check the sync log if you expect articles that aren't appearing.

== Changelog ==

= 1.0.0 =
* Initial release: scheduled and manual sync, featured image sideload, Yoast/RankMath SEO mapping,
  automatic draft on unpublish.
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `sh wordpress-plugin/diyseo-sync/tests/lint-all.sh`
Expected: one `No syntax errors detected in ...` line per file, exit code 0.

- [ ] **Step 5: Run the full offline test suite**

Run:
```bash
php wordpress-plugin/diyseo-sync/tests/client-test.php
php wordpress-plugin/diyseo-sync/tests/mapper-test.php
php wordpress-plugin/diyseo-sync/tests/seo-test.php
php wordpress-plugin/diyseo-sync/tests/seo-yoast-detection-test.php
php wordpress-plugin/diyseo-sync/tests/seo-rankmath-detection-test.php
php wordpress-plugin/diyseo-sync/tests/cron-test.php
sh wordpress-plugin/diyseo-sync/tests/lint-settings.sh
sh wordpress-plugin/diyseo-sync/tests/lint-engine.sh
sh wordpress-plugin/diyseo-sync/tests/lint-ajax.sh
sh wordpress-plugin/diyseo-sync/tests/lint-all.sh
```
Expected: every command exits 0.

- [ ] **Step 6: Manual end-to-end verification (requires a local WordPress instance)**

Against a local WordPress install (or `wp-env`) pointed at a local DIYSEO dev server
(`npm run dev`) with at least one seeded/published article, walk through the design's testing
plan from `docs/superpowers/specs/2026-08-10-wordpress-plugin-design.md`:

1. Zip `wordpress-plugin/diyseo-sync/`, install and activate it in WordPress.
2. Fill in Settings > DIYSEO Sync with the local DIYSEO base URL, a real site id, and a Publishing
   API key generated from that site's `Settings > API` page. Click "Test connection" — expect a
   success message.
3. Click "Sync now" — expect a new WordPress post matching the seeded published DIYSEO article,
   with its Featured Image set from `coverImageUrl` and (if Yoast or RankMath is active) its SEO
   title/description populated.
4. Edit the article's title in DIYSEO, click "Sync now" again — expect the same WordPress post to
   update in place (not duplicate).
5. Click "Sync now" a third time with no DIYSEO changes — expect the summary to show 0
   created/updated (skip path working, no redundant image re-download).
6. In DIYSEO, set the article's status to Draft, click "Sync now" — expect the WordPress post to
   flip to Draft, not be deleted.
7. Re-publish that article in DIYSEO, "Sync now" — expect the WordPress post to come back as
   Published (not a duplicate).
8. Move a synced WordPress post to the Trash manually, then "Sync now" again with the matching
   article still Published in DIYSEO — expect the plugin to find and update the trashed post
   rather than creating a duplicate.
9. Temporarily set the Site ID in settings to a nonexistent value (so the API returns zero
   articles) and click "Sync now" — expect the summary to show 0 unpublished and the log to record
   "Unpublish pass skipped", and confirm no previously-synced post was moved to Draft.
10. Confirm the scheduled WP-Cron event fires on its own (check `wp_next_scheduled` or wait out a
    short interval) and produces the same result as the manual button.
11. Enter an invalid API key and click "Test connection" — expect a clear error message, no PHP
    fatal error or warning in the WordPress debug log.

- [ ] **Step 7: Commit**

```bash
git add wordpress-plugin/diyseo-sync/diyseo-sync.php wordpress-plugin/diyseo-sync/uninstall.php wordpress-plugin/diyseo-sync/readme.txt wordpress-plugin/diyseo-sync/tests/lint-all.sh
git commit -m "Wire up DIYSEO Sync plugin bootstrap, uninstall, and readme"
```
