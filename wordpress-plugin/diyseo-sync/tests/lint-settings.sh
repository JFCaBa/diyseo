#!/bin/sh
set -e
php -l "$(dirname "$0")/../includes/class-diyseo-sync-settings.php"
php -l "$(dirname "$0")/../includes/views/settings-page.php"
