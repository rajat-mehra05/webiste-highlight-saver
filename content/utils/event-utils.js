// Event handling and throttling utilities
// Used by content script for optimized event management

class EventUtils {
  constructor() {
    this.selectionTimeout = null;
    this.lastSelectionTime = 0;
    this.selectionThrottleDelay = 150; // 150ms debounce
    this.minSelectionInterval = 100; // 100ms throttle
  }

  /**
   * Create debounced event handler for text selection
   */
  createDebouncedSelectionHandler(callback) {
    return (event) => {
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
        callback(event);
        this.lastSelectionTime = Date.now();
      }, this.selectionThrottleDelay);
    };
  }

  /**
   * Create outside click handler for popup management
   */
  createOutsideClickHandler(uiUtils) {
    return (event) => {
      if (uiUtils.isOutsideClick(event)) {
        uiUtils.removePopup();
      }
    };
  }

  /**
   * Create visibility change handler
   */
  createVisibilityChangeHandler(callback) {
    return () => {
      if (!document.hidden) {
        callback();
      }
    };
  }

  /**
   * Create URL fragment handler for scroll-to functionality
   */
  createUrlFragmentHandler(callback) {
    return () => {
      callback();
    };
  }

  /**
   * Create cleanup handler for page unload events
   */
  createCleanupHandler(callback) {
    return () => {
      callback();
    };
  }

  /**
   * Bind all necessary events for the highlight saver
   */
  bindHighlightEvents(handlers) {
    const {
      onTextSelection,
      onOutsideClick,
      onVisibilityChange,
      onUrlFragment,
      onCleanup,
      onMessage,
    } = handlers;

    // Text selection events with debouncing
    const debouncedSelection =
      this.createDebouncedSelectionHandler(onTextSelection);
    document.addEventListener("mouseup", debouncedSelection, { passive: true });
    document.addEventListener("keyup", debouncedSelection, { passive: true });

    // Outside click handler
    if (onOutsideClick) {
      document.addEventListener("click", onOutsideClick, true);
    }

    // Visibility change handler
    if (onVisibilityChange) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    // URL fragment handling
    if (onUrlFragment) {
      onUrlFragment(); // Handle current fragment
      window.addEventListener("hashchange", onUrlFragment);
    }

    // Cleanup handlers for multiple unload events
    if (onCleanup) {
      const cleanupHandler = this.createCleanupHandler(onCleanup);
      window.addEventListener("beforeunload", cleanupHandler);
      window.addEventListener("pagehide", cleanupHandler);
      window.addEventListener("unload", cleanupHandler);
    }

    // Chrome extension message listener
    if (onMessage && typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(onMessage);
    }
  }

  /**
   * Handle text selection with validation
   */
  handleTextSelection(event, callback) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Validate selection
    if (selectedText.length > 0 && selectedText.length < 1000) {
      callback(selection, selectedText, event);
    } else if (selectedText.length === 0) {
      // Handle empty selection
      callback(null, "", event);
    }
  }

  /**
   * Clear selection timeout
   */
  clearSelectionTimeout() {
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
      this.selectionTimeout = null;
    }
  }

  /**
   * Process highlights in chunks to avoid blocking UI
   */
  processInChunks(items, processor, chunkSize = 5) {
    if (items.length === 0) return;

    let currentIndex = 0;

    const processChunk = () => {
      const chunk = items.slice(currentIndex, currentIndex + chunkSize);

      chunk.forEach((item) => {
        processor(item);
      });

      currentIndex += chunkSize;

      if (currentIndex < items.length) {
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

  /**
   * Scroll to text with smooth animation
   */
  scrollToText(textNodes, text, callback) {
    if (textNodes.length === 0) return false;

    // Find the best match
    let bestMatch = textNodes[0];
    let bestScore = 0;

    textNodes.forEach((textNode) => {
      const content = textNode.textContent;
      const index = content.indexOf(text);
      if (index !== -1) {
        const score = text.length / content.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = textNode;
        }
      }
    });

    // Create range and scroll to it
    try {
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

      // Execute callback with range for highlighting after scroll settles
      if (callback) {
        // Wait for smooth scroll to finish before highlighting
        setTimeout(() => {
          callback(range, text);
        }, 300);
      }

      return true;
    } catch (error) {
      console.error("Failed to scroll to text:", error);
      return false;
    }
  }

  /**
   * Handle URL fragment with retry logic
   */
  handleUrlFragmentWithRetry(callback, maxAttempts = 5) {
    const hash = window.location.hash;
    if (!hash || !hash.includes("highlight=")) return;

    const params = new URLSearchParams(hash.substring(1));
    const highlightText = params.get("highlight");
    const positionData = params.get("pos");

    if (!highlightText) return;

    let attempts = 0;

    const tryScroll = () => {
      attempts++;
      if (document.body && document.body.textContent.includes(highlightText)) {
        callback(highlightText, positionData);
      } else if (attempts < maxAttempts) {
        setTimeout(tryScroll, 500);
      }
    };

    setTimeout(tryScroll, 500);
  }

  /**
   * Create Chrome extension message handler
   */
  createMessageHandler(handlers) {
    return (message, sender, sendResponse) => {
      if (message.action === "cleanup" && handlers.cleanup) {
        handlers.cleanup();
        sendResponse({ success: true });
      }
      // Add more message handlers as needed
    };
  }

  /**
   * Cleanup event handlers
   */
  cleanup() {
    this.clearSelectionTimeout();

    // Note: We don't remove event listeners here because they're bound
    // to the document/window and will be cleaned up when the page unloads
    // Individual handlers should clean up their own specific listeners
  }
}

// Make EventUtils globally available
window.EventUtils = EventUtils;
