<?php if (!defined('ABSPATH')) { exit; } ?>
<div class="wrap">
  <h1>DIYSEO Sync</h1>

  <?php settings_errors('diyseo_sync'); ?>

  <form method="post">
    <?php wp_nonce_field(DIYSEO_Sync_Settings::NONCE_ACTION, 'diyseo_sync_nonce'); ?>
    <table class="form-table">
      <tr>
        <th><label for="diyseo_base_url">DIYSEO Base URL</label></th>
        <td><input type="url" id="diyseo_base_url" name="diyseo_base_url" class="regular-text" value="<?php echo esc_attr($settings['base_url']); ?>" placeholder="https://your-app.example.com" required></td>
      </tr>
      <tr>
        <th><label for="diyseo_site_id">Site ID</label></th>
        <td><input type="text" id="diyseo_site_id" name="diyseo_site_id" class="regular-text" value="<?php echo esc_attr($settings['site_id']); ?>" required></td>
      </tr>
      <tr>
        <th><label for="diyseo_api_key">API Key</label></th>
        <td>
          <input type="password" id="diyseo_api_key" name="diyseo_api_key" class="regular-text" value="<?php echo esc_attr($settings['api_key']); ?>" required>
          <p><button type="button" class="button" id="diyseo-test-connection">Test connection</button> <span id="diyseo-test-connection-result"></span></p>
        </td>
      </tr>
      <tr>
        <th><label for="diyseo_author_id">WordPress Author</label></th>
        <td>
          <?php
          wp_dropdown_users(array(
            'name' => 'diyseo_author_id',
            'id' => 'diyseo_author_id',
            'selected' => $settings['author_id'],
            'capability' => 'edit_posts'
          ));
          ?>
        </td>
      </tr>
      <tr>
        <th><label for="diyseo_interval">Sync interval</label></th>
        <td>
          <select id="diyseo_interval" name="diyseo_interval">
            <?php
            $intervals = array(
              '15min' => 'Every 15 minutes',
              '30min' => 'Every 30 minutes',
              'hourly' => 'Hourly',
              '6hours' => 'Every 6 hours',
              'daily' => 'Daily'
            );
            foreach ($intervals as $value => $label) {
              printf(
                '<option value="%1$s"%2$s>%3$s</option>',
                esc_attr($value),
                selected($settings['interval'], $value, false),
                esc_html($label)
              );
            }
            ?>
          </select>
        </td>
      </tr>
      <tr>
        <th><label for="diyseo_enabled">Automatic sync enabled</label></th>
        <td><input type="checkbox" id="diyseo_enabled" name="diyseo_enabled" value="1" <?php checked($settings['enabled']); ?>></td>
      </tr>
    </table>
    <?php submit_button('Save Settings'); ?>
  </form>

  <p>
    <button type="button" class="button button-primary" id="diyseo-sync-now">Sync now</button>
    <span id="diyseo-sync-now-result"></span>
  </p>

  <h2>Last run</h2>
  <?php if ($last_run) : ?>
    <p>
      <?php echo esc_html(date_i18n('Y-m-d H:i:s', $last_run['timestamp'])); ?>
      &mdash;
      <?php echo esc_html(sprintf(
        '%d created, %d updated, %d unpublished, %d errors',
        $last_run['summary']['created'],
        $last_run['summary']['updated'],
        $last_run['summary']['unpublished'],
        count($last_run['summary']['errors'])
      )); ?>
    </p>
  <?php else : ?>
    <p>No sync has run yet.</p>
  <?php endif; ?>

  <h2>Log</h2>
  <ul>
    <?php foreach ($log as $entry) : ?>
      <li><?php echo esc_html($entry); ?></li>
    <?php endforeach; ?>
  </ul>
</div>

<script>
(function () {
  var nonce = <?php echo wp_json_encode(wp_create_nonce(DIYSEO_Sync_Settings::NONCE_ACTION)); ?>;
  var ajaxUrl = <?php echo wp_json_encode(admin_url('admin-ajax.php')); ?>;

  function post(action, data, onDone) {
    var body = new FormData();
    body.append('action', action);
    body.append('nonce', nonce);
    Object.keys(data || {}).forEach(function (key) {
      body.append(key, data[key]);
    });
    fetch(ajaxUrl, { method: 'POST', credentials: 'same-origin', body: body })
      .then(function (res) { return res.json(); })
      .then(onDone)
      .catch(function () { onDone({ success: false, data: { message: 'Request failed.' } }); });
  }

  document.getElementById('diyseo-test-connection').addEventListener('click', function () {
    var result = document.getElementById('diyseo-test-connection-result');
    result.textContent = 'Testing...';
    post('<?php echo esc_js(DIYSEO_Sync_Settings::AJAX_TEST_ACTION); ?>', {
      base_url: document.getElementById('diyseo_base_url').value,
      site_id: document.getElementById('diyseo_site_id').value,
      api_key: document.getElementById('diyseo_api_key').value
    }, function (response) {
      result.textContent = response.data && response.data.message ? response.data.message : (response.success ? 'OK' : 'Failed');
    });
  });

  document.getElementById('diyseo-sync-now').addEventListener('click', function () {
    var result = document.getElementById('diyseo-sync-now-result');
    result.textContent = 'Syncing...';
    post('<?php echo esc_js(DIYSEO_Sync_Settings::AJAX_SYNC_ACTION); ?>', {}, function (response) {
      if (response.success) {
        var s = response.data;
        result.textContent = s.created + ' created, ' + s.updated + ' updated, ' + s.unpublished + ' unpublished, ' + s.errors.length + ' errors';
      } else {
        result.textContent = response.data && response.data.message ? response.data.message : 'Sync failed.';
      }
    });
  });
})();
</script>
