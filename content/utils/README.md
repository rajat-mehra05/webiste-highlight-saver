# Content Script Utilities

This directory contains modular utility classes used by the main content script (`content.js`) to provide clean, maintainable code organization.

## Architecture

The main `HighlightSaver` class in `content.js` is now significantly smaller (~300 lines vs. ~1800 lines) and delegates functionality to specialized utility classes.

## Utility Classes

### 🗄️ CacheManager (`cache-manager.js`)

Handles all caching and memory management:

- Text node caching with expiration
- Summary result caching
- API request deduplication
- Periodic memory cleanup
- Cache size limiting

### 🌐 DOMUtils (`dom-utils.js`)

DOM manipulation and text finding:

- Optimized text node searching
- Highlight span creation
- Batch DOM operations
- Node validation
- Text node caching

### 📐 RangeUtils (`range-utils.js`)

Text selection and range management:

- Range validation and creation
- Text marking with fallbacks
- Selection data storage
- Context-based text matching
- Position-based text finding

### ⚡ EventUtils (`event-utils.js`)

Event handling and performance optimization:

- Debounced/throttled event handlers
- Chunk processing for UI responsiveness
- URL fragment handling
- Scroll-to-text functionality
- Event cleanup management

### 🎨 UIUtils (`ui-utils.js`)

User interface and popup management:

- Popup creation and positioning
- Button handling
- Feedback messages
- Summary display
- Temporary highlighting

### 💾 StorageUtils (`storage-utils.js`)

Chrome storage and API communication:

- Background script messaging
- Highlight CRUD operations
- Data sanitization
- Request timeout handling
- Storage statistics

### 🤖 AIUtils (`ai-utils.js`)

AI integration and summarization:

- Summarization with caching
- Request deduplication
- Error handling
- Status checking
- AI service configuration

## Loading Order

The utilities are loaded in a specific order in `manifest.json` to ensure dependencies are available:

1. `cache-manager.js` - Core caching infrastructure
2. `dom-utils.js` - DOM manipulation primitives
3. `range-utils.js` - Text selection handling
4. `event-utils.js` - Event management
5. `ui-utils.js` - User interface
6. `storage-utils.js` - Chrome extension APIs
7. `ai-utils.js` - AI features (depends on cache and storage)
8. `content.js` - Main orchestration class

## Benefits

### ✅ Maintainability

- Single responsibility principle
- Clear separation of concerns
- Easier to locate and fix bugs
- Simplified testing

### ✅ Performance

- Shared caching across utilities
- Optimized DOM operations
- Memory management
- Request deduplication

### ✅ Readability

- ~300 line main file vs. ~1800 lines
- Focused utility classes
- Clear naming conventions
- Self-documenting architecture

### ✅ Extensibility

- Easy to add new features
- Utilities can be reused
- Modular testing possible
- Clear interfaces

## Chrome Extension Constraints

Since Chrome content scripts don't support ES6 modules or CommonJS require(), we use:

- Global namespace attachment (`window.UtilityName`)
- Script loading order via `manifest.json`
- Traditional constructor functions
- Dependency injection where needed

This approach provides modularity while working within Chrome extension limitations.
