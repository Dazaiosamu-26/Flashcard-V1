# Pocket Cards

A simple personal flashcard PWA designed for GitHub Pages and Android.

## Features
- Create and organize subject decks
- Manually add, edit, and delete cards
- Tap-to-flip study cards
- Simple spaced-repetition scheduling (Again / Almost / Got it)
- Progress by deck and mastered-card count
- PDF text extraction and locally drafted flashcards
- Source references on generated cards
- JSON export/import backup
- Offline app shell after first successful load
- Installable as a PWA on supported browsers

## Important limitations of free/local PDF generation
This version does **not** use a cloud AI service or require an API key. It extracts selectable text from a PDF in the browser and uses lightweight text-pattern rules to draft candidate cards. It is not a true AI model, so generated cards can be awkward or incorrect and must be reviewed. Scanned/image-only PDFs are not supported because OCR is not included.

The PDF reader (`pdf.js`) is loaded from a CDN, so PDF import needs an internet connection unless that library is separately bundled locally. Normal flashcard study works offline after the app shell has been cached. The app does not send the selected PDF to a server.

## Deploy to GitHub Pages
1. Create a public GitHub repository, for example `pocket-cards`.
2. Upload **all files and the `icons` folder**, preserving the folder structure.
3. In the repository, open **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Wait for the Pages URL to appear. Open that URL over HTTPS.
7. Open it once while online, then use Chrome's menu → **Install app** or **Add to Home screen**.

## Data and privacy
Cards are stored in localStorage on this browser/device. Clearing browser site data can erase them. Use Progress → Export backup regularly. Importing a backup replaces current local data.

## Technical notes
- Static HTML, CSS, and JavaScript, no build step.
- Service worker and manifest use relative paths for project Pages URLs.
- Local storage is per browser and does not automatically sync across devices.
- PDF.js is CDN-loaded in this starter. For fully offline PDF import, download the matching `pdf.min.js` and `pdf.worker.min.js` files and update `index.html` and `app.js` to use local copies.
