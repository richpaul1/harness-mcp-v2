# Migration: `bvr-renderer` → integrated `report-renderer`

> **Status:** breaking change. The standalone `bvr-renderer/` Node.js project
> has been removed and folded into the MCP server source tree as
> `src/report-renderer/`. The MCP tool has been renamed and the URLs have
> changed.

## TL;DR

| Aspect | Before | After |
|---|---|---|
| Code location | `bvr-renderer/` (standalone Node.js project) | `src/report-renderer/` (inside the MCP server) |
| Process model | Spawned child process via Node `spawn()` | In-process — same Node, same Express app (HTTP mode) |
| Port (HTTP mode) | Always `4321` (separate from MCP) | Same as MCP `PORT` (default `3000`) |
| Port (stdio mode) | Always `4321` | `HARNESS_REPORT_PORT` (default `4321`) |
| MCP tool name | `harness_ccm_finops_bvr_render` | `harness_ccm_finops_report_render` |
| Doc URL pattern | `http://localhost:4321/doc/<id>/` | `http://localhost:3000/reports/<id>/` (HTTP) or `http://localhost:4321/reports/<id>/` (stdio) |
| Asset model | Caller passes `assets_dir`; only that directory is served at `/doc/<id>/assets/` | Markdown's directory is auto-served at `/reports/<id>/<any-path>`; no `assets_dir` needed |
| Asset URL pattern | `/doc/<id>/assets/<file>` | `/reports/<id>/<any/relative/path>` (assets/, images/, root-level files all work) |
| Static asset routes | `/theme/*`, `/public/*`, `/vendor/*` | `/_report/themes/*`, `/_report/public/*`, `/_report/vendor/*` |
| Install steps | `cd bvr-renderer && npm install` (extra `node_modules`) | Single `pnpm install` at project root |
| Env vars | `HARNESS_BVR_URL`, `HARNESS_BVR_PORT`, `HARNESS_BVR_AUTOSTART` | `HARNESS_REPORT_PORT` (only used in stdio mode) |

## Why

- **One process, one install.** No more two `node_modules` trees, no more
  spawning a sidecar process, no more "wait for health" polling.
- **Same host and port as MCP.** Reports are served right next to `/mcp` —
  one URL, one CORS origin, one place to forward through any reverse proxy.
- **Cleaner failure modes.** No subprocess to crash, no port-collision retries,
  no auto-restart loop. The Express server either boots or it doesn't.
- **Same lifecycle as the MCP server.** Whatever runs the MCP server runs the
  renderer too — Docker, systemd, `nodemon`, all just work.

## What moved where

```
bvr-renderer/
├── src/
│   ├── server.js           →  src/report-renderer/index.ts        (TypeScript port; routes mounted on existing Express)
│   ├── render.js           →  src/report-renderer/render.ts       (TypeScript port)
│   ├── pdf.js              →  src/report-renderer/pdf.ts          (TypeScript port; Playwright lazy-imported)
│   ├── config.js           →  merged into src/config.ts + src/report-renderer/themes.ts
│   ├── cli.js              →  removed (no longer needed)
│   └── plugins/
│       ├── callouts.js     →  src/report-renderer/plugins/callouts.ts
│       └── metric-cards.js →  src/report-renderer/plugins/metric-cards.ts
├── theme/
│   ├── harness/            →  src/report-renderer/static/themes/harness/
│   ├── modern/             →  src/report-renderer/static/themes/modern/
│   ├── glass/              →  src/report-renderer/static/themes/glass/
│   └── kinetic/            →  src/report-renderer/static/themes/kinetic/
├── public/                 →  src/report-renderer/static/public/
├── content/                →  examples/reports/solera/             (sample content; not loaded automatically)
├── package.json            →  removed (deps merged into root package.json)
└── node_modules/           →  removed (install via root pnpm)
```

## Dependency changes

The following dependencies were promoted from `bvr-renderer/package.json` into
the root `package.json`:

```
markdown-it                  ^14.1.1
markdown-it-anchor           ^9.2.0
markdown-it-attrs            ^4.3.1
markdown-it-container        ^4.0.0
markdown-it-deflist          ^3.0.0
markdown-it-footnote         ^4.0.0
markdown-it-task-lists       ^2.1.1
gray-matter                  ^4.0.3
slugify                      ^1.6.9
chokidar                     ^5.0.0
pagedjs                      ^0.4.3
playwright                   ^1.59.1   ← only loaded when PDF export is requested
```

Plus `@types/markdown-it` to dev dependencies. Other markdown-it plugins ship
without types and are declared in `src/report-renderer/types.d.ts`.

## How to migrate your code / scripts

### 1. Update calls to the MCP tool

Anywhere that calls the MCP tool, rename it:

```diff
- "tool": "harness_ccm_finops_bvr_render"
+ "tool": "harness_ccm_finops_report_render"
```

The `assets_dir` input is **gone** — the directory containing the markdown is
now auto-served as the report's web root. Drop the parameter:

```diff
{
  "tool": "harness_ccm_finops_report_render",
  "markdown_path": "/path/to/customer-bvr.md",
- "assets_dir": "/path/to/customer-bvr-assets",
  "theme": "harness"
}
```

