// Content script for text highlighting functionality

class HighlightSaver {
  constructor() {
    this.currentPopup = null;
    this.savedHighlights = new Map();
    this.pendingHighlight = null; // Store highlight data when popup is shown

    // Event handling optimization
    this.selectionTimeout = null;
    this.lastSelectionTime = 0;
    this.selectionThrottleDelay = 150; // 150ms debounce
    this.minSelectionInterval = 100; // 100ms throttle

    // DOM and text search optimization
    this.domCache = {
      body: null,
      existingHighlights: null,
      lastCacheTime: 0,
    };
    this.textNodeCache = new Map();
    this.lastTextSearchTime = 0;
    this.cacheValidityDuration = 30000; // 30 seconds

    // Memory management optimization
    this.maxCacheSize = 100; // Maximum number of cached items
    this.maxTextNodesCache = 50; // Maximum cached text node searches
    this.cleanupInterval = null;
    this.memoryUsage = {
      cacheSize: 0,
      lastCleanup: Date.now(),
    };

    // API optimization
    this.summaryCache = new Map();
    this.maxSummaryCacheSize = 20;
    this.apiRequestQueue = new Map(); // Prevent duplicate requests

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

      // Start periodic memory cleanup
      this.startMemoryCleanup();
    } catch (error) {
      console.error("Error during initialization:", error);
      this.savedHighlightsData = [];
    }
  }

  bindEvents() {
    // Optimized text selection with debouncing and throttling
    const debouncedSelection = (e) => this.handleTextSelectionDebounced(e);

    // Use passive listeners where possible for better performance
    document.addEventListener("mouseup", debouncedSelection, { passive: true });
    document.addEventListener("keyup", debouncedSelection, { passive: true });

    // Hide popup when clicking outside - use capture phase for better performance
    document.addEventListener("click", (e) => this.handleOutsideClick(e), true);

    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.markExistingHighlights();
      }
    });

    // Handle URL fragments for scroll-to-text functionality
    this.handleUrlFragment();

    // Listen for hash changes (SPA-friendly)
    window.addEventListener("hashchange", () => {
      this.handleUrlFragment();
    });

    // Cleanup on page unload - use multiple events for better coverage
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });

    // Backup cleanup for modern browsers and fast navigation
    window.addEventListener("pagehide", () => {
      this.cleanup();
    });

    // Additional cleanup for when the page is being unloaded
    window.addEventListener("unload", () => {
      this.cleanup();
    });

    // Listen for cleanup requests from the extension
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "cleanup") {
          this.cleanup();
          sendResponse({ success: true });
        }
      });
    }
  }

  handleTextSelectionDebounced(event) {
    const now = Date.now();

    // Throttle: don't process if too soon after last selection
    if (now - this.lastSelectionTime < this.minSelectionInterval) {
      return;
    }

    // Clear existing timeout
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }

    // Set new timeout for debouncing
    this.selectionTimeout = setTimeout(() => {
      this.handleTextSelection(event);
      this.lastSelectionTime = Date.now();
    }, this.selectionThrottleDelay);
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
      // Check cache first
      const cacheKey = this.generateSummaryCacheKey(highlight);
      if (this.summaryCache.has(cacheKey)) {
        const cached = this.summaryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) {
          // 5 minutes cache
          return cached.summary;
        }
      }

      // Check if there's already a request in progress for this text
      if (this.apiRequestQueue.has(cacheKey)) {
        return await this.apiRequestQueue.get(cacheKey);
      }

      // Create new request promise
      const requestPromise = this.performSummarizeRequest(highlight, cacheKey);
      this.apiRequestQueue.set(cacheKey, requestPromise);

      try {
        const summary = await requestPromise;
        return summary;
      } finally {
        // Clean up the request queue
        this.apiRequestQueue.delete(cacheKey);
      }
    } catch (error) {
      console.error("AI summarization failed:", error);
      throw error;
    }
  }

  generateSummaryCacheKey(highlight) {
    // Create a hash of the highlight text for caching
    const text = highlight.text.substring(0, 100); // Limit text length for key
    return `${text}_${highlight.url}_${highlight.title}`.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
  }

  async performSummarizeRequest(highlight, cacheKey) {
    // Send request to background script for secure API handling
    const requestId = this.generateRequestId();

    try {
      const response = await this.sendMessageToBackground({
        action: "summarizeHighlight",
        requestId: requestId,
        highlight: this.sanitizeHighlight(highlight),
        cacheKey: cacheKey,
      });

      if (response.success) {
        const summary = response.summary;

        // Cache the result (only non-sensitive data)
        this.summaryCache.set(cacheKey, {
          summary: summary,
          timestamp: Date.now(),
        });

        return summary;
      } else {
        throw new Error(response.error || "Background script returned error");
      }
    } catch (error) {
      console.error("Background script communication failed:", error);
      throw error;
    }
  }

  async getCachedConfig() {
    if (this.configCache) {
      return this.configCache;
    }

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

    // Cache the config
    this.configCache = config;
    return config;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeHighlight(highlight) {
    // Sanitize and validate highlight data before sending to background
    return {
      text: String(highlight.text || "").substring(0, 1000), // Limit text length
      url: String(highlight.url || "").substring(0, 500), // Limit URL length
      title: String(highlight.title || "").substring(0, 200), // Limit title length
      domain: String(highlight.domain || "").substring(0, 100), // Limit domain length
    };
  }

  async sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Background script response timeout"));
      }, 30000); // 30 second timeout

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            reject(new Error("No response from background script"));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  removePopup() {
    if (this.currentPopup) {
      // Clean up event listeners more efficiently
      const buttons = [
        this.currentPopup.querySelector("#highlight-save-btn-unique"),
        this.currentPopup.querySelector("#highlight-cancel-btn-unique"),
        this.currentPopup.querySelector("#highlight-summarize-btn-unique"),
      ];

      buttons.forEach((btn) => {
        if (btn && btn._highlightHandler) {
          // Remove both click and mousedown listeners
          btn.removeEventListener("click", btn._highlightHandler, true);
          btn.removeEventListener("mousedown", btn._highlightHandler, true);
          // Clear the stored handler reference
          btn._highlightHandler = null;
        }
        // Clean up any potential inline handlers
        if (btn) btn.onclick = null;
      });

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
      // Use improved range recreation with validation
      const range = this.createValidRangeFromData(this.pendingHighlight.range);

      if (!range) {
        // Fallback to text-based marking
        this.markTextByContent(this.pendingHighlight.text, highlightId);
        return;
      }

      // Use a more robust method to mark text
      this.markRangeWithSpan(range, highlightId);
    } catch (error) {
      console.error("Error marking text as saved:", error);
      // Fallback: try text-based marking
      this.markTextByContent(this.pendingHighlight.text, highlightId);
    }
  }

  createValidRangeFromData(rangeData) {
    try {
      // Validate range data before creating range
      if (!this.isValidRangeData(rangeData)) {
        return null;
      }

      // Additional validation: check offset ordering for same container
      if (rangeData.startContainer === rangeData.endContainer) {
        if (rangeData.startOffset > rangeData.endOffset) {
          console.warn(
            "Invalid range: startOffset > endOffset for same container"
          );
          return null;
        }
      }

      const range = document.createRange();

      // Set start with validation
      if (this.isValidNode(rangeData.startContainer)) {
        range.setStart(rangeData.startContainer, rangeData.startOffset);
      } else {
        return null;
      }

      // Set end with validation
      if (this.isValidNode(rangeData.endContainer)) {
        range.setEnd(rangeData.endContainer, rangeData.endOffset);
      } else {
        return null;
      }

      // Validate the created range
      if (range.collapsed) {
        return null;
      }

      return range;
    } catch (error) {
      console.error("Error creating range from data:", error);
      return null;
    }
  }

  isValidRangeData(rangeData) {
    return (
      rangeData &&
      rangeData.startContainer &&
      rangeData.endContainer &&
      typeof rangeData.startOffset === "number" &&
      typeof rangeData.endOffset === "number" &&
      rangeData.startOffset >= 0 &&
      rangeData.endOffset >= 0
    );
  }

  isValidNode(node) {
    return node && node.nodeType && node.parentNode && document.contains(node);
  }

  markTextByContent(text, highlightId) {
    // Fallback method: find text by content and mark it
    const textNodes = this.findTextNodesOptimized(text);

    if (textNodes.length === 0) {
      return;
    }

    // Find the best matching text node using context information
    const bestNode = this.findBestTextNode(textNodes, text);

    if (bestNode) {
      const content = bestNode.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        this.markTextInNode(bestNode, text, index, {
          id: highlightId,
          text: text,
        });
      }
    }
  }

  findBestTextNode(textNodes, text) {
    if (textNodes.length === 1) {
      return textNodes[0];
    }

    // If we have pending highlight data, use it to find the best match
    if (this.pendingHighlight && this.pendingHighlight.surroundingText) {
      return this.findNodeByContext(textNodes, text);
    }

    // If we have position data, use it to find the closest match
    if (this.pendingHighlight && this.pendingHighlight.textPosition) {
      return this.findNodeByPosition(textNodes, text);
    }

    // Fallback: return the first node that contains the exact text
    return (
      textNodes.find((node) => {
        const content = node.textContent;
        return content.includes(text);
      }) || textNodes[0]
    );
  }

  findNodeByContext(textNodes, text) {
    const surroundingText = this.pendingHighlight.surroundingText;
    let bestNode = null;
    let bestScore = 0;

    textNodes.forEach((node) => {
      const content = node.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        // Get surrounding context from this node
        const nodeContext = this.getNodeContext(node, index, text.length);

        // Calculate similarity score with the original surrounding text
        const score = this.calculateContextSimilarity(
          surroundingText,
          nodeContext
        );

        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }
    });

    return bestNode || textNodes[0];
  }

  findNodeByPosition(textNodes, text) {
    const targetPosition = this.pendingHighlight.textPosition;
    let bestNode = null;
    let bestDistance = Infinity;

    textNodes.forEach((node) => {
      const content = node.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        try {
          // Create a temporary range to get position
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);

          const rect = range.getBoundingClientRect();
          const nodePosition = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
          };

          // Calculate distance from target position
          const distance = Math.sqrt(
            Math.pow(nodePosition.top - targetPosition.top, 2) +
              Math.pow(nodePosition.left - targetPosition.left, 2)
          );

          if (distance < bestDistance) {
            bestDistance = distance;
            bestNode = node;
          }
        } catch (error) {
          // If range creation fails, continue with next node
          console.warn("Failed to get position for text node:", error);
        }
      }
    });

    return bestNode || textNodes[0];
  }

  getNodeContext(node, textIndex, textLength) {
    const content = node.textContent;
    const start = Math.max(0, textIndex - 50);
    const end = Math.min(content.length, textIndex + textLength + 50);
    return content.substring(start, end);
  }

  calculateContextSimilarity(originalContext, nodeContext) {
    // Simple similarity calculation based on common words
    const originalWords = originalContext.toLowerCase().split(/\s+/);
    const nodeWords = nodeContext.toLowerCase().split(/\s+/);

    let commonWords = 0;
    originalWords.forEach((word) => {
      if (nodeWords.includes(word)) {
        commonWords++;
      }
    });

    return commonWords / Math.max(originalWords.length, nodeWords.length);
  }

  markRangeWithSpan(range, highlightId) {
    try {
      // Validate range before attempting to mark
      if (!this.isValidRangeForMarking(range)) {
        throw new Error("Invalid range for marking");
      }

      // Create span without text content to avoid duplication
      const span = this.createHighlightSpan({
        id: highlightId,
        text: "", // Empty text to prevent duplication
      });

      // Let DOM move the original nodes into the span
      range.surroundContents(span);

      // Set attributes after the DOM manipulation
      span.title = "Saved highlight - Click to view in extension";

      this.savedHighlights.set(highlightId, span);
    } catch (rangeError) {
      console.warn("surroundContents failed, trying fallback:", rangeError);
      // Fallback: manually extract and wrap content
      this.markRangeWithFallback(range, highlightId);
    }
  }

  isValidRangeForMarking(range) {
    try {
      return (
        range &&
        !range.collapsed &&
        range.startContainer &&
        range.endContainer &&
        range.startContainer.parentNode &&
        range.endContainer.parentNode &&
        document.contains(range.startContainer) &&
        document.contains(range.endContainer)
      );
    } catch (error) {
      return false;
    }
  }

  markRangeWithFallback(range, highlightId) {
    try {
      // Validate range before fallback
      if (!this.isValidRangeForMarking(range)) {
        throw new Error("Range invalid for fallback marking");
      }

      // Extract the content from the range
      const contents = range.extractContents();
      const textContent = range.toString();

      // Create the span wrapper
      const span = this.createHighlightSpan({
        id: highlightId,
        text: textContent,
      });

      // Put the extracted content into the span
      span.appendChild(contents);

      // Insert the span at the start of the range
      range.insertNode(span);

      // Collapse the range to remove the selection
      range.collapse(true);

      this.savedHighlights.set(highlightId, span);
    } catch (fallbackError) {
      console.error("Fallback marking also failed:", fallbackError);
      // Last resort: try text-based marking
      const textContent = range.toString();
      if (textContent) {
        this.markTextByContent(textContent, highlightId);
      } else {
        // Clear the selection as final fallback
        const selection = window.getSelection();
        selection.removeAllRanges();
      }
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
      // Use cached DOM elements for better performance
      this.updateDomCache();

      // Batch DOM operations for existing highlights removal
      this.removeExistingHighlightsBatch();
      this.savedHighlights.clear();

      // Mark highlights for current page
      const currentUrl = window.location.href;
      const pageHighlights = this.savedHighlightsData.filter(
        (h) => h.url === currentUrl
      );

      // Process highlights in chunks to avoid blocking the UI
      this.processHighlightsInChunks(pageHighlights);
    } catch (error) {
      console.error("Error marking existing highlights:", error);
    }
  }

  updateDomCache() {
    const now = Date.now();
    if (now - this.domCache.lastCacheTime > this.cacheValidityDuration) {
      this.domCache.body = document.body;
      this.domCache.existingHighlights = document.querySelectorAll(
        ".highlight-saver-saved"
      );
      this.domCache.lastCacheTime = now;
    }
  }

  removeExistingHighlightsBatch() {
    if (!this.domCache.existingHighlights) {
      this.domCache.existingHighlights = document.querySelectorAll(
        ".highlight-saver-saved"
      );
    }

    // Create a document fragment for batch operations
    const textNodes = [];

    // Collect all text nodes to be created
    this.domCache.existingHighlights.forEach((el) => {
      if (el && el.parentNode) {
        const textNode = document.createTextNode(el.textContent);
        textNodes.push({ element: el, textNode: textNode });
      }
    });

    // Batch replace elements with text nodes
    textNodes.forEach(({ element, textNode }) => {
      if (element.parentNode) {
        element.parentNode.replaceChild(textNode, element);
      }
    });

    // Normalize parent nodes in batches
    const parentsToNormalize = new Set();
    textNodes.forEach(({ element }) => {
      if (element.parentNode) {
        parentsToNormalize.add(element.parentNode);
      }
    });

    parentsToNormalize.forEach((parent) => {
      parent.normalize();
    });
  }

  processHighlightsInChunks(highlights, chunkSize = 5) {
    if (highlights.length === 0) return;

    let currentIndex = 0;

    const processChunk = () => {
      const chunk = highlights.slice(currentIndex, currentIndex + chunkSize);

      chunk.forEach((highlight) => {
        this.findAndMarkTextOptimized(highlight);
      });

      currentIndex += chunkSize;

      if (currentIndex < highlights.length) {
        // Use requestIdleCallback if available, otherwise setTimeout
        if (window.requestIdleCallback) {
          requestIdleCallback(processChunk, { timeout: 100 });
        } else {
          setTimeout(processChunk, 10);
        }
      }
    };

    processChunk();
  }

  findAndMarkText(highlight) {
    // Use optimized version for better performance
    this.findAndMarkTextOptimized(highlight);
  }

  findAndMarkTextOptimized(highlight) {
    const text = highlight.text;

    // Check cache first
    const cacheKey = `${text}_${window.location.href}`;
    if (this.textNodeCache.has(cacheKey)) {
      const cachedNodes = this.textNodeCache.get(cacheKey);
      this.markTextInNodes(cachedNodes, highlight);
      return;
    }

    // Use more efficient text search with early termination
    const textNodes = this.findTextNodesOptimized(text);

    // Cache the results
    this.textNodeCache.set(cacheKey, textNodes);

    // Mark text in found nodes
    this.markTextInNodes(textNodes, highlight);
  }

  findTextNodesOptimized(searchText) {
    const textNodes = [];
    const searchLength = searchText.length;

    // Use a more efficient search strategy
    if (searchLength < 3) {
      // For short text, use TreeWalker but with early termination
      const walker = document.createTreeWalker(
        this.domCache.body || document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip nodes that are too short
            if (node.textContent.length < searchLength) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
        false
      );

      let node;
      let foundCount = 0;
      const maxMatches = 10; // Limit matches for performance

      while ((node = walker.nextNode()) && foundCount < maxMatches) {
        if (node.textContent.includes(searchText)) {
          textNodes.push(node);
          foundCount++;
        }
      }
    } else {
      // For longer text, use more targeted search
      const allTextNodes = this.getAllTextNodes();

      // Use binary search-like approach for large text nodes
      for (const textNode of allTextNodes) {
        if (textNode.textContent.includes(searchText)) {
          textNodes.push(textNode);
          if (textNodes.length >= 5) break; // Limit results
        }
      }
    }

    return textNodes;
  }

  getAllTextNodes() {
    // Cache all text nodes for repeated searches
    const cacheKey = "all_text_nodes";
    const now = Date.now();

    if (this.textNodeCache.has(cacheKey)) {
      const cached = this.textNodeCache.get(cacheKey);
      if (now - cached.timestamp < this.cacheValidityDuration) {
        return cached.nodes;
      }
    }

    const textNodes = [];
    const walker = document.createTreeWalker(
      this.domCache.body || document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip very short text nodes and whitespace-only nodes
          const trimmed = node.textContent.trim();
          if (trimmed.length < 2) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    // Cache the results
    this.textNodeCache.set(cacheKey, {
      nodes: textNodes,
      timestamp: now,
    });

    return textNodes;
  }

  markTextInNodes(textNodes, highlight) {
    const text = highlight.text;

    textNodes.forEach((textNode) => {
      const content = textNode.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        // Use more efficient DOM manipulation
        this.markTextInNode(textNode, text, index, highlight);
      }
    });
  }

  markTextInNode(textNode, text, index, highlight) {
    const content = textNode.textContent;
    const before = content.substring(0, index);
    const after = content.substring(index + text.length);

    // Create span element with optimized styling
    const span = this.createHighlightSpan(highlight);

    const parent = textNode.parentNode;

    // Use more efficient DOM operations
    if (before) {
      const beforeNode = document.createTextNode(before);
      parent.insertBefore(beforeNode, textNode);
    }

    parent.insertBefore(span, textNode.nextSibling);

    if (after) {
      const afterNode = document.createTextNode(after);
      parent.insertBefore(afterNode, span.nextSibling);
    }

    // Remove the original text node
    parent.removeChild(textNode);

    this.savedHighlights.set(highlight.id, span);
  }

  createHighlightSpan(highlight) {
    const span = document.createElement("span");
    span.className = "highlight-saver-saved";
    span.dataset.highlightId = highlight.id;

    // Only set textContent if text is provided and not empty
    if (highlight.text && highlight.text.trim() !== "") {
      span.textContent = highlight.text;
    }

    span.title = "Saved highlight - Click to view in extension";

    // Use CSS classes instead of inline styles for better performance
    span.style.cssText =
      "background-color: #ffff99; padding: 1px 2px; border-radius: 2px;";

    return span;
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
      // Use cached text nodes for better performance
      const textNodes = this.findTextNodesOptimized(text);

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
      highlight.className = "highlight-saver-temporary-highlight";
      Object.assign(highlight.style, {
        backgroundColor: "rgba(255, 255, 0, 0.3)",
        border: "2px solid #fbbf24",
        borderRadius: "2px",
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

  // Memory management methods
  startMemoryCleanup() {
    // Clear existing interval if any
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 120000); // 2 minutes
  }

  performMemoryCleanup() {
    const now = Date.now();

    // Clean up expired caches
    this.cleanupExpiredCaches(now);

    // Limit cache sizes
    this.limitCacheSizes();

    // Clear old DOM references
    this.cleanupDomReferences();

    // Update memory usage tracking
    this.memoryUsage.lastCleanup = now;
    this.memoryUsage.cacheSize =
      this.textNodeCache.size + this.summaryCache.size;

    // Force garbage collection hint (if available)
    if (window.gc) {
      window.gc();
    }
  }

  cleanupExpiredCaches(now) {
    // Clean up expired text node caches
    for (const [key, value] of this.textNodeCache.entries()) {
      if (
        value.timestamp &&
        now - value.timestamp > this.cacheValidityDuration
      ) {
        this.textNodeCache.delete(key);
      }
    }

    // Clean up expired summary caches
    for (const [key, value] of this.summaryCache.entries()) {
      if (value.timestamp && now - value.timestamp > 300000) {
        // 5 minutes for summaries
        this.summaryCache.delete(key);
      }
    }

    // Clear old DOM cache if expired
    if (now - this.domCache.lastCacheTime > this.cacheValidityDuration) {
      this.domCache.body = null;
      this.domCache.existingHighlights = null;
    }
  }

  limitCacheSizes() {
    // Limit text node cache size using O(n) approach
    this.limitCacheSize(this.textNodeCache, this.maxTextNodesCache);

    // Limit summary cache size using O(n) approach
    this.limitCacheSize(this.summaryCache, this.maxSummaryCacheSize);
  }

  limitCacheSize(cache, maxSize) {
    if (cache.size <= maxSize) {
      return;
    }

    const entriesToDelete = cache.size - maxSize;
    const oldestEntries = this.findOldestEntries(cache, entriesToDelete);

    // Delete the oldest entries
    oldestEntries.forEach((key) => {
      cache.delete(key);
    });
  }

  findOldestEntries(cache, count) {
    const oldestKeys = [];
    let oldestTimestamp = Infinity;

    // First pass: find the oldest timestamp
    for (const [key, value] of cache.entries()) {
      const timestamp = value.timestamp || 0;
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
      }
    }

    // Second pass: collect all entries with the oldest timestamp
    for (const [key, value] of cache.entries()) {
      const timestamp = value.timestamp || 0;
      if (timestamp === oldestTimestamp) {
        oldestKeys.push(key);
        if (oldestKeys.length >= count) {
          break; // We have enough entries to delete
        }
      }
    }

    // If we still need more entries, find the next oldest timestamp
    if (oldestKeys.length < count) {
      let nextOldestTimestamp = Infinity;

      // Find the next oldest timestamp
      for (const [key, value] of cache.entries()) {
        const timestamp = value.timestamp || 0;
        if (timestamp > oldestTimestamp && timestamp < nextOldestTimestamp) {
          nextOldestTimestamp = timestamp;
        }
      }

      // Collect entries with the next oldest timestamp
      for (const [key, value] of cache.entries()) {
        const timestamp = value.timestamp || 0;
        if (timestamp === nextOldestTimestamp) {
          oldestKeys.push(key);
          if (oldestKeys.length >= count) {
            break;
          }
        }
      }
    }

    return oldestKeys.slice(0, count);
  }

  cleanupDomReferences() {
    // Clear weak references to DOM elements
    this.savedHighlights.forEach((element, id) => {
      if (!element || !element.parentNode) {
        this.savedHighlights.delete(id);
      }
    });
  }

  // Cleanup method for proper event handler and timeout cleanup
  cleanup() {
    // Clear any pending selection timeout
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
      this.selectionTimeout = null;
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Remove popup if exists
    this.removePopup();

    // Clear pending highlight data
    this.pendingHighlight = null;

    // Clear saved highlights map
    this.savedHighlights.clear();

    // Clear all caches
    this.textNodeCache.clear();
    this.summaryCache.clear();
    this.apiRequestQueue.clear();

    this.domCache = {
      body: null,
      existingHighlights: null,
      lastCacheTime: 0,
    };
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
