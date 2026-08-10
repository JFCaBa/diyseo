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
