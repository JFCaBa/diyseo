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
