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
