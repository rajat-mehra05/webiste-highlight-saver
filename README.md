# Website Highlight Saver

A Chrome extension that allows users to highlight and save text from any webpage with local storage and AI-powered summarization. Built with a modular, performance-optimized architecture.

## 🎬 Working Demo

![Website Highlight Saver Demo](highlight.gif)

_Watch the extension in action: Select text, save highlights, and navigate between them seamlessly._

## ✨ Features

- **Text Selection**: Select any text on any webpage to save as a highlight
- **AI Summarization**: Get instant AI-powered summaries of your highlights using OpenAI
- **Smart Popup**: Clean, minimal popup appears below your selection with 3 actions
- **Local Storage**: All highlights are saved locally using Chrome's storage API
- **Modern UI**: Minimal, modern popup interface with smooth animations
- **Search & Filter**: Search through your saved highlights by text, domain, or title
- **Export/Import**: Backup and restore your highlights as JSON files
- **Visual Feedback**: Saved highlights are marked on the page with a yellow background
- **Cross-Page Persistence**: Highlights persist across browser sessions
- **Responsive Design**: Works on desktop and mobile browsers
- **Robust Text Marking**: Handles complex text selections across multiple DOM elements
- **🔗 URL Navigation**: Navigate directly to specific highlights via URL fragments
- **⚡ Performance Optimized**: Caching, memory management, and optimized DOM operations
- **🛡️ Error Recovery**: Robust fallback mechanisms and error handling
- **🧠 Smart Caching**: Intelligent caching of text nodes and AI responses

## 🚀 Installation

1. **Download or clone this repository**

2. **Create icon files** (required):

   - Create 16x16, 48x48, and 128x128 pixel PNG icons
   - Replace the placeholder files in the `icons/` folder:
     - `icons/icon16.png`
     - `icons/icon48.png`
     - `icons/icon128.png`

   You can use any image editor or online icon generator to create simple highlight-themed icons.

3. **Configure AI (Optional)**: Create an `env.config` file in the root directory:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   AI_MODEL=gpt-4
   AI_MAX_TOKENS=150
   AI_TEMPERATURE=0.8
   AI_TIMEOUT=10000
   ```

4. **Load the extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension folder
   - The extension icon should appear in your Chrome toolbar

## 📖 Usage

### Saving Highlights

1. **Select Text**: Highlight any text on any webpage
2. **Action Popup**: A minimal popup appears below your selection with 3 buttons:
   - **Summarize**: Get an AI summary of the selected text
   - **Save**: Save the highlight to local storage
   - **Cancel**: Close the popup
3. **Choose Action**: Click the desired button
4. **Success Feedback**: A notification will confirm your action

### AI Summarization

1. **Select Text**: Highlight any text on any webpage
2. **Click Summarize**: Click the green "Summarize" button
3. **Wait for AI**: The button shows "Summarizing..." while processing
4. **View Summary**: A clean popup displays the AI-generated summary
5. **Auto-close**: The summary popup auto-closes after 15 seconds

### Viewing Highlights

1. **Open Extension**: Click the extension icon in your Chrome toolbar
2. **Browse Highlights**: View all your saved highlights in a scrollable list
3. **Search**: Use the search bar to filter highlights by text, domain, or title
4. **Click to Visit**: Click any highlight to open the original webpage

### Navigating to Highlights

- **Direct Navigation**: Click any highlight in the popup to navigate to the original page
- **URL Fragments**: The extension automatically scrolls to and highlights saved text when navigating via URL
- **Visual Feedback**: Temporary highlighting shows where the text is located on the page

### Managing Highlights

- **Delete**: Click the "Delete" button on any highlight to remove it
- **Clear All**: Use the "Clear All" button to remove all highlights
- **Export**: Click the export icon to download all highlights as a JSON file
- **Import**: Click the import icon to restore highlights from a JSON file

### Visual Indicators

- **Saved Highlights**: Previously saved text is highlighted with a yellow background
- **Hover Effects**: Hover over saved highlights to see additional information
- **Navigation Feedback**: Clear visual feedback when navigating to highlights

## 📁 File Structure

```
website-highlight-saver/
├── manifest.json              # Extension configuration
├── env.config                 # AI configuration (create this)
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.css             # Popup styling
│   └── popup.js              # Popup functionality
├── content/
│   ├── content.js            # Main content script orchestration
│   ├── content.css           # Content script styling
│   └── utils/                # Modular utility classes
│       ├── cache-manager.js  # Caching and memory management
│       ├── dom-utils.js      # DOM manipulation utilities
│       ├── range-utils.js    # Text selection and range handling
│       ├── event-utils.js    # Event handling and performance
│       ├── ui-utils.js       # User interface management
│       ├── storage-utils.js  # Chrome storage operations
│       ├── ai-utils.js       # AI integration and summarization
│       └── README.md         # Utilities documentation
├── background/
│   └── background.js         # Background service worker

