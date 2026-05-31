# Dibao Plugin Installation Guide

This guide is for Dibao administrators installing third-party plugins. Third-party plugins run code on your self-hosted server, so only install plugins from sources you trust.

## Recommended Flow: Upload A Plugin File

1. Download the `.dibao-plugin` file from the plugin developer's release page.
2. If the developer provides a SHA-256 checksum, verify the file locally first.
3. Open Dibao settings and go to the Plugins tab.
4. Choose the `.dibao-plugin` file in the third-party plugin installer and click Install.
5. Newly installed third-party plugins stay disabled by default. Review the plugin name, publisher, capabilities, and compatibility before enabling it.

## Advanced Flow: URL Or JSON Package

Dibao's plugin API also supports installing from a plugin package URL or a plugin package JSON body. These flows are mainly for automation, development, or examples in developer documentation. Most users should install the `.dibao-plugin` file instead of typing these values by hand.

URL installation requires the plugin developer to provide:

- A package URL, usually pointing to a `.dibao-plugin` file.
- A SHA-256 checksum, recommended.

JSON package installation requires a complete plugin package JSON with `manifest` and `files`. If you are installing someone else's released plugin, prefer the `.dibao-plugin` file.

Related API docs:

- [`POST /api/plugins/install`](./api-contract.md#post-apipluginsinstall)
- [`POST /api/plugins/install/upload`](./api-contract.md#post-apipluginsinstallupload)

## Docker Upgrades

You usually do not need to reinstall third-party plugins after rebuilding or upgrading the official Docker image. This depends on mounting the `/data` directory as persistent storage in Docker or Docker Compose.

After an upgrade, Dibao rescans official plugins and preserves third-party plugin records:

- Compatible plugins recover their previous state.
- Incompatible plugins keep their data but move to `incompatible` until you update the plugin or upgrade Dibao.
- Disabled plugins do not register hooks, tasks, or UI extensions.

Persistent paths:

- `/data/plugins/installed`
- `/data/plugins/data/<plugin-id>`
- SQLite tables: `plugin_installs`, `plugin_capability_grants`, `plugin_settings`, `plugin_kv`, `plugin_migrations`, `plugin_update_checks`

## Updating Plugins

If the plugin manifest provides an `updateUrl`, the Plugins tab shows Check update. Dibao downloads the update into a staging area, verifies the plugin ID, compatibility range, and SHA-256, then replaces the old package. If the update fails, Dibao keeps the old package.

If the plugin does not provide an `updateUrl`, download the newer `.dibao-plugin` file from the developer's release page and upload it again.
