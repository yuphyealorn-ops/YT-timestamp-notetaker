let capturedTime = 0;
let currentVideoUrl = "";
let currentVideoTitle = "";
let liveMode = false;
let liveInterval = null;
let activeTabId = null;

const timestampEl = document.getElementById("currentTimestamp");
const noteInput = document.getElementById("noteInput");
const addNoteBtn = document.getElementById("addNoteBtn");
const captureBtn = document.getElementById("captureBtn");
const liveBtn = document.getElementById("liveBtn");
const notesList = document.getElementById("notesList");
const noteCount = document.getElementById("noteCount");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const videoTitleEl = document.getElementById("videoTitle");
const videoInfoEl = document.getElementById("videoInfo");
const historyBtn = document.getElementById("historyBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const closeSidebarBtn = document.getElementById("closeSidebar");
const historyList = document.getElementById("historyList");
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmOkBtn = document.getElementById("confirmOk");
const confirmCancelBtn = document.getElementById("confirmCancel");

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

function saveNotes(url, notes, cb) {
  chrome.storage.local.set({ [storageKey(url)]: notes }, cb);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showStatus(msg) {
  let el = document.getElementById("statusMsg");
  if (!el) {
    el = document.createElement("div");
    el.id = "statusMsg";
    document.querySelector(".input-area").prepend(el);
  }
  el.textContent = msg;
  clearTimeout(el._timeoutId);
  el._timeoutId = setTimeout(() => {
    el.textContent = "";
  }, 3000);
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
    el.addEventListener("click", () => deleteNote(parseInt(el.dataset.index, 10)));
  });
}

function execInTab(tabId, func, args = []) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  }).then((results) => {
    if (!results || !results[0]) return null;
    return results[0].result;
  }).catch(() => null);
}

function getVideoInfo(tabId) {
  return execInTab(tabId, () => {
    const video = document.querySelector("video");
    if (!video) return null;
    return {
      time: video.currentTime,
      title: document.title.replace(" - YouTube", "").trim(),
      url: location.href,
    };
  });
}

function applyVideoInfo(info, shouldLoadNotes) {
  capturedTime = info.time;
  currentVideoUrl = info.url;
  currentVideoTitle = info.title;
  timestampEl.textContent = formatTime(capturedTime);
  videoTitleEl.textContent = currentVideoTitle;
  videoInfoEl.classList.remove("hidden");
  if (shouldLoadNotes) {
    loadNotes(currentVideoUrl);
  }
}

function seekVideo(time) {
  const setTime = (tabId) => {
    execInTab(tabId, (t) => {
      const video = document.querySelector("video");
      if (video) video.currentTime = t;
    }, [time]);
  };

  if (activeTabId) {
    setTime(activeTabId);
    return;
  }

  getActiveYouTubeTab((tab) => {
    if (!tab) return;
    activeTabId = tab.id;
    setTime(tab.id);
  });
}

function startLive() {
  if (!activeTabId) {
    showStatus("⚠ Open a YouTube video first");
    return;
  }
  if (liveMode) return;

  liveMode = true;
  if (liveBtn) liveBtn.classList.add("active");
  timestampEl.classList.add("live-active");

  liveInterval = setInterval(async () => {
    const info = await getVideoInfo(activeTabId);
    if (!info) {
      stopLive();
      return;
    }
    applyVideoInfo(info, false);
  }, 250);
}

function stopLive() {
  if (!liveMode) return;
  liveMode = false;
  if (liveInterval) {
    clearInterval(liveInterval);
    liveInterval = null;
  }
  if (liveBtn) liveBtn.classList.remove("active");
  timestampEl.classList.remove("live-active");
}

if (liveBtn) {
  liveBtn.addEventListener("click", () => {
    if (liveMode) stopLive();
    else startLive();
  });
}

captureBtn.addEventListener("click", async () => {
  captureBtn.classList.add("pulsing");
  setTimeout(() => captureBtn.classList.remove("pulsing"), 300);

  const loadFromTab = async (tab) => {
    if (!tab) {
      showStatus("⚠ Open a YouTube video first");
      return;
    }
    activeTabId = tab.id;
    const info = await getVideoInfo(tab.id);
    if (!info) {
      showStatus("⚠ Could not read video — try refreshing the page");
      return;
    }
    if (liveMode) stopLive();
    applyVideoInfo(info, true);
  };

  if (activeTabId) {
    const info = await getVideoInfo(activeTabId);
    if (info) {
      if (liveMode) stopLive();
      applyVideoInfo(info, true);
      return;
    }
  }

  getActiveYouTubeTab(loadFromTab);
});

