// Storage management
class HighlightStorage {
  static async getAll() {
    const result = await chrome.storage.local.get(["highlights"]);
    return result.highlights || [];
  }

  static async save(highlight) {
    const highlights = await this.getAll();
    highlights.unshift(highlight); // Add to beginning
    await chrome.storage.local.set({ highlights });
    return highlight;
  }

  static async delete(id) {
    const highlights = await this.getAll();
    const filtered = highlights.filter((h) => h.id !== id);
    await chrome.storage.local.set({ highlights: filtered });
  }

  static async clearAll() {
    await chrome.storage.local.set({ highlights: [] });
  }

  static async export() {
    const highlights = await this.getAll();
    const dataStr = JSON.stringify(highlights, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `highlights-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  static async import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const highlights = JSON.parse(e.target.result);
          if (Array.isArray(highlights)) {
            await chrome.storage.local.set({ highlights });
            resolve(highlights);
          } else {
            reject(new Error("Invalid file format"));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  }
}

// UI management
class PopupUI {
  constructor() {
    this.highlightsList = document.getElementById("highlightsList");
    this.emptyState = document.getElementById("emptyState");
    this.searchInput = document.getElementById("searchInput");
    this.highlightCount = document.getElementById("highlightCount");
    this.exportBtn = document.getElementById("exportBtn");
    this.importBtn = document.getElementById("importBtn");
    this.fileInput = document.getElementById("fileInput");
    this.clearAllBtn = document.getElementById("clearAllBtn");

    this.highlights = [];
    this.filteredHighlights = [];

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadHighlights();
  }

  bindEvents() {
    this.searchInput.addEventListener("input", () => this.filterHighlights());
    this.exportBtn.addEventListener("click", () => this.handleExport());
    this.importBtn.addEventListener("click", () => this.handleImport());
    this.fileInput.addEventListener("change", (e) => this.handleFileSelect(e));
    this.clearAllBtn.addEventListener("click", () => this.handleClearAll());
  }

  async loadHighlights() {
    this.highlights = await HighlightStorage.getAll();
    this.filteredHighlights = [...this.highlights];
    this.render();
  }

  filterHighlights() {
    const query = this.searchInput.value.toLowerCase().trim();

    if (!query) {
      this.filteredHighlights = [...this.highlights];
    } else {
      this.filteredHighlights = this.highlights.filter(
        (highlight) =>
          highlight.text.toLowerCase().includes(query) ||
          highlight.title.toLowerCase().includes(query) ||
          highlight.domain.toLowerCase().includes(query)
      );
    }

    this.render();
  }

  render() {
    this.updateCount();
    this.toggleEmptyState();
    this.renderHighlights();
  }

  updateCount() {
    const count = this.filteredHighlights.length;
    this.highlightCount.textContent = `${count} highlight${
      count !== 1 ? "s" : ""
    }`;
  }

  toggleEmptyState() {
    const hasHighlights = this.filteredHighlights.length > 0;
    this.highlightsList.style.display = hasHighlights ? "block" : "none";
    this.emptyState.style.display = hasHighlights ? "none" : "flex";
  }

  renderHighlights() {
    this.highlightsList.innerHTML = "";

    this.filteredHighlights.forEach((highlight) => {
      const element = this.createHighlightElement(highlight);
      this.highlightsList.appendChild(element);
    });
  }

  createHighlightElement(highlight) {
    const div = document.createElement("div");
    div.className = "highlight-item";
    div.dataset.id = highlight.id;

    const text = document.createElement("div");
    text.className = "highlight-text";
    text.textContent = highlight.text;

    const meta = document.createElement("div");
    meta.className = "highlight-meta";

    const domain = document.createElement("a");
    domain.className = "highlight-domain";
    domain.href = highlight.url;
    domain.target = "_blank";
    domain.textContent = highlight.domain;

    const date = document.createElement("span");
    date.className = "highlight-date";
    date.textContent = this.formatDate(highlight.timestamp);

    meta.appendChild(domain);
    meta.appendChild(date);

    const actions = document.createElement("div");
    actions.className = "highlight-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleDelete(highlight.id);
    });

    actions.appendChild(deleteBtn);

    div.appendChild(text);
    div.appendChild(meta);
    div.appendChild(actions);

    // Click to open the page with position data
    div.addEventListener("click", (e) => {
      // Prevent double-opening if clicking on child elements
      if (e.target !== div && !div.contains(e.target)) {
        return;
      }

      // Preserve existing URL hash and append highlight parameters
      let url = highlight.url;
      if (highlight.textPosition) {
        const separator = url.includes("#") ? "&" : "#";
        const highlightParams = `highlight=${encodeURIComponent(
          highlight.text
        )}&pos=${encodeURIComponent(JSON.stringify(highlight.textPosition))}`;
        url = `${url}${separator}${highlightParams}`;
      }

      chrome.tabs.create({ url });
    });

    return div;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  async handleDelete(id) {
    if (confirm("Are you sure you want to delete this highlight?")) {
      await HighlightStorage.delete(id);
      await this.loadHighlights();
    }
  }

  async handleExport() {
    try {
      await HighlightStorage.export();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export highlights");
    }
  }

  handleImport() {
    this.fileInput.click();
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await HighlightStorage.import(file);
      await this.loadHighlights();
      alert("Highlights imported successfully!");
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import highlights. Please check the file format.");
    }

    // Reset file input
    event.target.value = "";
  }

  async handleClearAll() {
    if (
      confirm(
        "Are you sure you want to delete all highlights? This action cannot be undone."
      )
    ) {
      await HighlightStorage.clearAll();
      await this.loadHighlights();
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PopupUI();
});
