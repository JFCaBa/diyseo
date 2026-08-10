<?php

class DIYSEO_Sync_Cron {
    const HOOK = 'diyseo_sync_run_event';

    public static function build_schedules(array $existing_schedules) {
        $existing_schedules['diyseo_sync_15min'] = array(
            'interval' => 15 * MINUTE_IN_SECONDS,
            'display' => 'Every 15 Minutes (DIYSEO Sync)'
        );
        $existing_schedules['diyseo_sync_30min'] = array(
            'interval' => 30 * MINUTE_IN_SECONDS,
            'display' => 'Every 30 Minutes (DIYSEO Sync)'
        );
        $existing_schedules['diyseo_sync_6hours'] = array(
            'interval' => 6 * HOUR_IN_SECONDS,
            'display' => 'Every 6 Hours (DIYSEO Sync)'
        );
        return $existing_schedules;
    }

    public static function interval_key_for_setting($setting_value) {
        $map = array(
            '15min' => 'diyseo_sync_15min',
            '30min' => 'diyseo_sync_30min',
            'hourly' => 'hourly',
            '6hours' => 'diyseo_sync_6hours',
            'daily' => 'daily'
        );
        return isset($map[$setting_value]) ? $map[$setting_value] : 'hourly';
    }

    public function register_hooks() {
        add_filter('cron_schedules', array(__CLASS__, 'build_schedules'));
        add_action(self::HOOK, array('DIYSEO_Sync_Engine', 'run_scheduled'));
    }

    public static function reschedule($enabled, $setting_value) {
        $timestamp = wp_next_scheduled(self::HOOK);
        if ($timestamp) {
            wp_unschedule_event($timestamp, self::HOOK);
        }
        if ($enabled) {
            wp_schedule_event(time(), self::interval_key_for_setting($setting_value), self::HOOK);
        }
    }
}
