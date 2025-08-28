// Content script for text highlighting functionality
// Refactored to use modular utilities

class HighlightSaver {
  constructor() {
    // Initialize utility classes
    this.cacheManager = new CacheManager();
    this.domUtils = new DOMUtils();
    this.rangeUtils = new RangeUtils();
    this.eventUtils = new EventUtils();
    this.uiUtils = new UIUtils();
    this.storageUtils = new StorageUtils();
    this.aiUtils = new AIUtils(this.cacheManager, this.storageUtils);

    // State management
    this.savedHighlights = new Map();
    this.pendingHighlight = null;
    this.savedHighlightsData = [];

    this.init();
  }

  async init() {
    try {
      this.bindEvents();

      // Check if we're in a valid context for Chrome extension
      if (this.storageUtils.isChromeExtensionContext()) {
        await this.loadSavedHighlights();
        this.markExistingHighlights();
      } else {
        console.warn(
          "Chrome extension APIs not available, running in limited mode"
        );
        this.savedHighlightsData = [];
      }

      // Start periodic memory cleanup
      this.cacheManager.startMemoryCleanup();
    } catch (error) {
      console.error("Error during initialization:", error);
      this.savedHighlightsData = [];
    }
  }

  bindEvents() {
    // Create event handlers
    const handlers = {
      onTextSelection: (event) => this.handleTextSelection(event),
      onOutsideClick: this.eventUtils.createOutsideClickHandler(this.uiUtils),
      onVisibilityChange: this.eventUtils.createVisibilityChangeHandler(() => {
        this.markExistingHighlights();
      }),
      onUrlFragment: () => this.handleUrlFragment(),
      onCleanup: () => this.cleanup(),
      onMessage: this.eventUtils.createMessageHandler({
        cleanup: () => this.cleanup(),
      }),
    };

    // Bind all events using EventUtils
    this.eventUtils.bindHighlightEvents(handlers);
  }

  handleTextSelection(event) {
    this.eventUtils.handleTextSelection(
      event,
      (selection, selectedText, event) => {
        // Remove existing popup
        this.uiUtils.removePopup();

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
    );
  }

  storeSelectionData(selection, selectedText) {
    const pageInfo = this.storageUtils.getPageInfo();
    const selectionData = this.rangeUtils.storeSelectionData(
      selection,
      selectedText
    );

    this.pendingHighlight = {
      ...selectionData,
      pageInfo: pageInfo,
    };
  }

  showSavePopup(selectedText, event) {
    const handlers = {
      save: () => this.handleSaveClick(),
      cancel: () => this.handleCancelClick(),
      summarize: () => this.handleSummarizeClick(),
    };

    this.uiUtils.showSavePopup(selectedText, event, handlers);
  }

  handleSaveClick() {
    if (this.pendingHighlight) {
      this.saveHighlightFromPending();
    } else {
      console.error("No pending highlight data to save");
      this.uiUtils.showErrorFeedback("No highlight data found");
    }
  }

  handleCancelClick() {
    this.pendingHighlight = null;
    this.uiUtils.removePopup();

    // Clear text selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  async handleSummarizeClick() {
    await this.aiUtils.handleSummarizeRequest(
      this.pendingHighlight,
      this.uiUtils
    );
  }

  async saveHighlightFromPending() {
    if (!this.pendingHighlight) {
      console.error("No pending highlight data");
      this.uiUtils.showErrorFeedback("No highlight data found");
      return;
    }

    try {
      // Create highlight object from stored data
      const highlight = this.storageUtils.createHighlightObject(
        this.pendingHighlight
      );

      // Save to storage
      const result = await this.storageUtils.saveHighlight(highlight);

      if (result && result.success) {
        // Mark text as saved using stored range data
        this.markTextAsSavedFromPending(highlight.id);

        // Clear pending data and selection
        this.pendingHighlight = null;
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }

        // Remove popup and show success
        this.uiUtils.removePopup();
        this.uiUtils.showSuccessFeedback();
      } else {
        throw new Error(result?.error || "Unknown storage error");
      }
    } catch (error) {
      console.error("Failed to save highlight:", error);
      this.uiUtils.showErrorFeedback("Failed to save: " + error.message);
    }
  }