├── icons/
│   ├── icon16.png            # 16x16 extension icon
│   ├── icon48.png            # 48x48 extension icon
│   └── icon128.png           # 128x128 extension icon
└── README.md                 # This file
```

## ⚙️ Technical Details

### 🏗️ Modular Architecture

The extension uses a modular utility-based architecture for better maintainability and performance:

- **Main Orchestration**: `content.js` coordinates all functionality (~300 lines)
- **Specialized Utilities**: 7 focused utility classes handle specific concerns
- **Clean Interfaces**: Clear separation of concerns and dependencies
- **Performance Optimized**: Shared caching, optimized DOM operations, memory management

### AI Integration

- **OpenAI API**: Uses OpenAI's GPT models for text summarization
- **Integrated Prompts**: Built-in prompt system for consistent AI responses
- **Configurable**: Model, tokens, temperature, and timeout are configurable
- **Error Handling**: Graceful fallback if AI service is unavailable
- **Local Processing**: No data sent to external servers except OpenAI API
- **Smart Caching**: Caches AI responses to avoid duplicate requests

### Storage Strategy

- Uses Chrome's `chrome.storage.local` API for persistent storage
- Stores highlights with metadata (URL, title, domain, timestamp)
- Automatic cleanup of old highlights (keeps for 1 year)
- Storage limit: 5MB (supports ~10,000 highlights)

### Performance Features

- **Text Node Caching**: Intelligent caching of DOM text nodes for faster highlighting
- **Memory Management**: Automatic cleanup of caches and temporary data
- **Chunk Processing**: UI-responsive processing of large highlight sets
- **Request Deduplication**: Prevents duplicate AI requests for the same text
- **Optimized DOM Operations**: Batch operations and efficient text finding

### Data Structure

```javascript
{
  id: "unique_identifier",
  text: "highlighted text",
  url: "https://example.com/page",
  title: "Page Title",
  domain: "example.com",
  timestamp: 1703123456789,
  pageText: "surrounding context..."
}
```

### Permissions

- `storage`: For saving highlights locally
- `activeTab`: For accessing current tab information
- `scripting`: For injecting content scripts
- `tabs`: For tab management and navigation
- `<all_urls>`: For working on any website

## 🎨 UI/UX Features

### Popup Design

- **Minimal & Modern**: Clean white background with subtle shadows
- **Smart Positioning**: Appears below highlighted text, avoids screen edges
- **Responsive**: Adapts to different screen sizes
- **Smooth Animations**: Fade-in effects and hover transitions
- **3-Button Layout**: Summarize, Save, Cancel for clear actions

### Visual Feedback

- **Loading States**: Buttons show loading text during AI processing
- **Success/Error Messages**: Clear feedback for all actions
- **Auto-close**: Popups automatically close after appropriate delays
- **Hover Effects**: Interactive button states with subtle animations
- **Navigation Feedback**: Visual indicators when navigating to highlights

### Error Recovery

- **Fallback Mechanisms**: Multiple strategies for text finding and highlighting
- **Graceful Degradation**: Extension continues working even if some features fail
- **User Feedback**: Clear error messages and status indicators
- **Automatic Retry**: Smart retry logic for failed operations

## 🌐 Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers

## 🛠️ Development

### Local Development

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test your changes

### Debugging

- **Popup**: Right-click extension icon → "Inspect popup"
- **Content Script**: Open DevTools on any webpage
- **Background**: Go to `chrome://extensions/` → Click "service worker" link

### AI Configuration

To enable AI summarization:

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/)
2. Create `env.config` file in the extension root:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   AI_MODEL=gpt-4
   AI_MAX_TOKENS=150
   AI_TEMPERATURE=0.8
   AI_TIMEOUT=10000
   ```
3. Reload the extension

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

If you encounter any issues or have feature requests, please create an issue in the repository.

**Note**: This extension stores all data locally in your browser. Only text sent for AI summarization is transmitted to OpenAI's servers.
