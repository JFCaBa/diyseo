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