addNoteBtn.addEventListener("click", () => {
  const text = noteInput.value.trim();
  if (!text) return;
  if (!currentVideoUrl) {
    showStatus("⚠ Capture a timestamp first!");
    return;
  }

  const key = storageKey(currentVideoUrl);
  chrome.storage.local.get(key, (data) => {
    const notes = data[key] || [];
    notes.push({ time: capturedTime, text, url: currentVideoUrl, title: currentVideoTitle });
    notes.sort((a, b) => a.time - b.time);
    saveNotes(currentVideoUrl, notes, () => {
      renderNotes(notes);
      refreshHistory();
    });
    noteInput.value = "";
  });
});

function deleteNote(index) {
  const key = storageKey(currentVideoUrl);
  chrome.storage.local.get(key, (data) => {
    const notes = data[key] || [];
    notes.splice(index, 1);
    saveNotes(currentVideoUrl, notes, () => {
      renderNotes(notes);
      refreshHistory();
    });
  });
}

function clearCurrentNotes() {
  saveNotes(currentVideoUrl, [], () => {
    renderNotes([]);
    refreshHistory();
  });
}

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

clearBtn.addEventListener("click", () => {
  if (!currentVideoUrl) return;
  if (confirmOverlay) {
    confirmOverlay.classList.remove("hidden");
    return;
  }
  if (confirm("Clear all notes for this video?")) {
    clearCurrentNotes();
  }
});

if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener("click", () => {
    confirmOverlay.classList.add("hidden");
  });
}

if (confirmOkBtn) {
  confirmOkBtn.addEventListener("click", () => {
    confirmOverlay.classList.add("hidden");
    clearCurrentNotes();
  });
}

noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNoteBtn.click();
});

function openSidebar() {
  refreshHistory();
  if (sidebar) sidebar.classList.add("open");
  if (sidebarOverlay) sidebarOverlay.classList.add("active");
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove("open");
  if (sidebarOverlay) sidebarOverlay.classList.remove("active");
}

if (historyBtn) historyBtn.addEventListener("click", openSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

function refreshHistory() {
  if (!historyList) return;

  chrome.storage.local.get(null, (all) => {
    const entries = Object.entries(all)
      .filter(([key, notes]) => key.startsWith("notes_") && Array.isArray(notes) && notes.length > 0)
      .map(([key, notes]) => {
        const first = notes[0] || {};
        const url = first.url || key.slice(6);
        const title = first.title || "Untitled Video";
        return { url, title, count: notes.length };
      });

    if (!entries.length) {
      historyList.innerHTML = '<div class="empty-state small">No saved videos yet.</div>';
      return;
    }

    historyList.innerHTML = entries.map((entry) => {
      const encodedUrl = encodeURIComponent(entry.url);
      return `
        <div class="history-item" data-url="${encodedUrl}">
          <div class="history-item-title">${escapeHtml(entry.title)}</div>
          <div class="history-item-meta">${entry.count} note${entry.count === 1 ? "" : "s"}</div>
        </div>
      `;
    }).join("");

    historyList.querySelectorAll(".history-item").forEach((el) => {
      el.addEventListener("click", () => {
        const url = decodeURIComponent(el.dataset.url);
        closeSidebar();

        chrome.tabs.query({ url: "https://www.youtube.com/watch*" }, (tabs) => {
          const existing = tabs.find((tab) => tab.url === url);
          if (existing) {
            activeTabId = existing.id;
            chrome.tabs.update(existing.id, { active: true });
            chrome.windows.update(existing.windowId, { focused: true });
          } else {
            chrome.tabs.create({ url }, (tab) => {
              if (tab && tab.id) activeTabId = tab.id;
            });
          }
        });

        currentVideoUrl = url;
        chrome.storage.local.get(storageKey(url), (data) => {
          const notes = data[storageKey(url)] || [];
          if (notes.length) {
            currentVideoTitle = notes[0].title || currentVideoTitle;
            videoTitleEl.textContent = currentVideoTitle;
            videoInfoEl.classList.remove("hidden");
          }
          renderNotes(notes);
        });
      });
    });
  });
}

function getActiveYouTubeTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const isYouTubeWatch = tab && tab.url && tab.url.includes("youtube.com/watch");
    if (isYouTubeWatch) activeTabId = tab.id;
    callback(isYouTubeWatch ? tab : null);
  });
}

getActiveYouTubeTab(async (tab) => {
  if (!tab) return;
  const info = await getVideoInfo(tab.id);
  if (!info) return;
  applyVideoInfo(info, true);
});
