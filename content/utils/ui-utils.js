// UI and popup management utilities
// Used by content script for creating and managing UI elements

class UIUtils {
  constructor() {
    this.currentPopup = null;
  }

  /**
   * Show save popup with buttons
   */
  showSavePopup(selectedText, event, handlers) {
    // Create popup element
    const popup = document.createElement("div");
    popup.id = "highlight-saver-popup-unique";
    popup.className = "highlight-saver-popup";

    // Position popup below the highlighted text
    this.positionPopup(popup);

    // Create and add buttons
    this.addPopupButtons(popup, handlers);

    document.body.appendChild(popup);
    this.currentPopup = popup;

    // Auto-remove after 10 seconds as failsafe
    setTimeout(() => {
      if (this.currentPopup === popup) {
        this.removePopup();
      }
    }, 10000);
  }

  /**
   * Position popup relative to text selection
   */
  positionPopup(popup) {
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
  }

  /**
   * Add buttons to popup with event handlers
   */
  addPopupButtons(popup, handlers) {
    // Create save button
    const saveButton = this.createButton({
      id: "highlight-save-btn-unique",
      text: "Save",
      className: "highlight-save-btn",
      handler: handlers.save,
    });

    // Create cancel button
    const cancelButton = this.createButton({
      id: "highlight-cancel-btn-unique",
      text: "Cancel",
      className: "highlight-cancel-btn",
      handler: handlers.cancel,
    });

    // Create summarize button
    const summarizeButton = this.createButton({
      id: "highlight-summarize-btn-unique",
      text: "Summarize",
      className: "highlight-summarize-btn",
      handler: handlers.summarize,
    });

    // Assemble popup with 3 buttons
    popup.appendChild(summarizeButton);
    popup.appendChild(saveButton);
    popup.appendChild(cancelButton);
  }

  /**
   * Create button with event handlers
   */
  createButton({ id, text, className, handler }) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    button.className = className;

