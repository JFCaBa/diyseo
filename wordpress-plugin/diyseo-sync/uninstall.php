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
