// AI and summarization utilities
// Used by content script for AI-powered text summarization

class AIUtils {
  constructor(cacheManager, storageUtils) {
    this.cacheManager = cacheManager;
    this.storageUtils = storageUtils;
  }

  /**
   * Perform AI summarization with caching and request deduplication
   */
  async summarizeHighlight(highlight) {
    try {
      // Generate cache key
      const cacheKey = this.cacheManager.generateSummaryCacheKey(highlight);

      // Check cache first
      const cachedSummary = this.cacheManager.getCachedSummary(cacheKey);
      if (cachedSummary) {
        return cachedSummary;
      }

      // Check if there's already a request in progress for this text
      if (this.cacheManager.isApiRequestInProgress(cacheKey)) {
        return await this.cacheManager.getApiRequestPromise(cacheKey);
      }

      // Create new request promise
      const requestPromise = this.performSummarizeRequest(highlight, cacheKey);
      this.cacheManager.setApiRequestPromise(cacheKey, requestPromise);

      try {
        const summary = await requestPromise;

        // Cache the result
        this.cacheManager.cacheSummary(cacheKey, summary);

        return summary;
      } finally {
        // Clean up the request queue
        this.cacheManager.removeApiRequestPromise(cacheKey);
      }
    } catch (error) {
      console.error("AI summarization failed:", error);
      throw error;
    }
  }

  /**
   * Perform the actual summarization request via background script
   */
  async performSummarizeRequest(highlight, cacheKey) {
    return await this.storageUtils.performSummarizeRequest(highlight, cacheKey);
  }

  /**
   * Create highlight object for AI processing
   */
  createHighlightForAI(pendingHighlight, pageInfo) {
    return {
      text: pendingHighlight.text,
      url: pageInfo.url,
      title: pageInfo.title,
      domain: pageInfo.domain,
      pageText: pendingHighlight.surroundingText,
    };
  }

  /**
   * Handle summarize button click with UI updates
   */
  async handleSummarizeRequest(pendingHighlight, uiUtils) {
    if (!pendingHighlight) {
      console.error("No pending highlight data to summarize");
      uiUtils.showErrorFeedback("No highlight data found");
      return;
    }

    try {
      // Update button state to show loading
      uiUtils.updateButtonState(
        "highlight-summarize-btn-unique",
        "Summarizing...",
        true
      );

      // Create highlight object for AI service
      const pageInfo = this.storageUtils.getPageInfo();
      const highlight = this.createHighlightForAI(pendingHighlight, pageInfo);

      // Perform summarization
      const summary = await this.summarizeHighlight(highlight);

      // Show summary in popup
      uiUtils.showSummaryPopup(summary);
    } catch (error) {
      console.error("Failed to summarize highlight:", error);
      uiUtils.showErrorFeedback("Failed to summarize: " + error.message);

      // Re-enable the summarize button
      uiUtils.updateButtonState(
        "highlight-summarize-btn-unique",
        "Summarize",
        false
      );
    }
  }

  /**
   * Validate highlight data for AI processing
   */
  validateHighlightForAI(highlight) {
    const errors = [];

    if (!highlight.text || highlight.text.trim().length === 0) {
      errors.push("Highlight text is empty");
    }

    if (highlight.text && highlight.text.length > 10000) {
      errors.push("Highlight text is too long (max 10,000 characters)");
    }

    if (!highlight.url || highlight.url.trim().length === 0) {
      errors.push("URL is missing");
    }

    if (!highlight.title || highlight.title.trim().length === 0) {
      errors.push("Page title is missing");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Pre-process highlight text for better AI summarization
   */
  preprocessHighlightText(text) {
    // Remove excessive whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Remove non-printable characters
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Truncate if too long
    if (text.length > 1000) {
      text = text.substring(0, 1000) + "...";
    }

    return text;
  }

  /**
   * Format summary response for display
   */
  formatSummaryForDisplay(summary) {
    if (!summary || typeof summary !== "string") {
      return "Unable to generate summary.";
    }

    // Clean up the summary text
    summary = summary.trim();

    // Ensure proper sentence endings
    if (summary && !summary.match(/[.!?]$/)) {
      summary += ".";
    }

    // Limit length for display
    if (summary.length > 500) {
      summary = summary.substring(0, 500) + "...";
    }

    return summary;
  }

  /**
   * Get AI service status
   */
  async getAIServiceStatus() {
    try {
      const response = await this.storageUtils.sendMessageToBackground({
        action: "checkAIServiceStatus",
      });

      return {
        available: response.available || false,
        error: response.error || null,
        model: response.model || "unknown",
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        model: "unknown",
      };
    }
  }

  /**
   * Configure AI service settings
   */
  async configureAIService(settings) {
    return await this.storageUtils.sendMessageToBackground({
      action: "configureAIService",
      settings: settings,
    });
  }

  /**
   * Get AI usage statistics
   */
  async getAIUsageStats() {
    return await this.storageUtils.sendMessageToBackground({
      action: "getAIUsageStats",
    });
  }

  /**
   * Cancel ongoing AI request
   */
  async cancelAIRequest(requestId) {
    return await this.storageUtils.sendMessageToBackground({
      action: "cancelAIRequest",
      requestId: requestId,
    });
  }

  /**
   * Clear AI cache
   */
  clearAICache() {
    // Clear summary cache in cache manager
    this.cacheManager.summaryCache.clear();
    this.cacheManager.apiRequestQueue.clear();
  }

  /**
   * Test AI connection
   */
  async testAIConnection() {
    const testHighlight = {
      text: "This is a test highlight to verify AI connectivity.",
      url: "https://example.com",
      title: "Test Page",
      domain: "example.com",
      pageText: "This is a test highlight to verify AI connectivity.",
    };

    try {
      const summary = await this.summarizeHighlight(testHighlight);
      return {
        success: true,
        summary: summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Make AIUtils globally available
window.AIUtils = AIUtils;
