Yes — this instruction means the app needs a **Google Apps Script Web App endpoint**, not the normal Google Sheet URL.

The flow is:

`Your App` → sends data to Apps Script `/exec` URL → Apps Script writes into → `Google Sheet`

So do this:

1. Open the Google Sheet you want the app to write into.
2. Go to **Extensions → Apps Script**.
3. You will see a file like `Code.gs`.
4. Open your project's file:
   `scripts/apps-script/capture.gs`
5. Copy all the code from `capture.gs` and paste it into `Code.gs`.
6. Click **Save**.
7. In the Apps Script page, click **Deploy → New deployment**.
8. Click the gear / **Select type → Web app**.
9. Set:

   * **Execute as:** `Me`
   * **Who has access:** usually `Anyone`
10. Click **Deploy** and approve the Google authorization.
11. Google will give you a URL like:

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxx/exec
```

**This `/exec` URL is what the instruction wants you to paste into the app.**

Do **not** paste this:

```text
https://docs.google.com/spreadsheets/d/xxxxx/edit
```

Paste this instead:

```text
https://script.google.com/macros/s/xxxxx/exec
```

The reason is simple: a Google Sheet URL is mainly for opening/viewing/editing the spreadsheet. Your application needs an API-like endpoint to send data to, and `capture.gs` creates that endpoint.
