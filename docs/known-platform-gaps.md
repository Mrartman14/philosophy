# Known platform gaps (iOS web APIs)

The following browser APIs either lack support or have restricted behaviour on iOS Safari as of the time of writing. Check MDN / Can I Use for updated status before implementing.

- **`navigator.vibrate`** — not supported on iOS. Check periodically whether support has been added.
- **`navigator.setAppBadge`** — not supported on iOS. Same as above; monitor for updates.
- **File System Access API** — available on iOS but runs in an isolated sandbox (origin-private file system only); direct access to the user's file system is not possible.
