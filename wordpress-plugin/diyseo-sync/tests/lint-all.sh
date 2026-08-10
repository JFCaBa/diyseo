#!/bin/sh
set -e
DIR="$(dirname "$0")/.."
for f in "$DIR"/diyseo-sync.php "$DIR"/uninstall.php "$DIR"/includes/*.php "$DIR"/includes/views/*.php; do
  php -l "$f"
done
