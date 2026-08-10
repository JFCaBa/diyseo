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
