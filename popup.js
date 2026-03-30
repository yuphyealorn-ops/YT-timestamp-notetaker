let capturedTime = 0;
let currentVideoUrl = "";
let currentVideoTitle = "";

const timestampEl = document.getElementById("currentTimestamp");
const noteInput = document.getElementById("noteInput");
const addNoteBtn = document.getElementById("addNoteBtn");
const captureBtn = document.getElementById("captureBtn");
const notesList = document.getElementById("notesList");
const noteCount = document.getElementById("noteCount");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const videoTitleEl = document.getElementById("videoTitle");
const videoInfoEl = document.getElementById("videoInfo");
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmOkBtn = document.getElementById("confirmOk");
const confirmCancelBtn = document.getElementById("confirmCancel");

// Format seconds -> m:ss or h:mm:ss
function formatTime(secs) {
  const s = Math.floor(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function storageKey(url) {
  return "notes_" + url;
}

function loadNotes(url) {
  chrome.storage.local.get(storageKey(url), (data) => {
    renderNotes(data[storageKey(url)] || []);
  });
}

function saveNotes(url, notes) {
  chrome.storage.local.set({ [storageKey(url)]: notes });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNotes(notes) {
  noteCount.textContent = notes.length;
  if (notes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <p>No notes yet.</p>
        <p>Open a YouTube video, capture a timestamp, and start noting!</p>
      </div>`;
    return;
  }
  notesList.innerHTML = notes.map((note, i) => `
    <div class="note-card" data-index="${i}">
      <div class="note-meta">
        <span class="note-time" data-time="${note.time}">${formatTime(note.time)}</span>
        <button class="note-delete" data-index="${i}" title="Delete note">✕</button>
      </div>
      <div class="note-text">${escapeHtml(note.text)}</div>
    </div>
  `).join("");

  notesList.querySelectorAll(".note-time").forEach((el) => {
    el.addEventListener("click", () => seekVideo(parseFloat(el.dataset.time)));
  });
  notesList.querySelectorAll(".note-delete").forEach((el) => {
    el.addEventListener("click", () => deleteNote(parseInt(el.dataset.index)));
  });
}

// Core: get video info by injecting a script directly
// this works even if the content script hasn't been injected yet (e.g. tabs that were open before the extension was installed/reloaded).
function getVideoInfo(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const video = document.querySelector("video");
      if (!video) return null;
      return {
        time: video.currentTime,
        title: document.title.replace(" - YouTube", "").trim(),
        url: location.href,
      };
    },
  }).then((results) => {
    if (!results || !results[0] || !results[0].result) return null;
    return results[0].result;
  }).catch(() => null);
}

function seekVideo(time) {
  getActiveYouTubeTab((tab) => {
    if (!tab) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => { const v = document.querySelector("video"); if (v) v.currentTime = t; },
      args: [time],
    }).catch(() => {});
  });
}

// Capture button
captureBtn.addEventListener("click", async () => {
  captureBtn.classList.add("pulsing");
  setTimeout(() => captureBtn.classList.remove("pulsing"), 300);

  getActiveYouTubeTab(async (tab) => {
    if (!tab) {
      showStatus("⚠ Open a YouTube video first");
      return;
    }
    const info = await getVideoInfo(tab.id);
    if (!info) {
      showStatus("⚠ Could not read video — try refreshing the page");
      return;
    }
    capturedTime = info.time;
    currentVideoUrl = info.url;
    currentVideoTitle = info.title;
    timestampEl.textContent = formatTime(capturedTime);
    videoTitleEl.textContent = currentVideoTitle;
    videoInfoEl.classList.remove("hidden");
    loadNotes(currentVideoUrl);
  });
});

// Add note
addNoteBtn.addEventListener("click", () => {
  const text = noteInput.value.trim();
  if (!text) return;
  if (!currentVideoUrl) { showStatus("⚠ Capture a timestamp first!"); return; }

  const key = storageKey(currentVideoUrl);
  chrome.storage.local.get(key, (data) => {
    const notes = data[key] || [];
    notes.push({ time: capturedTime, text, url: currentVideoUrl, title: currentVideoTitle });
    notes.sort((a, b) => a.time - b.time);
    saveNotes(currentVideoUrl, notes);
    renderNotes(notes);
    noteInput.value = "";
  });
});

function deleteNote(index) {
  const key = storageKey(currentVideoUrl);
  chrome.storage.local.get(key, (data) => {
    const notes = data[key] || [];
    notes.splice(index, 1);
    saveNotes(currentVideoUrl, notes);
    renderNotes(notes);
  });
}

// Export 
exportBtn.addEventListener("click", () => {
  if (!currentVideoUrl) return;
  chrome.storage.local.get(storageKey(currentVideoUrl), (data) => {
    const notes = data[storageKey(currentVideoUrl)] || [];
    if (!notes.length) return;
    const lines = [`📝 Notes for: ${currentVideoTitle}`, `🔗 ${currentVideoUrl}`, ""];
    notes.forEach((n) => lines.push(`[${formatTime(n.time)}] ${n.text}`));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${currentVideoTitle.slice(0, 40).replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// Clear 
clearBtn.addEventListener("click", () => {
  if (!currentVideoUrl) return;
  confirmOverlay.classList.remove("hidden");
});

confirmCancelBtn.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
});

confirmOkBtn.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
  if (!currentVideoUrl) return;
  saveNotes(currentVideoUrl, []);
  renderNotes([]);
});

confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) confirmOverlay.classList.add("hidden");
});

noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNoteBtn.click();
});

// Helpers
function getActiveYouTubeTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    callback(tab && tab.url && tab.url.includes("youtube.com/watch") ? tab : null);
  });
}

function showStatus(msg) {
  let el = document.getElementById("statusMsg");
  if (!el) {
    el = document.createElement("div");
    el.id = "statusMsg";
    el.style.cssText = "font-size:11px;color:#ff8c42;padding:4px 16px;font-family:monospace;";
    document.querySelector(".input-area").prepend(el);
  }
  el.textContent = msg;
  setTimeout(() => { el.textContent = ""; }, 3000);
}

// Auto-load on popup open
getActiveYouTubeTab(async (tab) => {
  if (!tab) return;
  const info = await getVideoInfo(tab.id);
  if (!info) return;
  currentVideoUrl = info.url;
  currentVideoTitle = info.title;
  capturedTime = info.time;
  timestampEl.textContent = formatTime(capturedTime);
  videoTitleEl.textContent = currentVideoTitle;
  videoInfoEl.classList.remove("hidden");
  loadNotes(currentVideoUrl);
});
