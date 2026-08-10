<?php

class DIYSEO_Sync_Engine {

    const LOCK_KEY = 'diyseo_sync_lock';
    const LOCK_TTL = 300;

    public static function run_scheduled() {
        $engine = new self();
        $engine->run();
    }

    public function run() {
        if (get_transient(self::LOCK_KEY)) {
            $this->log('Sync skipped: another sync run is already in progress.');
            return $this->summary(0, 0, 0, array('Another sync is already running.'));
        }

        set_transient(self::LOCK_KEY, true, self::LOCK_TTL);

        try {
            return $this->run_locked();
        } finally {
            delete_transient(self::LOCK_KEY);
        }
    }

    private function run_locked() {
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }

        $settings = DIYSEO_Sync_Settings::get_settings();

        if (empty($settings['base_url']) || empty($settings['site_id']) || empty($settings['api_key'])) {
            $this->log('Sync skipped: settings incomplete.');
            return $this->finish($this->summary(0, 0, 0, array('Settings incomplete.')));
        }

        $client = new DIYSEO_Sync_Client($settings['base_url'], $settings['site_id'], $settings['api_key']);

        try {
            $articles = $client->list_published_articles();
        } catch (DIYSEO_Sync_Api_Exception $e) {
            $this->log('Sync failed: ' . $e->getMessage());
            return $this->finish($this->summary(0, 0, 0, array($e->getMessage())));
        }

        $synced = $this->load_synced_posts();

        $created = 0;
        $updated = 0;
        $errors = array();
        $seen_article_ids = array();

        foreach ($articles as $article) {
            if (!empty($article['id'])) {
                // Mark as seen even if invalid below, so a transient data glitch on one field
                // never causes a live post to be mistaken for "no longer published" and drafted.
                $seen_article_ids[] = $article['id'];
            }

            if (!DIYSEO_Sync_Mapper::is_valid_article($article)) {
                $errors[] = 'Skipped article with missing required fields (id: ' . (isset($article['id']) ? $article['id'] : 'unknown') . ').';
                continue;
            }

            $existing_post_id = isset($synced[$article['id']]) ? $synced[$article['id']]['post_id'] : null;

            try {
                $result = $this->sync_article($article, (int) $settings['author_id'], $existing_post_id);
                if ($result === DIYSEO_Sync_Mapper::ACTION_CREATE) {
                    $created++;
                } elseif ($result === DIYSEO_Sync_Mapper::ACTION_UPDATE) {
                    $updated++;
                }
            } catch (Exception $e) {
                $errors[] = 'Article ' . $article['id'] . ': ' . $e->getMessage();
            }
        }

        $unpublished = 0;
        if (DIYSEO_Sync_Mapper::should_run_unpublish_pass($seen_article_ids)) {
            $published_post_ids_by_article_id = array();
            foreach ($synced as $article_id => $entry) {
                if ($entry['status'] === 'publish') {
                    $published_post_ids_by_article_id[$article_id] = $entry['post_id'];
                }
            }
            $unpublished = $this->unpublish_stale_posts($published_post_ids_by_article_id, $seen_article_ids, $errors);
        } else {
            $this->log('Unpublish pass skipped: DIYSEO returned zero published articles this run.');
        }

        $summary = $this->summary($created, $updated, $unpublished, $errors);

        $this->log(sprintf(
            'Sync finished: %d created, %d updated, %d unpublished, %d errors.',
            $created,
            $updated,
            $unpublished,
            count($errors)
        ));

