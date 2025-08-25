// Content script for text highlighting functionality

class HighlightSaver {
  constructor() {
    this.currentPopup = null;
    this.savedHighlights = new Map();
    this.pendingHighlight = null; // Store highlight data when popup is shown
    this.init();
  }

  async init() {
    try {
      this.bindEvents();

      // Check if we're in a valid context for Chrome extension
      if (typeof chrome !== "undefined" && chrome.runtime) {
        await this.loadSavedHighlights();
        this.markExistingHighlights();
      } else {
        console.warn(
          "Chrome extension APIs not available, running in limited mode"
        );
        this.savedHighlightsData = [];
      }
    } catch (error) {
      console.error("Error during initialization:", error);
      this.savedHighlightsData = [];
    }
  }

  bindEvents() {
    // Listen for text selection
    document.addEventListener("mouseup", (e) => this.handleTextSelection(e));
    document.addEventListener("keyup", (e) => this.handleTextSelection(e));

    // Hide popup when clicking outside
    document.addEventListener("click", (e) => this.handleOutsideClick(e));

    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.markExistingHighlights();
      }
    });

    // Handle URL fragments for scroll-to-text functionality
    this.handleUrlFragment();
  }

  handleTextSelection(event) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Remove existing popup
    this.removePopup();

    // Show popup if text is selected
    if (selectedText.length > 0 && selectedText.length < 1000) {
      // Store the selection data immediately before it gets cleared
      this.storeSelectionData(selection, selectedText);
      // Add small delay to ensure DOM is ready
      setTimeout(() => {
        this.showSavePopup(selectedText, event);
      }, 50);
    } else if (selectedText.length === 0) {
      this.pendingHighlight = null;
    }
  }

  storeSelectionData(selection, selectedText) {
    // Store all the data we need while selection is still valid
    const range = selection.getRangeAt(0);
    const pageInfo = this.getPageInfo();

    // Get text position for scroll-to functionality
    const rect = range.getBoundingClientRect();
    const textPosition = {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };

    this.pendingHighlight = {
      text: selectedText,
      range: {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
        clonedContents: range.cloneContents(),
      },
      pageInfo: pageInfo,
      surroundingText: this.getSurroundingTextFromRange(range),
      textPosition: textPosition,
      timestamp: Date.now(),
    };
  }

  handleOutsideClick(event) {
    if (this.currentPopup && !this.currentPopup.contains(event.target)) {
      this.removePopup();
    }
  }

  showSavePopup(selectedText, event) {
    // Create popup element
    const popup = document.createElement("div");
    popup.id = "highlight-saver-popup-unique";
    popup.className = "highlight-saver-popup";

    // Position popup below the highlighted text
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Calculate position below the selection
      const top = rect.bottom + window.scrollY + 8; // 8px gap
      const left = rect.left + window.scrollX;

      // Ensure popup doesn't go off-screen
      const popupWidth = 200; // Estimated width
      const viewportWidth = window.innerWidth;
      const adjustedLeft = Math.min(left, viewportWidth - popupWidth - 20);

      Object.assign(popup.style, {
        position: "absolute",
        top: `${top}px`,
        left: `${Math.max(20, adjustedLeft)}px`,
        zIndex: "2147483647",
      });
    } else {
      // Fallback positioning
      Object.assign(popup.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "2147483647",
      });
    }

    // Create buttons with minimal styling
    const saveButton = document.createElement("button");
    saveButton.id = "highlight-save-btn-unique";
    saveButton.textContent = "Save";
    saveButton.className = "highlight-save-btn";

    const cancelButton = document.createElement("button");
    cancelButton.id = "highlight-cancel-btn-unique";
    cancelButton.textContent = "Cancel";
    cancelButton.className = "highlight-cancel-btn";

    // Create summarize button
    const summarizeButton = document.createElement("button");
    summarizeButton.id = "highlight-summarize-btn-unique";
    summarizeButton.textContent = "Summarize";
    summarizeButton.className = "highlight-summarize-btn";

    // Assemble popup with 3 buttons
    popup.appendChild(summarizeButton);
    popup.appendChild(saveButton);
    popup.appendChild(cancelButton);

    // Add event listeners with explicit binding
    const saveHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.handleSaveClick();
    };

    const cancelHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Clear pending data
      this.pendingHighlight = null;

      // Use centralized cleanup method
      this.removePopup();

      // Additional cleanup: clear text selection to prevent new popup
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    };

    const summarizeHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.handleSummarizeClick();
    };

    // Add event listeners for better compatibility
    saveButton.addEventListener("click", saveHandler, true);
    saveButton.addEventListener("mousedown", saveHandler, true);

    cancelButton.addEventListener("click", cancelHandler, true);
    cancelButton.addEventListener("mousedown", cancelHandler, true);

    summarizeButton.addEventListener("click", summarizeHandler, true);
    summarizeButton.addEventListener("mousedown", summarizeHandler, true);

    // Store handlers for cleanup
    saveButton._highlightHandler = saveHandler;
    cancelButton._highlightHandler = cancelHandler;
    summarizeButton._highlightHandler = summarizeHandler;

    // Hover effects are now handled by CSS

    document.body.appendChild(popup);
    this.currentPopup = popup;

    // Auto-remove after 10 seconds as failsafe
    setTimeout(() => {
      if (this.currentPopup === popup) {
        this.removePopup();
      }
    }, 10000);
  }

  handleSaveClick() {
    if (this.pendingHighlight) {
      this.saveHighlightFromPending();
    } else {
      console.error("No pending highlight data to save");
      this.showErrorFeedback("No highlight data found");
    }
  }

  handleCancelClick() {
    this.pendingHighlight = null;
    this.removePopup();
  }

  async handleSummarizeClick() {
    if (!this.pendingHighlight) {
      console.error("No pending highlight data to summarize");
      this.showErrorFeedback("No highlight data found");
      return;
    }

    try {
      // Get the summarize button and disable it
      const summarizeBtn = this.currentPopup.querySelector(
        "#highlight-summarize-btn-unique"
      );
      if (summarizeBtn) {
        summarizeBtn.disabled = true;
        summarizeBtn.textContent = "Summarizing...";
      }

      // Create highlight object for AI service
      const highlight = {
        text: this.pendingHighlight.text,
        url: this.pendingHighlight.pageInfo.url,
        title: this.pendingHighlight.pageInfo.title,
        domain: this.pendingHighlight.pageInfo.domain,
        pageText: this.pendingHighlight.surroundingText,
      };

      // Use simple AI service (no ES6 imports)
      const summary = await this.simpleSummarize(highlight);

      // Show summary in a new popup or replace current popup content
      this.showSummaryPopup(summary);
    } catch (error) {
      console.error("Failed to summarize highlight:", error);
      this.showErrorFeedback("Failed to summarize: " + error.message);

      // Re-enable the summarize button
      const summarizeBtn = this.currentPopup.querySelector(
        "#highlight-summarize-btn-unique"
      );
      if (summarizeBtn) {
        summarizeBtn.disabled = false;
        summarizeBtn.textContent = "Summarize";
      }
    }
  }

  async simpleSummarize(highlight) {
    try {
      // Load config
      const response = await fetch(chrome.runtime.getURL("env.config"));
      const envText = await response.text();

      const config = {};
      const lines = envText.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("#")) {
          const [key, value] = trimmedLine.split("=");
          if (key && value) {
            config[key.trim()] = value.trim();
          }
        }
      }

      const apiKey = config.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key not found in env.config");
      }

      const prompt = `Please summarize this highlighted text from a webpage in 2-3 sentences:

Highlight: "${highlight.text}"
Page Title: "${highlight.title}"
Domain: "${highlight.domain}"

Provide a concise summary that captures the key points:`;

      const aiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.AI_MODEL || "gpt-4",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful AI assistant that summarizes highlighted text from web pages.",
              },
              { role: "user", content: prompt },
            ],
            max_tokens: parseInt(config.AI_MAX_TOKENS) || 150,
            temperature: parseFloat(config.AI_TEMPERATURE) || 0.8,
          }),
        }
      );

      if (!aiResponse.ok) {
        throw new Error(`API request failed: ${aiResponse.status}`);
      }

      const data = await aiResponse.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error("AI summarization failed:", error);
      throw error;
    }
  }

  removePopup() {
    if (this.currentPopup) {
      // Clean up event listeners
      const saveBtn = this.currentPopup.querySelector(
        "#highlight-save-btn-unique"
      );
      const cancelBtn = this.currentPopup.querySelector(
        "#highlight-cancel-btn-unique"
      );
      const summarizeBtn = this.currentPopup.querySelector(
        "#highlight-summarize-btn-unique"
      );

      if (saveBtn && saveBtn._highlightHandler) {
        saveBtn.removeEventListener("click", saveBtn._highlightHandler, true);
        saveBtn.removeEventListener(
          "mousedown",
          saveBtn._highlightHandler,
          true
        );
      }

      if (cancelBtn && cancelBtn._highlightHandler) {
        cancelBtn.removeEventListener(
          "click",
          cancelBtn._highlightHandler,
          true
        );
        cancelBtn.removeEventListener(
          "mousedown",
          cancelBtn._highlightHandler,
          true
        );
      }

      if (summarizeBtn && summarizeBtn._highlightHandler) {
        summarizeBtn.removeEventListener(
          "click",
          summarizeBtn._highlightHandler,
          true
        );
        summarizeBtn.removeEventListener(
          "mousedown",
          summarizeBtn._highlightHandler,
          true
        );
      }

      // Clean up any potential inline handlers
      if (saveBtn) saveBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (summarizeBtn) summarizeBtn.onclick = null;

      this.currentPopup.remove();
      this.currentPopup = null;
    }

    // Fallback: also try to remove by ID in case reference is lost
    const popupElement = document.getElementById(
      "highlight-saver-popup-unique"
    );
    if (popupElement) {
      popupElement.remove();
    }
  }

  async saveHighlightFromPending() {
    if (!this.pendingHighlight) {
      console.error("No pending highlight data");
      this.showErrorFeedback("No highlight data found");
      return;
    }

    try {
      // Create highlight object from stored data
      const highlight = {
        id: this.generateId(),
        text: this.pendingHighlight.text,
        url: this.pendingHighlight.pageInfo.url,
        title: this.pendingHighlight.pageInfo.title,
        domain: this.pendingHighlight.pageInfo.domain,
        timestamp: this.pendingHighlight.timestamp,
        pageText: this.pendingHighlight.surroundingText,
        textPosition: this.pendingHighlight.textPosition,
      };

      // Save to storage
      const result = await this.saveToStorage(highlight);

      if (result && result.success) {
        // Mark text as saved using stored range data
        this.markTextAsSavedFromPending(highlight.id);

        // Clear pending data
        this.pendingHighlight = null;

        // Clear text selection to prevent popup from reappearing
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }

        // Remove popup
        this.removePopup();

        // Show success feedback
        this.showSuccessFeedback();
      } else {
        throw new Error(result?.error || "Unknown storage error");
      }
    } catch (error) {
      console.error("Failed to save highlight:", error);
      this.showErrorFeedback("Failed to save: " + error.message);
    }
  }

  markTextAsSavedFromPending(highlightId) {
    if (!this.pendingHighlight || !this.pendingHighlight.range) {
      console.error("No pending range data to mark");
      return;
    }

    try {
      // Recreate the range from stored data
      const range = document.createRange();
      range.setStart(
        this.pendingHighlight.range.startContainer,
        this.pendingHighlight.range.startOffset
      );
      range.setEnd(
        this.pendingHighlight.range.endContainer,
        this.pendingHighlight.range.endOffset
      );

      // Use a more robust method to mark text
      this.markRangeWithSpan(range, highlightId);
    } catch (error) {
      console.error("Error marking text as saved:", error);
      // Fallback: just clear any existing selection
      const selection = window.getSelection();
      selection.removeAllRanges();
    }
  }

  markRangeWithSpan(range, highlightId) {
    try {
      // First try the simple surroundContents method
      const span = document.createElement("span");
      span.className = "highlight-saver-saved";
      span.dataset.highlightId = highlightId;
      span.title = "Saved highlight - Click to view in extension";
      span.style.backgroundColor = "#ffff99";
      span.style.padding = "1px 2px";
      span.style.borderRadius = "2px";

      range.surroundContents(span);
      this.savedHighlights.set(highlightId, span);
    } catch (rangeError) {
      // Fallback: manually extract and wrap content
      this.markRangeWithFallback(range, highlightId);
    }
  }

  markRangeWithFallback(range, highlightId) {
    try {
      // Extract the content from the range
      const contents = range.extractContents();

      // Create the span wrapper
      const span = document.createElement("span");
      span.className = "highlight-saver-saved";
      span.dataset.highlightId = highlightId;
      span.title = "Saved highlight - Click to view in extension";
      span.style.backgroundColor = "#ffff99";
      span.style.padding = "1px 2px";
      span.style.borderRadius = "2px";

      // Put the extracted content into the span
      span.appendChild(contents);

      // Insert the span at the start of the range
      range.insertNode(span);

      // Collapse the range to remove the selection
      range.collapse(true);

      this.savedHighlights.set(highlightId, span);
    } catch (fallbackError) {
      console.error("Fallback marking also failed:", fallbackError);
      // Last resort: just clear the selection
      const selection = window.getSelection();
      selection.removeAllRanges();
    }
  }

  getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
    };
  }

  getSurroundingTextFromRange(range) {
    const container = range.commonAncestorContainer;

    // Get text from the containing element
    if (container.nodeType === Node.TEXT_NODE) {
      return container.parentElement.textContent.substring(0, 200) + "...";
    } else {
      return container.textContent.substring(0, 200) + "...";
    }
  }

  generateId() {
    return (
      "highlight_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  async saveToStorage(highlight) {
    // Check if Chrome APIs are available
    if (typeof chrome === "undefined" || !chrome.runtime) {
      console.error("Chrome runtime not available");
      throw new Error("Chrome extension APIs not available");
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error("Background script response timeout");
        reject(new Error("Response timeout"));
      }, 5000);

      try {
        chrome.runtime.sendMessage(
          {
            action: "saveHighlight",
            highlight: highlight,
          },
          (response) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
              console.error("Chrome runtime error:", chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("Error sending message:", error);
        reject(error);
      }
    });
  }

  async loadSavedHighlights() {
    try {
      // Check if Chrome APIs are available
      if (typeof chrome === "undefined" || !chrome.runtime) {
        console.error("Chrome runtime not available");
        this.savedHighlightsData = [];
        return;
      }

      const response = await new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(
            {
              action: "getHighlights",
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        } catch (error) {
          reject(error);
        }
      });

      this.savedHighlightsData = response.highlights || [];
    } catch (error) {
      console.error("Failed to load saved highlights:", error);
      this.savedHighlightsData = [];
    }
  }

  markExistingHighlights() {
    try {
      // Clear existing marks
      document.querySelectorAll(".highlight-saver-saved").forEach((el) => {
        if (el && el.parentNode) {
          const parent = el.parentNode;
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        }
      });
      this.savedHighlights.clear();

      // Mark highlights for current page
      const currentUrl = window.location.href;
      const pageHighlights = this.savedHighlightsData.filter(
        (h) => h.url === currentUrl
      );

      pageHighlights.forEach((highlight) => {
        this.findAndMarkText(highlight);
      });
    } catch (error) {
      console.error("Error marking existing highlights:", error);
    }
  }

  findAndMarkText(highlight) {
    const text = highlight.text;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.includes(text)) {
        textNodes.push(node);
      }
    }

    textNodes.forEach((textNode) => {
      const content = textNode.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        const before = content.substring(0, index);
        const after = content.substring(index + text.length);

        const span = document.createElement("span");
        span.className = "highlight-saver-saved";
        span.dataset.highlightId = highlight.id;
        span.textContent = text;
        span.title = "Saved highlight - Click to view in extension";
        span.style.backgroundColor = "#ffff99";
        span.style.padding = "1px 2px";
        span.style.borderRadius = "2px";

        const parent = textNode.parentNode;
        const beforeNode = document.createTextNode(before);
        const afterNode = document.createTextNode(after);

        parent.replaceChild(beforeNode, textNode);
        parent.insertBefore(span, beforeNode.nextSibling);
        parent.insertBefore(afterNode, span.nextSibling);

        this.savedHighlights.set(highlight.id, span);
      }
    });
  }

  showSuccessFeedback() {
    this.showFeedback("Highlight saved!", "#10b981");
  }

  showErrorFeedback(message = "Failed to save highlight") {
    this.showFeedback(message, "#ef4444");
  }

  showFeedback(message, backgroundColor) {
    // Remove any existing feedback
    const existing = document.querySelector(".highlight-feedback");
    if (existing) {
      existing.remove();
    }

    // Create new feedback element
    const feedback = document.createElement("div");
    feedback.className = "highlight-feedback";
    Object.assign(feedback.style, {
      position: "fixed",
      top: "80px", // Below the popup
      right: "20px",
      background: backgroundColor,
      color: "white",
      padding: "8px 12px",
      borderRadius: "6px",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontWeight: "bold",
      zIndex: "2147483646",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    });
    feedback.textContent = message;

    document.body.appendChild(feedback);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 3000);
  }

  handleUrlFragment() {
    const hash = window.location.hash;
    if (hash && hash.includes("highlight=")) {
      const params = new URLSearchParams(hash.substring(1));
      const highlightText = params.get("highlight");
      const positionData = params.get("pos");

      if (highlightText) {
        // Wait for page to load completely and try multiple times
        let attempts = 0;
        const maxAttempts = 5;

        const tryScroll = () => {
          attempts++;
          if (
            document.body &&
            document.body.textContent.includes(highlightText)
          ) {
            this.scrollToAndHighlightText(highlightText, positionData);
          } else if (attempts < maxAttempts) {
            setTimeout(tryScroll, 500);
          }
        };

        setTimeout(tryScroll, 500);
      }
    }
  }

  scrollToAndHighlightText(text, positionData) {
    try {
      // Try to find the text on the page
      const textNodes = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes(text)) {
          textNodes.push(node);
        }
      }

      if (textNodes.length > 0) {
        // Find the best match (exact match or closest)
        let bestMatch = textNodes[0];
        let bestScore = 0;

        textNodes.forEach((textNode) => {
          const content = textNode.textContent;
          const index = content.indexOf(text);
          if (index !== -1) {
            const score = text.length / content.length; // Higher score for more exact matches
            if (score > bestScore) {
              bestScore = score;
              bestMatch = textNode;
            }
          }
        });

        // Create range and scroll to it
        const range = document.createRange();
        const content = bestMatch.textContent;
        const index = content.indexOf(text);

        range.setStart(bestMatch, index);
        range.setEnd(bestMatch, index + text.length);

        // Get the bounding rect and scroll
        const rect = range.getBoundingClientRect();
        const scrollTop = rect.top + window.scrollY - 100; // 100px offset

        window.scrollTo({
          top: scrollTop,
          behavior: "smooth",
        });

        // Temporarily highlight the text
        this.temporarilyHighlightText(range, text);

        // Show feedback
        this.showFeedback("Scrolled to highlighted text!", "#10b981");
      } else {
        // Fallback: try to use position data if available
        if (positionData) {
          try {
            const position = JSON.parse(decodeURIComponent(positionData));
            window.scrollTo({
              top: position.top - 100,
              behavior: "smooth",
            });
            this.showFeedback("Scrolled to approximate position", "#f59e0b");
          } catch (e) {
            console.error("Failed to parse position data:", e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to scroll to text:", error);
    }
  }

  temporarilyHighlightText(range, text) {
    try {
      // Create a temporary highlight overlay
      const highlight = document.createElement("div");
      highlight.className = "temporary-highlight";
      Object.assign(highlight.style, {
        position: "absolute",
        backgroundColor: "rgba(255, 255, 0, 0.3)",
        border: "2px solid #fbbf24",
        borderRadius: "2px",
        pointerEvents: "none",
        zIndex: "2147483645",
        animation: "pulse 2s ease-in-out",
      });

      // Position the highlight
      const rect = range.getBoundingClientRect();
      Object.assign(highlight.style, {
        top: `${rect.top + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });

      document.body.appendChild(highlight);

      // Remove the highlight after 3 seconds
      setTimeout(() => {
        if (highlight.parentNode) {
          highlight.remove();
        }
      }, 3000);
    } catch (error) {
      console.error("Failed to create temporary highlight:", error);
    }
  }

  showSummaryPopup(summary) {
    // Remove existing popup
    this.removePopup();

    // Create summary popup
    const summaryPopup = document.createElement("div");
    summaryPopup.id = "highlight-summary-popup-unique";
    summaryPopup.className = "highlight-saver-popup highlight-summary-popup";

    // Position it in the same location as the original popup
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const top = rect.bottom + window.scrollY + 8;
      const left = rect.left + window.scrollX;

      const popupWidth = 300; // Wider for summary
      const viewportWidth = window.innerWidth;
      const adjustedLeft = Math.min(left, viewportWidth - popupWidth - 20);

      Object.assign(summaryPopup.style, {
        position: "absolute",
        top: `${top}px`,
        left: `${Math.max(20, adjustedLeft)}px`,
        zIndex: "2147483647",
        maxWidth: "300px",
        minWidth: "250px",
      });
    } else {
      // Fallback positioning when selection is cleared
      Object.assign(summaryPopup.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "2147483647",
        maxWidth: "300px",
        minWidth: "250px",
      });
    }

    // Create summary content
    const summaryContent = document.createElement("div");
    summaryContent.className = "summary-content";
    summaryContent.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">AI Summary:</div>
      <div style="font-size: 12px; line-height: 1.4; color: #6b7280;">${summary}</div>
    `;

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.className = "highlight-cancel-btn";
    closeButton.style.marginTop = "8px";
    closeButton.onclick = () => {
      summaryPopup.remove();
    };

    // Assemble summary popup
    summaryPopup.appendChild(summaryContent);
    summaryPopup.appendChild(closeButton);

    document.body.appendChild(summaryPopup);
    this.currentPopup = summaryPopup;

    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (this.currentPopup === summaryPopup) {
        summaryPopup.remove();
        this.currentPopup = null;
      }
    }, 15000);
  }
}

// Initialize the highlight saver when DOM is ready
try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new HighlightSaver();
    });
  } else {
    new HighlightSaver();
  }
} catch (error) {
  console.error("Failed to initialize Highlight Saver:", error);
}
