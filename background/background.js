// Background service worker for handling storage and communication
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Listen for messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case "saveHighlight":
          const savedHighlight = await this.saveHighlight(request.highlight);
          sendResponse({ success: true, highlight: savedHighlight });
          break;

        case "getHighlights":
          const highlights = await this.getHighlights();
          sendResponse({ success: true, highlights });
          break;

        case "deleteHighlight":
          await this.deleteHighlight(request.id);
          sendResponse({ success: true });
          break;

        case "clearAllHighlights":
          await this.clearAllHighlights();
          sendResponse({ success: true });
          break;

        case "exportHighlights":
          const exportData = await this.exportHighlights();
          sendResponse({ success: true, data: exportData });
          break;

        case "importHighlights":
          await this.importHighlights(request.highlights);
          sendResponse({ success: true });
          break;

        case "summarizeHighlight":
          const summary = await this.summarizeHighlight(request);
          sendResponse({ success: true, summary });
          break;

        default:
          console.warn("Unknown action:", request.action);
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      console.error("Background service error:", error);
      sendResponse({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  }

  async saveHighlight(highlight) {
    if (!highlight || !highlight.text || !highlight.url) {
      throw new Error("Invalid highlight data: missing required fields");
    }

    try {
      // Get current highlights
      const result = await chrome.storage.local.get(["highlights"]);
      const highlights = result.highlights || [];

      // Add timestamp if not present
      if (!highlight.timestamp) {
        highlight.timestamp = Date.now();
      }

      // Add new highlight to beginning
      highlights.unshift(highlight);

      // Limit to 1000 highlights to prevent storage issues
      if (highlights.length > 1000) {
        highlights.splice(1000);
      }

      // Save back to storage
      await chrome.storage.local.set({ highlights });

      // Notify all tabs about the new highlight
      this.notifyTabsAboutUpdate();

      return highlight;
    } catch (error) {
      console.error("Failed to save highlight:", error);
      throw new Error("Failed to save highlight: " + error.message);
    }
  }

  async getHighlights() {
    try {
      const result = await chrome.storage.local.get(["highlights"]);
      const highlights = result.highlights || [];
      return highlights;
    } catch (error) {
      console.error("Failed to get highlights:", error);
      throw new Error("Failed to retrieve highlights: " + error.message);
    }
  }

  async deleteHighlight(id) {
    if (!id) {
      throw new Error("Highlight ID is required");
    }

    try {
      const result = await chrome.storage.local.get(["highlights"]);
      const highlights = result.highlights || [];
      const initialCount = highlights.length;

      const filtered = highlights.filter((h) => h.id !== id);

      if (filtered.length === initialCount) {
        console.warn("No highlight found with ID:", id);
      }

      await chrome.storage.local.set({ highlights: filtered });

      // Notify all tabs about the update
      this.notifyTabsAboutUpdate();

      return true;
    } catch (error) {
      console.error("Failed to delete highlight:", error);
      throw new Error("Failed to delete highlight: " + error.message);
    }
  }

  async clearAllHighlights() {
    try {
      await chrome.storage.local.set({ highlights: [] });

      // Notify all tabs about the update
      this.notifyTabsAboutUpdate();

      return true;
    } catch (error) {
      console.error("Failed to clear highlights:", error);
      throw new Error("Failed to clear highlights: " + error.message);
    }
  }

  async exportHighlights() {
    try {
      const highlights = await this.getHighlights();
      const exportData = {
        highlights,
        exportDate: new Date().toISOString(),
        version: "1.0.0",
      };
      return exportData;
    } catch (error) {
      console.error("Failed to export highlights:", error);
      throw new Error("Failed to export highlights: " + error.message);
    }
  }

  async importHighlights(importData) {
    try {
      let highlights = [];

      if (Array.isArray(importData)) {
        // Direct array import
        highlights = importData;
      } else if (
        importData.highlights &&
        Array.isArray(importData.highlights)
      ) {
        // Structured import
        highlights = importData.highlights;
      } else {
        throw new Error(
          "Invalid import format - expected array or object with highlights property"
        );
      }

      // Validate highlights
      const validHighlights = highlights.filter(
        (h) => h && h.id && h.text && h.url && h.timestamp
      );

      if (validHighlights.length !== highlights.length) {
        console.warn(
          `Filtered out ${
            highlights.length - validHighlights.length
          } invalid highlights`
        );
      }

      await chrome.storage.local.set({ highlights: validHighlights });

      // Notify all tabs about the update
      this.notifyTabsAboutUpdate();

      return true;
    } catch (error) {
      console.error("Failed to import highlights:", error);
      throw new Error("Failed to import highlights: " + error.message);
    }
  }

  notifyTabsAboutUpdate() {
    // Notify all tabs that highlights have been updated
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        try {
          chrome.tabs
            .sendMessage(tab.id, {
              action: "highlightsUpdated",
            })
            .catch((error) => {
              // Ignore errors for tabs that don't have content scripts
            });
        } catch (error) {
          // Ignore errors
        }
      });
    });
  }

  handleInstallation(details) {
    if (details.reason === "install") {
      // Initialize storage on first install
      chrome.storage.local.set({ highlights: [] });
    } else if (details.reason === "update") {
      // Perform any migration if needed
      this.performMigrationIfNeeded();
    }
  }

  async performMigrationIfNeeded() {
    try {
      // Check if migration is needed and perform it
      const result = await chrome.storage.local.get(["highlights", "version"]);
      const currentVersion = chrome.runtime.getManifest().version;

      if (!result.version || result.version !== currentVersion) {
        // Perform any necessary data migrations here
        await chrome.storage.local.set({ version: currentVersion });
      }
    } catch (error) {
      console.error("Migration failed:", error);
    }
  }

  // Utility method to get storage usage
  async getStorageUsage() {
    try {
      const result = await chrome.storage.local.get(null);
      const dataSize = JSON.stringify(result).length;
      const usage = {
        bytes: dataSize,
        kilobytes: Math.round((dataSize / 1024) * 100) / 100,
        megabytes: Math.round((dataSize / (1024 * 1024)) * 100) / 100,
        limit: 5 * 1024 * 1024, // 5MB limit
        percentage:
          Math.round((dataSize / (5 * 1024 * 1024)) * 100 * 100) / 100,
      };
      return usage;
    } catch (error) {
      console.error("Failed to get storage usage:", error);
      return null;
    }
  }

  // Cleanup old highlights (optional feature)
  async cleanupOldHighlights(daysToKeep = 365) {
    try {
      const highlights = await this.getHighlights();
      const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

      const filtered = highlights.filter((h) => h.timestamp > cutoffDate);

      if (filtered.length !== highlights.length) {
        await chrome.storage.local.set({ highlights: filtered });
        this.notifyTabsAboutUpdate();
      }

      return filtered.length;
    } catch (error) {
      console.error("Failed to cleanup old highlights:", error);
      throw new Error("Failed to cleanup old highlights: " + error.message);
    }
  }

  // Summarize highlight functionality
  async summarizeHighlight(request) {
    try {
      // Validate request
      if (!request.requestId || !request.highlight || !request.cacheKey) {
        throw new Error("Invalid request: missing required fields");
      }

      // Check cache first
      const cachedSummary = await this.getCachedSummary(request.cacheKey);
      if (cachedSummary) {
        return cachedSummary;
      }

      // Validate and sanitize highlight data
      const sanitizedHighlight = this.sanitizeHighlight(request.highlight);

      // Get configuration
      const config = await this.getConfig();

      // Perform OpenAI API call
      const summary = await this.callOpenAI(sanitizedHighlight, config);

      // Cache the result
      await this.cacheSummary(request.cacheKey, summary);

      return summary;
    } catch (error) {
      console.error("Summarize highlight failed:", error);
      throw new Error("Failed to summarize: " + error.message);
    }
  }

  async getCachedSummary(cacheKey) {
    try {
      const result = await chrome.storage.local.get(["summaryCache"]);
      const cache = result.summaryCache || {};

      const cached = cache[cacheKey];
      if (cached && Date.now() - cached.timestamp < 300000) {
        // 5 minutes
        return cached.summary;
      }

      return null;
    } catch (error) {
      console.error("Failed to get cached summary:", error);
      return null;
    }
  }

  async cacheSummary(cacheKey, summary) {
    try {
      const result = await chrome.storage.local.get(["summaryCache"]);
      const cache = result.summaryCache || {};

      // Limit cache size
      const cacheKeys = Object.keys(cache);
      if (cacheKeys.length >= 50) {
        // Max 50 cached summaries
        // Remove oldest entries
        const sortedKeys = cacheKeys.sort(
          (a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0)
        );
        const toDelete = sortedKeys.slice(0, cacheKeys.length - 49);
        toDelete.forEach((key) => delete cache[key]);
      }

      cache[cacheKey] = {
        summary: summary,
        timestamp: Date.now(),
      };

      await chrome.storage.local.set({ summaryCache: cache });
    } catch (error) {
      console.error("Failed to cache summary:", error);
    }
  }

  sanitizeHighlight(highlight) {
    // Validate and sanitize highlight data
    if (!highlight || typeof highlight !== "object") {
      throw new Error("Invalid highlight data");
    }

    return {
      text: String(highlight.text || "").substring(0, 1000),
      url: String(highlight.url || "").substring(0, 500),
      title: String(highlight.title || "").substring(0, 200),
      domain: String(highlight.domain || "").substring(0, 100),
    };
  }

  async getConfig() {
    try {
      // Load config from env.config file
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

      if (!config.OPENAI_API_KEY) {
        throw new Error("OpenAI API key not found in env.config");
      }

      return config;
    } catch (error) {
      console.error("Failed to load config:", error);
      throw new Error("Configuration error: " + error.message);
    }
  }

  async callOpenAI(highlight, config) {
    try {
      const prompt = `Please summarize this highlighted text from a webpage in 2-3 sentences:

Highlight: "${highlight.text}"
Page Title: "${highlight.title}"
Domain: "${highlight.domain}"

Provide a concise summary that captures the key points:`;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.OPENAI_API_KEY}`,
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} - ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error("OpenAI API call failed:", error);
      throw new Error("API call failed: " + error.message);
    }
  }

  // Health check method
  async healthCheck() {
    try {
      // Test storage
      await chrome.storage.local.set({ healthCheck: Date.now() });
      const result = await chrome.storage.local.get(["healthCheck"]);

      if (!result.healthCheck) {
        throw new Error("Storage test failed");
      }

      // Clean up test data
      await chrome.storage.local.remove(["healthCheck"]);

      // Get current stats
      const highlights = await this.getHighlights();
      const usage = await this.getStorageUsage();

      return {
        status: "healthy",
        highlightsCount: highlights.length,
        storageUsage: usage,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Health check failed:", error);
      return {
        status: "error",
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }
}

// Initialize background service
new BackgroundService();
