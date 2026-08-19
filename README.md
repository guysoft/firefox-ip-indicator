# IP Indicator

A Firefox extension (desktop and Android) that shows which IP address the current
site is served from, with an icon telling you at a glance whether the connection
is IPv6 (blue "6"), IPv4 (green "4"), or unknown (grey "?").

Tapping the toolbar button opens a panel with:

- the main address of the current tab, and where that number came from
- every A and AAAA record the resolver returned for the domain
- the canonical name when the domain is a CNAME, and whether DNS-over-HTTPS was used
- a copy button for the address

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
[addons.mozilla.org](https://addons.mozilla.org/developers/) and its listing has
to be marked Android-compatible.

## Notes on Android

`browser.dns` and `browser.webRequest` are both available on Firefox for Android
(uBlock Origin relies on `dns.resolve` there). The button lives in the extensions
section of the browser menu; badge text is a desktop-only nicety, so the
IPv4/IPv6 state is carried by the icon itself.
