# AI Prompts & Features

This folder contains the AI functionality for the Website Highlight Saver extension.

## Files Overview

### `prompts.js`

Contains all AI prompts used for different features:

- **SUMMARIZE_HIGHLIGHT**: Summarize individual highlights
- **SUMMARIZE_MULTIPLE**: Analyze multiple highlights together
- **GENERATE_TAGS**: Create relevant tags for highlights
- **EXTRACT_INSIGHTS**: Extract key insights and takeaways
- **GENERATE_QUESTIONS**: Generate research questions
- **CATEGORIZE_HIGHLIGHT**: Categorize highlights by type

### `ai-service.js`

Handles OpenAI API communication:

- Loads configuration from environment
- API request handling with timeout
- Methods for each AI feature
- Error handling

### `env.config`

Configuration file for API settings:

- OpenAI API key
- Model configuration
- Token limits and temperature

## Setup

### 1. Configure API Key

Edit `env.config` in the root directory:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# AI Configuration
AI_MODEL=gpt-4
AI_MAX_TOKENS=150
AI_TEMPERATURE=0.8
AI_TIMEOUT=10000
```

### 2. Update env.config

Replace the API key in `env.config`:

```bash
OPENAI_API_KEY=your_actual_api_key_here
```

## Usage Examples

### Basic Setup

```javascript
import aiService from "./prompts/ai-service.js";

// Check if AI is configured
if (aiService.isConfigured()) {
  // Use AI features
}
```

### Summarize a Highlight

```javascript
const highlight = {
  text: "Your highlighted text here",
  title: "Page Title",
  domain: "example.com",
  pageText: "Surrounding context...",
};

const result = await aiService.summarizeHighlight(highlight);
console.log(result.summary);
```

### Generate Tags

```javascript
const tags = await aiService.generateTags(highlight);
console.log(tags.tags); // ['tag1', 'tag2', 'tag3']
```

### Extract Insights

```javascript
const insights = await aiService.extractInsights(highlight);
console.log(insights.insights);
```

### Categorize Highlight

```javascript
const category = await aiService.categorizeHighlight(highlight);
console.log(category.category); // 'fact', 'opinion', etc.
```

## Integration

### Popup Integration

Add AI buttons to highlight items:

```javascript
// Add summarize button
const summarizeBtn = document.createElement("button");
summarizeBtn.textContent = "Summarize";
summarizeBtn.onclick = async () => {
  try {
    const result = await aiService.summarizeHighlight(highlight);
    // Display result
  } catch (error) {
    console.error("AI error:", error);
  }
};
```

### Content Script Integration

Auto-process highlights when saved:

```javascript
// In content script
if (aiService.isConfigured()) {
  const summary = await aiService.summarizeHighlight(highlight);
  // Add summary to highlight data
}
```

## Error Handling

All AI methods include error handling:

- Network timeouts
- Invalid API keys
- Rate limiting
- Configuration errors

## Security

- API keys are stored in config file (not in code)
- No keys are exposed in the extension
- All requests use HTTPS

## Troubleshooting

### Common Issues

1. **API Key Invalid**

   - Check key format (should start with 'sk-')
   - Verify key is active in OpenAI dashboard
   - Test connection using `aiService.testConnection()`

2. **Requests Timing Out**

   - Check internet connection
   - Increase timeout in config
   - Verify OpenAI API status

3. **Feature Not Working**
   - Check if AI is configured: `aiService.isConfigured()`
   - Verify API key is set correctly
   - Check browser console for errors
