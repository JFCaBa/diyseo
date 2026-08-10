<?php

class DIYSEO_Sync_Mapper {
    const ACTION_CREATE = 'create';
    const ACTION_UPDATE = 'update';
    const ACTION_SKIP = 'skip';

    public static function decide_action(array $article, $existing_updated_at) {
        if ($existing_updated_at === null || $existing_updated_at === '') {
            return self::ACTION_CREATE;
        }
        if ($existing_updated_at !== $article['updatedAt']) {
            return self::ACTION_UPDATE;
        }
        return self::ACTION_SKIP;
    }

    public static function map_to_post_array(array $article, $author_id, $existing_post_id = null) {
        $post = array(
            'post_title' => $article['title'],
            'post_content' => isset($article['contentHtml']) ? $article['contentHtml'] : '',
            'post_excerpt' => isset($article['excerpt']) ? (string) $article['excerpt'] : '',
            'post_name' => $article['slug'],
            'post_status' => 'publish',
            'post_type' => 'post',
            'post_author' => (int) $author_id
        );

        if ($existing_post_id) {
            $post['ID'] = $existing_post_id;
        }

        return $post;
    }

    public static function find_stale_post_ids(array $synced_post_ids_by_article_id, array $seen_article_ids) {
        $seen = array_flip($seen_article_ids);
        $stale = array();

        foreach ($synced_post_ids_by_article_id as $article_id => $post_id) {
            if (!isset($seen[$article_id])) {
                $stale[] = $post_id;
            }
        }

        return $stale;
    }

    public static function is_valid_article(array $article) {
        return !empty($article['id'])
            && !empty($article['title'])
            && !empty($article['slug'])
            && isset($article['updatedAt'])
            && $article['updatedAt'] !== '';
    }

    public static function should_run_unpublish_pass(array $seen_article_ids) {
        return count($seen_article_ids) > 0;
    }
}
