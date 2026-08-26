# IP Indicator

A Firefox extension (desktop and Android) that shows which IP address the current
site is served from, with an icon telling you at a glance whether the connection
is IPv6 (blue "6"), IPv4 (green "4"), or unknown (grey "?").

Tapping the toolbar button opens a panel with:

- a colour-coded card naming the protocol in use, with the address on it —
  tap the address to copy it
- where that address came from: the tab's live connection, or a DNS lookup
- both halves of the dual stack, with a count of A and AAAA records, the
  addresses themselves, and an "in use" chip on the one the tab is using
- the canonical name when the domain is a CNAME, and whether DNS-over-HTTPS was used

Note that this is the address of the *site's server*. It is not your own
address, so it will not match what a "what is my IP" page reports about you.

## How the address is determined

1. `webRequest.onResponseStarted` reports `details.ip` for the tab's top-level
   request, which is the address Firefox actually connected to. This is preferred
   because a domain with both A and AAAA records only uses one of them.
2. If that is unavailable (the page loaded before the add-on started, or came out
   of cache), the panel falls back to `dns.resolve()` and shows the first AAAA
   record, then the first A record, matching Firefox's own preference for IPv6.
3. URLs that already contain a literal IP are reported as-is with no lookup.

## Permissions

| Permission | Why |
| --- | --- |
| `dns` | resolve A/AAAA records for the domain |
| `webRequest` + `<all_urls>` | read the connection IP of the top-level request |
| `tabs` | know the URL of the active tab |
| `clipboardWrite` | copy button |

No data leaves the browser; DNS queries go through Firefox's own resolver.

## GitHub Releases

Each `v*` tag builds the zip in CI and attaches it to a GitHub Release
(see [Releases](https://github.com/guysoft/firefox-ip-indicator/releases)).
That file is **unsigned**. Use it to try the add-on; a permanent install still
needs Mozilla's signature from AMO.

Desktop, temporary install from a release asset:

1. Download `ip_indicator-*.zip` or `ip-indicator-*.xpi`
2. Open `about:debugging#/runtime/this-firefox`
3. Load Temporary Add-on… and pick the downloaded file

To cut a release, set `version` in `manifest.json`, commit, then:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag must match `manifest.json` (so `v1.0.0` for version `1.0.0`).

## Install for development

Desktop, temporary install:

1. Open `about:debugging#/runtime/this-firefox`
2. Load Temporary Add-on… and pick `manifest.json`

Android, over USB with [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

```bash
# one time: enable USB debugging on the phone, and Remote debugging via USB in Firefox settings
adb devices                       # confirm the phone is listed
npx web-ext run -t firefox-android --android-device <device-id> \
    --firefox-apk org.mozilla.firefox
```

Use `org.mozilla.fenix` for Nightly. Recent Firefox for Android releases can also
install a signed XPI from a file, but unsigned builds must go through `web-ext`.

## Build a package

```bash
npx web-ext build           # writes web-ext-artifacts/ip_indicator-1.0.0.zip
npx web-ext lint
```

For a permanent Android install the package has to be signed by
[addons.mozilla.org](https://addons.mozilla.org/developers/). The manifest
declares `gecko_android` so AMO lists it as Android-compatible.

## Publish on addons.mozilla.org

1. Build the zip with `npx web-ext build` (do not zip the parent folder).
2. Sign in at [Add-on Developer Hub](https://addons.mozilla.org/developers/)
   with a Firefox Account.
3. Submit a New Add-on → **On this site** (listed).
4. Upload `web-ext-artifacts/ip_indicator-1.0.0.zip`.
5. Confirm Firefox **and** Firefox for Android. `gecko_android` in the
   manifest should tick Android automatically.
6. Source code: **No** — this zip *is* the source (plain JS, no minification).
7. Categories: e.g. **Privacy & Security** and **Other**. Same on Android.
8. Screenshots: at least one of the panel (desktop 1280×800 is the usual size;
   Android can use a phone screenshot).
9. Summary / description: see below. Privacy policy is not required: the
   add-on collects no data (`data_collection_permissions: none`). DNS stays
   inside Firefox's own resolver.
10. Wait for automated signing, then human review. Listed add-ons usually
    appear after that review.

Suggested summary (250 characters max):

> Shows the IP address a site is actually served from, and whether that
> connection is IPv4 or IPv6. Dual-stack records are listed in the panel.
> This is the server's address, not yours.

## Notes on Android

`browser.dns` and `browser.webRequest` are both available on Firefox for Android
(uBlock Origin relies on `dns.resolve` there). The button lives under Extensions
in the browser menu, where both the icon and the badge show the current state.

That menu entry is drawn from the *default* browser action icon and badge, not
the per-tab ones, so the add-on sets both: per-tab values keep each tab correct
on desktop, and the default values are re-pointed at whichever tab is in front.
Without that, the Android menu keeps showing the grey placeholder icon.
