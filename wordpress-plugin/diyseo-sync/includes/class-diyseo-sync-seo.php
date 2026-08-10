<?php

class DIYSEO_Sync_Seo {
    const PROVIDER_YOAST = 'yoast';
    const PROVIDER_RANKMATH = 'rankmath';
    const PROVIDER_NONE = 'none';

    public static function detect_provider() {
        if (class_exists('WPSEO_Options')) {
            return self::PROVIDER_YOAST;
        }
        if (class_exists('RankMath')) {
            return self::PROVIDER_RANKMATH;
        }
        return self::PROVIDER_NONE;
    }

    public static function build_meta_for_provider($provider, $seo_title, $seo_description) {
        if ($provider === self::PROVIDER_YOAST) {
            return self::filter_empty(array(
                '_yoast_wpseo_title' => $seo_title,
                '_yoast_wpseo_metadesc' => $seo_description
            ));
        }

        if ($provider === self::PROVIDER_RANKMATH) {
            return self::filter_empty(array(
                'rank_math_title' => $seo_title,
                'rank_math_description' => $seo_description
            ));
        }

        return array();
    }

    private static function filter_empty(array $meta) {
        $result = array();
        foreach ($meta as $key => $value) {
            if ($value !== null && $value !== '') {
                $result[$key] = $value;
            }
        }
        return $result;
    }
}