If your markdown lives separately from its assets and you can't co-locate
them, use the new optional `base_dir` to override the web root:

```json
{
  "markdown_path": "/projects/acme/reports/bvr.md",
  "base_dir":      "/projects/acme"   // serves both reports/ and assets/
}
```

Everything else (`markdown_path`, `theme`, `id`, `label`, `open_in_browser`)
behaves the same.

### 2. Update env vars

Remove the old `HARNESS_BVR_*` vars from `.env`:

```diff
- HARNESS_BVR_URL=http://localhost:4321
- HARNESS_BVR_PORT=4321
- HARNESS_BVR_AUTOSTART=true
+ # HARNESS_REPORT_PORT=4321   # only needed in stdio transport mode
```

In HTTP transport mode there is **no env var to set** — reports automatically
share the MCP `PORT`.

### 3. Update any scripts that hit the renderer directly

If you were using the renderer's HTTP API directly (e.g. via `curl` or your
own scripts), the URL paths changed:

```diff
- POST   http://localhost:4321/api/docs            { content_path, assets_dir }
+ POST   http://localhost:3000/api/docs            { content_path, assets_dir }
  # Hostname/port matches your MCP server in HTTP mode.

- GET    http://localhost:4321/doc/<id>/
+ GET    http://localhost:3000/reports/<id>/

- GET    http://localhost:4321/doc/<id>/assets/<file>
+ GET    http://localhost:3000/reports/<id>/<any-relative-path>
  # Any file under the report's base_dir is served — not just /assets/.

- GET    http://localhost:4321/doc/<id>/download
+ GET    http://localhost:3000/reports/<id>/download

- POST   http://localhost:4321/doc/<id>/pdf
+ POST   http://localhost:3000/reports/<id>/pdf
```

> **Note:** the `POST /api/docs` REST endpoint is no longer exposed — programs
> that previously used it should call the `harness_ccm_finops_report_render`
> MCP tool instead. (Internal in-process callers can import `registerReport`
> from `./report-renderer/index.js` directly.)

### 4. Bookmarks / saved URLs

Any saved doc URLs of the form `http://localhost:4321/doc/<id>/` will 404. The
new equivalent is `http://localhost:<MCP_PORT>/reports/<id>/`. Re-running the
tool produces the new URL.

### 5. Custom themes

If you authored a custom theme under `bvr-renderer/theme/<id>/`:

1. Move the directory to `src/report-renderer/static/themes/<id>/`.
2. Update any URLs in your `template.js` from:
   ```diff
   - const themeBase = `/theme/${theme.id}`;
   + const themeBase = `/_report/themes/${theme.id}`;
   ```
   ```diff
   - <script src="/vendor/paged.polyfill.js">
   + <script src="/_report/vendor/paged.polyfill.js">
   ```
   ```diff
   - <script src="/public/theme-switch.js">
   + <script src="/_report/public/theme-switch.js">
   ```
3. Rebuild — `pnpm build` will copy the new theme into `build/report-renderer/static/themes/<id>/`.

The four built-in themes (`harness`, `modern`, `glass`, `kinetic`) have
already been updated.

### 6. Custom content

The example `content/solera-finops-maturity-assessment.md` is now in
`examples/reports/solera/` for reference. It is **not** loaded automatically;
register it via the MCP tool like any other report:

```json
{
  "tool": "harness_ccm_finops_report_render",
  "markdown_path": "/absolute/path/to/repo/examples/reports/solera/solera-finops-maturity-assessment.md"
}
```

## Cleanup checklist

After upgrading, you can safely remove:

- The `bvr-renderer/` directory (already deleted in this commit).
- Any references to `HARNESS_BVR_URL`, `HARNESS_BVR_PORT`, `HARNESS_BVR_AUTOSTART`
  in your `.env`, deployment manifests, or CI scripts.
- Any cached `bvr-renderer/node_modules` from your filesystem (`rm -rf bvr-renderer/`
  if it survived a prior checkout).
- Any process-management config (systemd unit, PM2 config, Docker entry) that
  spawned the renderer separately — the MCP server now does this in-process.

## Validation

Run the integrated server in HTTP mode and probe it:

```bash
pnpm build
PORT=3000 node --env-file=.env build/index.js http &

# MCP endpoint and report renderer share the same port:
curl http://localhost:3000/health         # { "status": "ok", ... }
curl http://localhost:3000/_report/health # { "ok": true, "service": "report-renderer", "reports": 0 }
curl http://localhost:3000/reports/       # HTML index of registered reports
```

Then call the MCP tool — the returned `url` will be on the same port.

## Backwards-compatibility shim

There is **no backwards-compatibility shim** for the old `bvr-renderer/` paths
or the old tool name. If you have automation that still references them, update
it before upgrading.

## Questions / issues

If something broke, check:

1. `pnpm install` was run after pulling — new deps are required.
2. `pnpm build` was run — the `build:copy-assets` step now also runs and is
   required to put themes into `build/report-renderer/static/`.
3. The MCP server is in HTTP mode if you expect reports on port `3000`. In
   stdio mode reports live on `HARNESS_REPORT_PORT` (default `4321`).
4. Playwright + Chromium are installed if you're hitting `/download`:
   `npx playwright install chromium`.