    const eventHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handler();
    };

    // Add event listeners for better compatibility
    button.addEventListener("click", eventHandler, true);
    button.addEventListener("mousedown", eventHandler, true);

    // Store handler for cleanup
    button._highlightHandler = eventHandler;

    return button;
  }

  /**
   * Show summary popup
   */
  showSummaryPopup(summary) {
    this.removePopup();

    const summaryPopup = document.createElement("div");
    summaryPopup.id = "highlight-summary-popup-unique";
    summaryPopup.className = "highlight-saver-popup highlight-summary-popup";

    // Position it in the same location as the original popup
    this.positionSummaryPopup(summaryPopup);

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

  /**
   * Position summary popup
   */
  positionSummaryPopup(summaryPopup) {
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
  }

  /**
   * Remove current popup
   */
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

  /**
   * Show feedback message
   */
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

  /**
   * Show success feedback
   */
  showSuccessFeedback() {
    this.showFeedback("Highlight saved!", "#10b981");
  }

  /**
   * Show error feedback
   */
  showErrorFeedback(message = "Failed to save highlight") {
    this.showFeedback(message, "#ef4444");
  }

  /**
   * Update button state (for loading states)
   */
  updateButtonState(buttonId, text, disabled = false) {
    const button = this.currentPopup?.querySelector(`#${buttonId}`);
    if (button) {
      button.disabled = disabled;
      button.textContent = text;
    }
  }

  /**
   * Create temporary highlight overlay for scroll-to functionality
   */
  temporarilyHighlightText(range, text) {
    try {
      // Create a temporary highlight overlay
      const highlight = document.createElement("div");
      highlight.className = "highlight-saver-temporary-highlight";
      Object.assign(highlight.style, {
        backgroundColor: "rgba(255, 255, 0, 0.3)",
        border: "2px solid #fbbf24",
        borderRadius: "2px",
        position: "absolute",
        zIndex: "2147483645",
        pointerEvents: "none",
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

  /**
   * Create enhanced temporary highlight for saved highlights with animation
   */
  temporarilyHighlightSavedText(range, text, duration = 4000) {
    try {
      // Remove any existing temporary highlights and feedback overlays first
      const existingHighlights = document.querySelectorAll(
        ".highlight-saver-temporary-saved, .highlight-saver-instant-feedback"
      );
      existingHighlights.forEach((el) => el.remove());

      console.log("Creating temporary highlight for saved text:", text);

      // Also create an immediate simple overlay for instant feedback
      this.createInstantFeedbackOverlay(text);

      // Wait a bit for any smooth scrolling to settle, then create highlight
      // Using longer timeout to ensure scroll animation completes
      setTimeout(() => {
        try {
          // Get fresh bounding rect after scroll
          const rect = range.getBoundingClientRect();

          console.log("Range rect:", rect);
          console.log("Viewport height:", window.innerHeight);
          console.log("Scroll position:", window.scrollY);

          // Check if the range is actually visible
          if (rect.width === 0 || rect.height === 0) {
            console.warn(
              "Range has no dimensions, trying alternative highlighting"
            );
            this.createFallbackHighlight(text, duration);
            return;
          }

          // Create a more prominent temporary highlight overlay for saved highlights
          const highlight = document.createElement("div");
          highlight.className = "highlight-saver-temporary-saved";

          // Position the highlight with extra padding for visibility
          Object.assign(highlight.style, {
            position: "absolute",
            top: `${rect.top + window.scrollY - 2}px`,
            left: `${rect.left + window.scrollX - 2}px`,
            width: `${rect.width + 4}px`,
            height: `${rect.height + 4}px`,
            backgroundColor: "rgba(34, 197, 94, 0.4)", // Green background
            border: "3px solid #22c55e",
            borderRadius: "4px",
            zIndex: "2147483645",
            pointerEvents: "none",
            boxShadow: "0 0 20px rgba(34, 197, 94, 0.5)",
            animation: "highlight-pulse 2s ease-in-out infinite",
            transition: "all 0.3s ease-in-out",
          });

          document.body.appendChild(highlight);
          console.log("Highlight element added to DOM");

          // Add pulsing effect
          let pulseCount = 0;
          const pulseInterval = setInterval(() => {
            pulseCount++;
            if (pulseCount <= 3) {
              highlight.style.backgroundColor =
                pulseCount % 2 === 0
                  ? "rgba(34, 197, 94, 0.6)"
                  : "rgba(34, 197, 94, 0.3)";
              highlight.style.boxShadow =
                pulseCount % 2 === 0
                  ? "0 0 30px rgba(34, 197, 94, 0.8)"
                  : "0 0 10px rgba(34, 197, 94, 0.4)";
            } else {
              clearInterval(pulseInterval);
            }
          }, 500);

          // Fade out and remove after duration
          setTimeout(() => {
            if (highlight.parentNode) {
              highlight.style.opacity = "0";
              highlight.style.transform = "scale(0.95)";
              setTimeout(() => {
                if (highlight.parentNode) {
                  highlight.remove();
                }
              }, 300);
            }
            clearInterval(pulseInterval);
          }, duration);
        } catch (innerError) {
          console.error("Error in delayed highlight creation:", innerError);
          this.createFallbackHighlight(text, duration);
        }
      }, 500); // Wait 500ms for scroll to settle completely
    } catch (error) {
      console.error("Failed to create temporary saved highlight:", error);
      this.createFallbackHighlight(text, duration);
    }
  }

  /**
   * Fallback highlighting method when range-based highlighting fails
   */
  createFallbackHighlight(text, duration = 4000) {
    try {
      console.log("Using fallback highlighting for:", text);

      // Find all text nodes containing the target text
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        if (textNode.textContent.includes(text)) {
          const parent = textNode.parentElement;
          if (parent && parent.getBoundingClientRect) {
            const rect = parent.getBoundingClientRect();

            // Create highlight overlay
            const highlight = document.createElement("div");
            highlight.className = "highlight-saver-temporary-saved fallback";

            Object.assign(highlight.style, {
              position: "absolute",
              top: `${rect.top + window.scrollY - 5}px`,
              left: `${rect.left + window.scrollX - 5}px`,
              width: `${rect.width + 10}px`,
              height: `${rect.height + 10}px`,
              backgroundColor: "rgba(34, 197, 94, 0.5)",
              border: "4px solid #22c55e",
              borderRadius: "6px",
              zIndex: "2147483645",
              pointerEvents: "none",
              boxShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
              animation: "savedHighlightAppear 0.5s ease-out forwards",
            });

            document.body.appendChild(highlight);
            console.log("Fallback highlight created");

            // Remove after duration
            setTimeout(() => {
              if (highlight.parentNode) {
                highlight.style.opacity = "0";
                setTimeout(() => {
                  if (highlight.parentNode) {
                    highlight.remove();
                  }
                }, 300);
              }
            }, duration);

            break; // Only highlight the first match
          }
        }
      }
    } catch (error) {
      console.error("Fallback highlighting also failed:", error);
    }
  }

  /**
   * Create instant feedback overlay while preparing the main highlight
   */
  createInstantFeedbackOverlay(text) {
    try {
      // Create a visible notification in the viewport
      const overlay = document.createElement("div");
      overlay.className = "highlight-saver-instant-feedback";

      Object.assign(overlay.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        backgroundColor: "rgba(34, 197, 94, 0.9)",
        color: "white",
        padding: "12px 16px",
        borderRadius: "8px",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontWeight: "bold",
        zIndex: "2147483647",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        animation: "savedHighlightAppear 0.3s ease-out forwards",
        maxWidth: "300px",
        wordWrap: "break-word",
      });

      overlay.innerHTML = `
        <div style="margin-bottom: 4px;">🎯 Navigating to highlight...</div>
        <div style="font-size: 12px; opacity: 0.9;">"${
          text.length > 50 ? text.substring(0, 50) + "..." : text
        }"</div>
        <div style="font-size: 10px; margin-top: 4px; opacity: 0.7;">Looking for text overlay...</div>
      `;

      document.body.appendChild(overlay);

      // Remove after 3 seconds
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.style.opacity = "0";
          setTimeout(() => {
            if (overlay.parentNode) {
              overlay.remove();
            }
          }, 300);
        }
      }, 3000);
    } catch (error) {
      console.error("Failed to create instant feedback overlay:", error);
    }
  }

  /**
   * Check if click is outside popup
   */
  isOutsideClick(event) {
    return this.currentPopup && !this.currentPopup.contains(event.target);
  }

  /**
   * Get current popup reference
   */
  getCurrentPopup() {
    return this.currentPopup;
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.removePopup();
    this.currentPopup = null;
  }
}

// Make UIUtils globally available
window.UIUtils = UIUtils;
