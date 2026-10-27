# ReadKernel for Chrome

Every new tab shows today's ReadKernel brief: the 10 stories that matter, what
developers are discussing, and the best company blog posts. Plain HTML, CSS and
JavaScript, no build step.

| File | What it does |
| --- | --- |
| `manifest.json` | Manifest V3. Replaces the new tab page; may only talk to readkernel.in. |
| `newtab.html` / `.css` / `.js` | The page. Reads `https://readkernel.in/api/v1/today`, keeps the last brief in `chrome.storage` (instant and offline), refreshes it every 30 minutes. |
| `icons/` | The ReadKernel dot at 16, 32, 48 and 128 px. |

Permissions: `storage` (remember the last brief and the Summaries switch) and
`search` (the search box uses your own default search engine). No tracking,
no account.

## Try it

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** and pick this `extension` folder.
3. Open a new tab.

To test the page against a local copy of the website, serve this folder
(`python -m http.server 3210`) and open
`http://localhost:3210/newtab.html?api=http://localhost:3200`.

## Publish to the Chrome Web Store

1. Bump `version` in `manifest.json`.
2. Zip the folder's contents (not the folder itself).
3. Upload at https://chrome.google.com/webstore/devconsole (one-time $5
   developer fee), with screenshots and the privacy answers: it stores the
   last brief locally and sends nothing anywhere.
