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
    // On first activation 'plugins_loaded' hasn't fired yet for this plugin, so the custom
    // schedules from DIYSEO_Sync_Cron::build_schedules() aren't registered — register them
    // explicitly here before rescheduling, or wp_schedule_event() would silently no-op for
    // a previously-saved custom interval (15min/30min/6hours).
    add_filter('cron_schedules', array('DIYSEO_Sync_Cron', 'build_schedules'));

    $settings = DIYSEO_Sync_Settings::get_settings();
    DIYSEO_Sync_Cron::reschedule($settings['enabled'], $settings['interval']);
}
register_activation_hook(__FILE__, 'diyseo_sync_activate');

function diyseo_sync_deactivate() {
    wp_clear_scheduled_hook(DIYSEO_Sync_Cron::HOOK);
}
register_deactivation_hook(__FILE__, 'diyseo_sync_deactivate');