  markTextAsSavedFromPending(highlightId) {
    if (!this.pendingHighlight || !this.pendingHighlight.range) {
      console.error("No pending range data to mark");
      return;
    }

    try {
      // Use RangeUtils to recreate and mark the range
      const range = this.rangeUtils.createValidRangeFromData(
        this.pendingHighlight.range
      );

      if (!range) {
        // Fallback to text-based marking
        this.markTextByContent(this.pendingHighlight.text, highlightId);
        return;
      }

      // Mark the range with a span
      const span = this.rangeUtils.markRangeWithSpan(
        range,
        highlightId,
        this.domUtils
      );
      if (span) {
        this.savedHighlights.set(highlightId, span);
      }
    } catch (error) {
      console.error("Error marking text as saved:", error);
      // Fallback: try text-based marking
      this.markTextByContent(this.pendingHighlight.text, highlightId);
    }
  }

  markTextByContent(text, highlightId) {
    // Find text nodes using DOMUtils
    const textNodes = this.domUtils.findTextNodesOptimized(text);

    if (textNodes.length === 0) {
      return;
    }

    // Find the best matching text node using RangeUtils
    const bestNode = this.rangeUtils.findBestTextNode(
      textNodes,
      text,
      this.pendingHighlight?.surroundingText,
      this.pendingHighlight?.textPosition
    );

    if (bestNode) {
      const content = bestNode.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        const span = this.domUtils.markTextInNode(bestNode, text, index, {
          id: highlightId,
          text: text,
        });
        if (span) {
          this.savedHighlights.set(highlightId, span);
        }
      }
    }
  }

  async loadSavedHighlights() {
    try {
      this.savedHighlightsData = await this.storageUtils.loadHighlights();
    } catch (error) {
      console.error("Failed to load saved highlights:", error);
      this.savedHighlightsData = [];
    }
  }

  markExistingHighlights() {
    try {
      // Update DOM cache and remove existing highlights
      this.cacheManager.updateDomCache();
      this.domUtils.removeExistingHighlightsBatch();
      this.savedHighlights.clear();

      // Mark highlights for current page
      const currentUrl = window.location.href;
      const pageHighlights = this.savedHighlightsData.filter(
        (h) => h.url === currentUrl
      );

      // Process highlights in chunks using EventUtils
      this.eventUtils.processInChunks(pageHighlights, (highlight) => {
        this.findAndMarkTextOptimized(highlight);
      });
    } catch (error) {
      console.error("Error marking existing highlights:", error);
    }
  }

  findAndMarkTextOptimized(highlight) {
    const text = highlight.text;

    // Check cache first
    const cacheKey = `${text}_${window.location.href}`;
    const cachedNodes = this.cacheManager.getCachedTextNodes(cacheKey);

    if (cachedNodes) {
      this.markTextInNodes(cachedNodes, highlight);
      return;
    }

    // Find text nodes using DOMUtils
    const textNodes = this.domUtils.findTextNodesOptimized(text);

    // Cache the results
    this.cacheManager.cacheTextNodes(cacheKey, textNodes);

    // Mark text in found nodes
    this.markTextInNodes(textNodes, highlight);
  }

  markTextInNodes(textNodes, highlight) {
    const text = highlight.text;

    textNodes.forEach((textNode) => {
      const content = textNode.textContent;
      const index = content.indexOf(text);

      if (index !== -1) {
        const span = this.domUtils.markTextInNode(
          textNode,
          text,
          index,
          highlight
        );
        if (span) {
          this.savedHighlights.set(highlight.id, span);
        }
      }
    });
  }

  handleUrlFragment() {
    this.eventUtils.handleUrlFragmentWithRetry(
      (highlightText, positionData) => {
        this.scrollToAndHighlightText(highlightText, positionData);
      }
    );
  }

  scrollToAndHighlightText(text, positionData) {
    try {
      console.log("Scrolling to and highlighting text:", text);

      // Use DOMUtils to find text nodes
      const textNodes = this.domUtils.findTextNodesOptimized(text);
      console.log("Found text nodes:", textNodes.length);

      if (textNodes.length > 0) {
        // Use EventUtils to scroll to text
        const success = this.eventUtils.scrollToText(
          textNodes,
          text,
          (range, text) => {
            console.log("Scroll callback triggered, creating highlight");
            // Use UIUtils to create enhanced temporary highlight for saved highlights
            this.uiUtils.temporarilyHighlightSavedText(range, text);
          }
        );

        if (success) {
          this.uiUtils.showFeedback("Scrolled to highlighted text!", "#10b981");
        } else {
          console.warn("Scroll failed, trying fallback");
          this.tryFallbackHighlighting(text, positionData);
        }
      } else {
        console.warn("No text nodes found, trying fallback");
        this.tryFallbackHighlighting(text, positionData);
      }
    } catch (error) {
      console.error("Failed to scroll to text:", error);
      this.tryFallbackHighlighting(text, positionData);
    }
  }

  tryFallbackHighlighting(text, positionData) {
    try {
      // Create a simple text-based highlight overlay
      this.uiUtils.createInstantFeedbackOverlay(text);

      if (positionData) {
        // Try to use position data for scrolling
        try {
          const position = JSON.parse(decodeURIComponent(positionData));
          window.scrollTo({
            top: position.top - 100,
            behavior: "smooth",
          });
          this.uiUtils.showFeedback(
            "Scrolled to approximate position",
            "#f59e0b"
          );

          // Try to create a fallback highlight at the approximate position
          setTimeout(() => {
            this.createFallbackHighlightAtPosition(text, position);
          }, 500);
        } catch (e) {
          console.error("Failed to parse position data:", e);
          this.uiUtils.showFeedback(
            "Text found but couldn't scroll",
            "#ef4444"
          );
        }
      } else {
        this.uiUtils.showFeedback("Text not found on page", "#ef4444");
      }
    } catch (error) {
      console.error("Fallback highlighting failed:", error);
    }
  }

  createFallbackHighlightAtPosition(text, position) {
    try {
      // Create a simple overlay at the approximate position
      const overlay = document.createElement("div");
      overlay.className = "highlight-saver-position-fallback";

      Object.assign(overlay.style, {
        position: "absolute",
        top: `${position.top - 10}px`,
        left: `${position.left - 10}px`,
        width: `${position.width + 20}px`,
        height: `${position.height + 20}px`,
        backgroundColor: "rgba(34, 197, 94, 0.5)",
        border: "3px solid #22c55e",
        borderRadius: "6px",
        zIndex: "2147483645",
        pointerEvents: "none",
        boxShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
        animation: "savedHighlightAppear 0.5s ease-out forwards",
      });

      document.body.appendChild(overlay);

      // Add text label
      const label = document.createElement("div");
      label.textContent = `"${text.substring(0, 30)}${
        text.length > 30 ? "..." : ""
      }"`;
      Object.assign(label.style, {
        position: "absolute",
        bottom: "-30px",
        left: "0",
        backgroundColor: "rgba(34, 197, 94, 0.9)",
        color: "white",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        whiteSpace: "nowrap",
        maxWidth: "200px",
        overflow: "hidden",
      });
      overlay.appendChild(label);

      // Remove after 4 seconds
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.style.opacity = "0";
          setTimeout(() => {
            if (overlay.parentNode) {
              overlay.remove();
            }
          }, 300);
        }
      }, 4000);
    } catch (error) {
      console.error("Failed to create fallback highlight at position:", error);
    }
  }

  cleanup() {
    // Clear any pending timeouts and intervals
    this.eventUtils.cleanup();
    this.cacheManager.cleanup();
    this.uiUtils.cleanup();

    // Clear pending highlight data
    this.pendingHighlight = null;

    // Clear saved highlights map
    this.savedHighlights.clear();
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
