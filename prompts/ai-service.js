// AI Service for Website Highlight Saver
// Loads config from environment file and handles OpenAI API communication

import { getPrompt } from "./prompts.js";

class AIService {
  constructor() {
    this.baseUrl = "https://api.openai.com/v1/chat/completions";
    this.config = this.loadConfig();
  }

  async loadConfig() {
    try {
      // Load environment configuration from env.config file
      const response = await fetch(chrome.runtime.getURL("env.config"));
      const envText = await response.text();

      // Parse the environment file
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

      return {
        apiKey: config.OPENAI_API_KEY || "",
        model: config.AI_MODEL || "gpt-4",
        maxTokens: parseInt(config.AI_MAX_TOKENS) || 150,
        temperature: parseFloat(config.AI_TEMPERATURE) || 0.8,
        timeout: parseInt(config.AI_TIMEOUT) || 10000,
      };
    } catch (error) {
      console.error("Failed to load environment config:", error);
      // Fallback to default config
      return {
        apiKey: "",
        model: "gpt-4",
        maxTokens: 150,
        temperature: 0.8,
        timeout: 10000,
      };
    }
  }

  isConfigured() {
    return this.config.apiKey && this.config.apiKey.trim() !== "";
  }

  async makeRequest(requestBody) {
    if (!this.isConfigured()) {
      throw new Error(
        "AI not configured. Please set your OpenAI API key in env.config"
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }

      throw error;
    }
  }

  async summarizeHighlight(highlight) {
    const prompt = getPrompt("SUMMARIZE_HIGHLIGHT", {
      highlight: highlight.text,
      title: highlight.title,
      domain: highlight.domain,
      context: highlight.pageText || "",
    });

    const response = await this.makeRequest({
      model: this.config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return {
      summary: response.choices[0].message.content.trim(),
      usage: response.usage,
    };
  }

  async generateTags(highlight) {
    const prompt = getPrompt("GENERATE_TAGS", {
      highlight: highlight.text,
      title: highlight.title,
      domain: highlight.domain,
    });

    const response = await this.makeRequest({
      model: this.config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: 100,
      temperature: this.config.temperature,
    });

    const tagsText = response.choices[0].message.content.trim();
    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"));

    return {
      tags: tags.slice(0, 5),
      usage: response.usage,
    };
  }

  async extractInsights(highlight) {
    const prompt = getPrompt("EXTRACT_INSIGHTS", {
      highlight: highlight.text,
      title: highlight.title,
      domain: highlight.domain,
    });

    const response = await this.makeRequest({
      model: this.config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return {
      insights: response.choices[0].message.content.trim(),
      usage: response.usage,
    };
  }

  async categorizeHighlight(highlight) {
    const prompt = getPrompt("CATEGORIZE_HIGHLIGHT", {
      highlight: highlight.text,
      title: highlight.title,
      domain: highlight.domain,
    });

    const response = await this.makeRequest({
      model: this.config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: 100,
      temperature: this.config.temperature,
    });

    const result = response.choices[0].message.content.trim();
    const categoryMatch = result.match(
      /(fact|opinion|how-to|quote|definition|insight|news|research)/i
    );
    const category = categoryMatch ? categoryMatch[1].toLowerCase() : "other";

    return {
      category,
      explanation: result,
      usage: response.usage,
    };
  }

  async testConnection() {
    try {
      const response = await this.makeRequest({
        model: this.config.model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" },
        ],
        max_tokens: 10,
      });

      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`API connection failed: ${error.message}`);
    }
  }
}

const aiService = new AIService();
export default aiService;
