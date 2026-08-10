<?php

class DIYSEO_Sync_Settings {
    const OPTION_KEY = 'diyseo_sync_settings';
    const NONCE_ACTION = 'diyseo_sync_settings_save';
    const AJAX_TEST_ACTION = 'diyseo_sync_test_connection';
    const AJAX_SYNC_ACTION = 'diyseo_sync_run_now';
    const VALID_INTERVALS = array('15min', '30min', 'hourly', '6hours', 'daily');

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

        $submitted_interval = isset($_POST['diyseo_interval']) ? sanitize_text_field(wp_unslash($_POST['diyseo_interval'])) : 'hourly';

        $settings = array(
            'base_url' => isset($_POST['diyseo_base_url']) ? esc_url_raw(wp_unslash($_POST['diyseo_base_url'])) : '',
            'site_id' => isset($_POST['diyseo_site_id']) ? sanitize_text_field(wp_unslash($_POST['diyseo_site_id'])) : '',
            'api_key' => isset($_POST['diyseo_api_key']) ? sanitize_text_field(wp_unslash($_POST['diyseo_api_key'])) : '',
            'author_id' => isset($_POST['diyseo_author_id']) ? absint($_POST['diyseo_author_id']) : get_current_user_id(),
            'interval' => in_array($submitted_interval, self::VALID_INTERVALS, true) ? $submitted_interval : 'hourly',
            'enabled' => !empty($_POST['diyseo_enabled'])
        );

        update_option(self::OPTION_KEY, $settings);

        if ($settings['enabled'] !== $previous['enabled'] || $settings['interval'] !== $previous['interval']) {
            DIYSEO_Sync_Cron::reschedule($settings['enabled'], $settings['interval']);
        }

        add_settings_error('diyseo_sync', 'diyseo_sync_saved', 'Settings saved.', 'success');
        // Persist across the redirect the same way core's options.php does, so settings_errors()
        // still finds this notice on the next page load instead of it being lost with the request.
        set_transient('settings_errors', get_settings_errors(), 30);

        wp_safe_redirect(add_query_arg('settings-updated', 'true', wp_get_referer()));
        exit;
    }

    public function render_settings_page() {
        $settings = self::get_settings();
        $last_run = get_option('diyseo_sync_last_run');
        $log = get_option('diyseo_sync_log', array());
        require DIYSEO_SYNC_PLUGIN_DIR . 'includes/views/settings-page.php';
    }
}
