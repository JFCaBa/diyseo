<?php
class RankMath {}
require_once __DIR__ . '/../includes/class-diyseo-sync-seo.php';

if (DIYSEO_Sync_Seo::detect_provider() !== DIYSEO_Sync_Seo::PROVIDER_RANKMATH) {
    fwrite(STDERR, "FAIL: detect_provider returns rankmath when RankMath class exists\n");
    exit(1);
}
echo "PASS: detect_provider returns rankmath when RankMath class exists\n";
