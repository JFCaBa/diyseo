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
