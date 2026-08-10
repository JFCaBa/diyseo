=== DIYSEO Sync ===
Contributors: diyseo
Tags: seo, content sync, publishing
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Sync published articles from a DIYSEO site into native WordPress posts.

== Description ==

DIYSEO Sync pulls PUBLISHED articles from a DIYSEO site's Publishing API and creates or updates
matching native WordPress posts, so AI-generated SEO content lives as real, themeable, indexable
posts on your WordPress site instead of an embedded widget.

Features:

* Scheduled sync via WP-Cron (15 min / 30 min / hourly / every 6 hours / daily) plus a manual
  "Sync now" button
* Creates or updates WordPress posts, matched to DIYSEO articles by a stable article id
* Downloads the DIYSEO cover image into the Media Library and sets it as the Featured Image
* Maps SEO title/description into Yoast SEO or RankMath meta fields when either plugin is active
* Automatically moves a post to Draft if its DIYSEO article is no longer published (never deletes)

== Installation ==

1. Upload the `diyseo-sync` folder to `/wp-content/plugins/`.
2. Activate the plugin through the "Plugins" screen in WordPress.
3. Go to Settings > DIYSEO Sync.
4. Enter your DIYSEO Base URL, Site ID, and a Publishing API key (create one in DIYSEO under
   Settings > API for the site you want to sync).
5. Click "Test connection" to confirm the credentials work.
6. Choose a sync interval and the WordPress author to assign to synced posts, then Save Settings.
7. Click "Sync now" to run the first sync immediately.

== Known limitations ==

* The API key is stored as plain text in the WordPress options table, consistent with common
  WordPress plugin convention.
* Each sync run re-lists the site's full PUBLISHED article set (the DIYSEO Publishing API has no
  "updated since" filter) and only touches WordPress posts whose content actually changed.
* If a synced article's cover image URL changes, the plugin uploads the new image and sets it as
  the Featured Image, but does not delete the previous attachment from the Media Library — it is
  left in place rather than risk deleting an image you may have replaced intentionally.
* If DIYSEO returns zero published articles for a run (outage, wrong Site ID, etc.), the plugin
  skips moving any previously synced post to Draft rather than risk mass-unpublishing your site;
  check the sync log if you expect articles that aren't appearing.
* If a DIYSEO article's SEO title/description is cleared at the source, the plugin does not clear
  the corresponding Yoast/RankMath fields on the WordPress side — it only ever writes a value when
  DIYSEO actually has one, so it never overwrites SEO fields you may have customized directly in
  WordPress.
* Only one sync (scheduled or manual) can run at a time — a second attempt while one is already in
  progress is skipped and logged rather than run concurrently. On very large article catalogs with
  many new cover images to download, a manual "Sync now" click can take a while to respond; each
  article is saved as it's processed, so a slow or interrupted run simply picks up the rest on the
  next scheduled sync rather than losing progress.

== Changelog ==

= 1.0.0 =
* Initial release: scheduled and manual sync, featured image sideload, Yoast/RankMath SEO mapping,
  automatic draft on unpublish.
