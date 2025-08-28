// DOM manipulation and text finding utilities
// Used by content script for DOM operations

class DOMUtils {
  constructor() {
    this.textNodeCache = new Map();
    this.cacheValidityDuration = 30000; // 30 seconds
  }

  /**
   * Find text nodes containing specific text with optimization
   */
  findTextNodesOptimized(searchText, body = document.body) {
    const textNodes = [];
    const searchLength = searchText.length;

    if (searchLength < 3) {
      // For short text, use TreeWalker with early termination
      const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
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
      const maxMatches = 10;

      while ((node = walker.nextNode()) && foundCount < maxMatches) {
        if (node.textContent.includes(searchText)) {
          textNodes.push(node);
          foundCount++;
        }
      }
    } else {
      // For longer text, use targeted search
      const allTextNodes = this.getAllTextNodes(body);

      for (const textNode of allTextNodes) {
        if (textNode.textContent.includes(searchText)) {
          textNodes.push(textNode);
          if (textNodes.length >= 5) break;
        }
      }
    }

    return textNodes;
  }

  /**
   * Get all text nodes with caching
   */
  getAllTextNodes(container = document.body) {
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
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
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

  /**
   * Check if a node is valid and still in DOM
   */
  isValidNode(node) {
    return node && node.nodeType && node.parentNode && document.contains(node);
  }

  /**
   * Create highlight span element
   */
  createHighlightSpan(highlight) {
    const span = document.createElement("span");
    span.className = "highlight-saver-saved";
    span.dataset.highlightId = highlight.id;

    if (highlight.text && highlight.text.trim() !== "") {
      span.textContent = highlight.text;
    }

    span.title = "Saved highlight - Click to view in extension";
    span.style.cssText =
      "background-color: #ffff99; padding: 1px 2px; border-radius: 2px;";

    return span;
  }

  /**
   * Mark text in a specific node with highlighting
   */
  markTextInNode(textNode, text, index, highlight) {
    const content = textNode.textContent;
    const before = content.substring(0, index);
    const after = content.substring(index + text.length);

    const span = this.createHighlightSpan(highlight);
    const parent = textNode.parentNode;

    if (before) {
      const beforeNode = document.createTextNode(before);
      parent.insertBefore(beforeNode, textNode);
    }

    parent.insertBefore(span, textNode.nextSibling);

    if (after) {
      const afterNode = document.createTextNode(after);
      parent.insertBefore(afterNode, span.nextSibling);
    }

    parent.removeChild(textNode);
    return span;
  }

  /**
   * Remove existing highlights in batches for performance
   */
  removeExistingHighlightsBatch() {
    const existingHighlights = document.querySelectorAll(
      ".highlight-saver-saved"
    );
    const textNodes = [];

    // Collect all text nodes to be created
    existingHighlights.forEach((el) => {
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

  /**
   * Get surrounding context for a node
   */
  getNodeContext(node, textIndex, textLength) {
    const content = node.textContent;
    const start = Math.max(0, textIndex - 50);
    const end = Math.min(content.length, textIndex + textLength + 50);
    return content.substring(start, end);
  }

  /**
   * Clear text node cache
   */
  clearCache() {
    this.textNodeCache.clear();
  }
}

// Make DOMUtils globally available
window.DOMUtils = DOMUtils;