        return $this->finish($summary);
    }

    private function finish(array $summary) {
        update_option('diyseo_sync_last_run', array(
            'timestamp' => time(),
            'summary' => $summary
        ));
        return $summary;
    }

    private function load_synced_posts() {
        $posts = get_posts(array(
            'post_type' => 'post',
            'post_status' => array('publish', 'draft', 'pending', 'private', 'future', 'trash'),
            'meta_key' => '_diyseo_article_id',
            'numberposts' => -1,
            'fields' => 'ids'
        ));

        _prime_post_caches($posts, false, true);

        $synced = array();
        foreach ($posts as $post_id) {
            $article_id = get_post_meta($post_id, '_diyseo_article_id', true);
            if ($article_id) {
                $synced[$article_id] = array(
                    'post_id' => (int) $post_id,
                    'status' => get_post_status($post_id)
                );
            }
        }

        return $synced;
    }

    private function sync_article(array $article, $author_id, $existing_post_id) {
        $existing_updated_at = $existing_post_id ? get_post_meta($existing_post_id, '_diyseo_updated_at', true) : null;

        $action = DIYSEO_Sync_Mapper::decide_action($article, $existing_updated_at ?: null);

        if ($action === DIYSEO_Sync_Mapper::ACTION_SKIP) {
            return $action;
        }

        $article['title'] = sanitize_text_field($article['title']);
        $article['excerpt'] = isset($article['excerpt']) ? sanitize_textarea_field((string) $article['excerpt']) : $article['excerpt'];
        $article['contentHtml'] = isset($article['contentHtml']) ? wp_kses_post($article['contentHtml']) : $article['contentHtml'];

        $post_array = DIYSEO_Sync_Mapper::map_to_post_array($article, $author_id, $existing_post_id);
        $post_id = wp_insert_post($post_array, true);

        if (is_wp_error($post_id)) {
            throw new Exception($post_id->get_error_message());
        }

        update_post_meta($post_id, '_diyseo_article_id', $article['id']);
        update_post_meta($post_id, '_diyseo_updated_at', $article['updatedAt']);

        if (!empty($article['coverImageUrl'])) {
            $this->maybe_sideload_cover_image($post_id, $article['coverImageUrl']);
        }

        $provider = DIYSEO_Sync_Seo::detect_provider();
        $meta = DIYSEO_Sync_Seo::build_meta_for_provider(
            $provider,
            isset($article['seoTitle']) ? $article['seoTitle'] : null,
            isset($article['seoDescription']) ? $article['seoDescription'] : null
        );
        foreach ($meta as $meta_key => $meta_value) {
            update_post_meta($post_id, $meta_key, $meta_value);
        }

        return $action;
    }

    private function maybe_sideload_cover_image($post_id, $cover_image_url) {
        $cached_source = get_post_meta($post_id, '_diyseo_cover_image_source', true);

        if ($cached_source === $cover_image_url && has_post_thumbnail($post_id)) {
            return;
        }

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $attachment_id = media_sideload_image($cover_image_url, $post_id, null, 'id');

        if (is_wp_error($attachment_id)) {
            return;
        }

        set_post_thumbnail($post_id, $attachment_id);
        update_post_meta($post_id, '_diyseo_cover_image_source', $cover_image_url);
    }

    private function unpublish_stale_posts(array $published_post_ids_by_article_id, array $seen_article_ids, array &$errors) {
        $stale_post_ids = DIYSEO_Sync_Mapper::find_stale_post_ids($published_post_ids_by_article_id, $seen_article_ids);
        $unpublished = 0;

        foreach ($stale_post_ids as $post_id) {
            $result = wp_update_post(array('ID' => $post_id, 'post_status' => 'draft'), true);
            if (is_wp_error($result)) {
                $errors[] = 'Failed to unpublish post ' . $post_id . ': ' . $result->get_error_message();
                continue;
            }
            $unpublished++;
        }

        return $unpublished;
    }

    private function summary($created, $updated, $unpublished, array $errors) {
        return array(
            'created' => $created,
            'updated' => $updated,
            'unpublished' => $unpublished,
            'errors' => $errors
        );
    }

    private function log($message) {
        $log = get_option('diyseo_sync_log', array());
        array_unshift($log, '[' . current_time('mysql') . '] ' . $message);
        $log = array_slice($log, 0, 20);
        update_option('diyseo_sync_log', $log);
    }
}
