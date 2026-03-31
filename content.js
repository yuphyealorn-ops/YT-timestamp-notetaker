chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTimestamp") {
    const video = document.querySelector("video");
    if (video) {
      const currentTime = video.currentTime;
      const videoTitle = document.title.replace(" - YouTube", "").trim();
      const videoUrl = window.location.href;
      sendResponse({ time: currentTime, title: videoTitle, url: videoUrl });
    } else {
      sendResponse({ error: "No video found" });
    }
  }

  if (request.action === "seekTo") {
    const video = document.querySelector("video");
    if (video) {
      video.currentTime = request.time;
      sendResponse({ success: true });
    }
  }

  return true;
});
