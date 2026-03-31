# NoteStamp: A YouTube Timestamp Notetaker

Chrome extension for taking timestamped notes while watching YouTube videos.

Current version: `v0.4.1`.

## Installation (Load Unpacked in Chrome)

1. Download from [Releases](https://github.com/yuphyealorn-ops/NoteStamp/releases) or clone this repository.
2. Open Chrome and go to `chrome://extensions`, or follow below:

![Alt text](./images/Manage-extension.png)

3. Enable **Developer mode** (top-right).

![Alt text](./images/Developer-mode.png)

4. Click **Load unpacked**.

![Alt text](./images/Load-unpacked.png)

5. Select this project folder (the folder containing `manifest.json`).
6. Pin the extension from the extensions menu if you want quick access.

You can also load it in Chromium-based browsers that support Chrome extensions (Edge, Brave, etc.) with similar steps.

## How to Use

1. Open a YouTube video page (`https://www.youtube.com/watch...`).
2. Click the extension icon to open the popup.
3. Click **Capture Time** to read the current playback time.
4. Type your note in the textarea.
5. Click **Add Note** (or use `Ctrl+Enter` / `Cmd+Enter`).
6. Repeat as needed while watching.

Notes are shown in the popup and associated with the current video URL.

## Current Features

### Timestamp Capture
- **Live mode:** ticks the timestamp badge every 250ms in sync with the playing video
- **Snap mode:** one-shot freeze of the current playback time (stops live mode automatically)

### Notes
- Write and save notes tied to a captured timestamp
- Notes auto-sorted in chronological order regardless of when they were added
- Delete individual notes
- Clear all notes for the current video (with in-extension confirmation dialog — no browser popup)
- Click a note timestamp to jump/seek to that moment in the current video
- Keyboard shortcut: `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac) to add a note

### Storage & Export
- Notes stored per video URL using `chrome.storage.local` — persists across popup closes and browser restarts
- Auto-load existing notes for the current video when the popup opens
- Export notes for the current video as a `.txt` file with timestamps

### Navigation
- **Video history sidebar:** lists every YouTube video with saved notes; click any entry to open that tab and load its notes
- Auto-detect active YouTube tab on popup open — reads video title, URL, and playback position immediately

### Technical
- Script injection via `chrome.scripting.executeScript`. Works on tabs that were open before the extension was installed or reloaded, no content script dependency

## Permissions

- `storage`: save notes locally in the browser
- `activeTab`, `tabs`, `scripting`: read video time/title from the active YouTube tab
- `host_permissions` for `https://www.youtube.com/*`: run only on YouTube pages