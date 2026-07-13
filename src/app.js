(function initApp() {
  const core = window.IntakeCore;
  const STORAGE_KEY = "model-intake-queue-v1";
  const CACHE_KEY = "model-intake-metadata-cache-v1";
  const SAMPLE_TEXT = `1. Ozzy Osbourne Sculpture Scale 1/6 (450mm):
https://3dwicked.gumroad.com/l/OzzyOsbourneS/jgwjlmr

2. Iron Maiden Sculpture Scale 1/6 (380mm):
https://3dwicked.gumroad.com/l/IronMaidenS/j1rrn5b

3. Ozzy Osbourne Portrait Bust Scale 1/4 (300mm):
https://3dwicked.gumroad.com/l/OzzyOsbournePB/s2pdccs

4. Iron Maiden Portrait Bust Scale 1/4 (297mm):
https://3dwicked.gumroad.com/l/IronMaidenPB/9u5kgkh`;

  const state = {
    items: [],
    selectedId: "",
    search: "",
    statusFilter: "all",
    metadataCache: {}
  };

  const els = {
    queueSummary: document.getElementById("queueSummary"),
    sourceText: document.getElementById("sourceText"),
    parseButton: document.getElementById("parseButton"),
    sampleButton: document.getElementById("sampleButton"),
    clearSourceButton: document.getElementById("clearSourceButton"),
    csvFileInput: document.getElementById("csvFileInput"),
    queueFileInput: document.getElementById("queueFileInput"),
    exportLoreBasicButton: document.getElementById("exportLoreBasicButton"),
    exportLoreFullButton: document.getElementById("exportLoreFullButton"),
    exportGumroadButton: document.getElementById("exportGumroadButton"),
    exportModelBrowserButton: document.getElementById("exportModelBrowserButton"),
    exportQueueButton: document.getElementById("exportQueueButton"),
    resetButton: document.getElementById("resetButton"),
    queueSearch: document.getElementById("queueSearch"),
    statusFilter: document.getElementById("statusFilter"),
    openSelectedButton: document.getElementById("openSelectedButton"),
    markDownloadReadyButton: document.getElementById("markDownloadReadyButton"),
    queueBody: document.getElementById("queueBody"),
    emptyState: document.getElementById("emptyState"),
    detailTitle: document.getElementById("detailTitle"),
    detailSubtitle: document.getElementById("detailSubtitle"),
    removeSelectedButton: document.getElementById("removeSelectedButton"),
    toast: document.getElementById("toast"),
    detailName: document.getElementById("detailName"),
    detailCreator: document.getElementById("detailCreator"),
    detailStatus: document.getElementById("detailStatus"),
    detailTargetFolder: document.getElementById("detailTargetFolder"),
    detailOriginalUrl: document.getElementById("detailOriginalUrl"),
    detailPurchasedUrl: document.getElementById("detailPurchasedUrl"),
    detailContextHint: document.getElementById("detailContextHint"),
    detailAlignment: document.getElementById("detailAlignment"),
    detailAbilities: document.getElementById("detailAbilities"),
    detailOrigin: document.getElementById("detailOrigin"),
    detailBackstory: document.getElementById("detailBackstory"),
    detailFamousStoryline: document.getElementById("detailFamousStoryline"),
    detailNotes: document.getElementById("detailNotes")
  };

  const detailBindings = [
    ["detailName", "modelName"],
    ["detailCreator", "creator"],
    ["detailStatus", "status"],
    ["detailTargetFolder", "targetFolder"],
    ["detailOriginalUrl", "originalUrl"],
    ["detailPurchasedUrl", "purchasedUrl"],
    ["detailContextHint", "contextHint"],
    ["detailAlignment", "alignment"],
    ["detailAbilities", "abilities"],
    ["detailOrigin", "origin"],
    ["detailBackstory", "backstory"],
    ["detailFamousStoryline", "famousStoryline"],
    ["detailNotes", "notes"]
  ];

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      state.items = Array.isArray(saved) ? saved.map((item) => core.createItem(item)) : [];
    } catch {
      state.items = [];
    }
    try {
      state.metadataCache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
    } catch {
      state.metadataCache = {};
    }
    if (state.items.length) state.selectedId = state.items[0].id;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    state.metadataCache = { ...state.metadataCache, ...core.buildMetadataCache(state.items) };
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.metadataCache));
  }

  function selectedItem() {
    return state.items.find((item) => item.id === state.selectedId) || null;
  }

  function updateSelected(patch, options) {
    state.items = state.items.map((item) => {
      if (item.id !== state.selectedId) return item;
      const next = { ...item, ...patch, updatedAt: new Date().toISOString() };
      if (patch.modelName && !patch.targetFolder) next.targetFolder = core.sanitizeFolderName(next.targetFolder || patch.modelName);
      if (patch.purchasedUrl && item.status === core.STATUS_NEEDS_PURCHASE) next.status = "purchased";
      return next;
    });
    saveState();
    if (options && options.partial) {
      renderSummary();
      renderTable();
      return;
    }
    render();
  }

  function filteredItems() {
    const query = core.normalizeKey(state.search);
    return state.items.filter((item) => {
      const statusOk = state.statusFilter === "all" || item.status === state.statusFilter;
      if (!statusOk) return false;
      if (!query) return true;
      const haystack = core.normalizeKey([
        item.modelName,
        item.creator,
        item.originalUrl,
        item.purchasedUrl,
        item.contextHint,
        item.alignment,
        item.abilities,
        item.origin,
        item.backstory,
        item.famousStoryline,
        item.notes
      ].join(" "));
      return haystack.includes(query);
    });
  }

  function statusLabel(status) {
    return String(status || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function loreMeter(item) {
    const filled = core.loreScore(item);
    return `<div class="lore-meter" title="${filled}/5 lore fields">${[0, 1, 2, 3, 4].map((i) => {
      return `<span class="lore-dot ${i < filled ? "filled" : ""}"></span>`;
    }).join("")}</div>`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderUrlLink(url, label) {
    const value = String(url || "").trim();
    if (!value) return `<span class="url-line empty-url">-</span>`;
    return `<a class="url-line url-link" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(value)}">${escapeHtml(label || value)}</a>`;
  }

  function renderTable() {
    const visible = filteredItems();
    els.queueBody.innerHTML = visible.map((item) => {
      const purchased = item.purchasedUrl ? "Saved" : "Missing";
      return `
        <tr class="queue-row ${item.id === state.selectedId ? "selected" : ""}" data-id="${escapeHtml(item.id)}">
          <td class="name-cell">
            <strong>${escapeHtml(item.modelName)}</strong>
            ${renderUrlLink(item.originalUrl)}
          </td>
          <td>${escapeHtml(item.creator || "-")}</td>
          <td><span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td>
          <td>
            <strong>${purchased}</strong>
            ${renderUrlLink(item.purchasedUrl)}
          </td>
          <td>${loreMeter(item)}</td>
        </tr>
      `;
    }).join("");

    els.emptyState.classList.toggle("visible", visible.length === 0);
    els.queueBody.querySelectorAll("tr.queue-row").forEach((row) => {
      row.addEventListener("click", () => {
        state.selectedId = row.dataset.id;
        render();
      });
    });
    els.queueBody.querySelectorAll("a.url-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    });
  }

  function renderDetail() {
    const item = selectedItem();
    const disabled = !item;
    detailBindings.forEach(([elementKey, itemKey]) => {
      els[elementKey].disabled = disabled;
      els[elementKey].value = item ? item[itemKey] || "" : "";
    });
    els.removeSelectedButton.disabled = disabled;
    els.openSelectedButton.disabled = disabled;
    els.markDownloadReadyButton.disabled = disabled || !item.purchasedUrl;
    els.detailTitle.textContent = item ? item.modelName : "No Selection";
    els.detailSubtitle.textContent = item ? `${item.creator || "Unknown creator"} / ${statusLabel(item.status)}` : "Select a model from the queue.";
  }

  function renderSummary() {
    const purchased = state.items.filter((item) => item.purchasedUrl).length;
    const lore = state.items.filter(core.hasLore).length;
    els.queueSummary.textContent = `${state.items.length} queued / ${purchased} purchased / ${lore} with lore`;
  }

  function render() {
    renderSummary();
    renderTable();
    renderDetail();
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("visible"), 2600);
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function addItems(items, messagePrefix) {
    const hydrated = core.applyMetadataCache(items, state.metadataCache);
    const before = state.items.length;
    state.items = core.mergeItems(state.items, hydrated);
    if (!state.selectedId && state.items.length) state.selectedId = state.items[0].id;
    saveState();
    render();
    toast(`${messagePrefix}: ${state.items.length - before} added, ${state.items.length} total`);
  }

  function parseSource() {
    const items = core.parsePatreonText(els.sourceText.value);
    if (!items.length) {
      toast("No Gumroad product links found");
      return;
    }
    addItems(items, "Parsed");
  }

  function importLoreKeeperCsv(text) {
    const rows = core.parseCsv(text);
    const items = rows.map(core.itemFromLoreKeeperRow).filter(Boolean);
    if (!items.length) {
      toast("No compatible CSV rows found");
      return;
    }
    addItems(items, "Imported");
  }

  function exportCsv(filename, rows, headers) {
    if (!rows.length) {
      toast("No rows to export");
      return;
    }
    downloadText(filename, core.toCsv(rows, headers), "text/csv;charset=utf-8");
    toast(`Exported ${rows.length} rows`);
  }

  function wireEvents() {
    els.parseButton.addEventListener("click", parseSource);
    els.sampleButton.addEventListener("click", () => {
      els.sourceText.value = SAMPLE_TEXT;
      parseSource();
    });
    els.clearSourceButton.addEventListener("click", () => {
      els.sourceText.value = "";
    });

    els.csvFileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      importLoreKeeperCsv(await file.text());
      event.target.value = "";
    });

    els.queueFileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        if (!Array.isArray(items)) throw new Error("Invalid queue backup");
        state.items = items.map((item) => core.createItem(item));
        state.selectedId = state.items[0]?.id || "";
        saveState();
        render();
        toast(`Restored ${state.items.length} items`);
      } catch (error) {
        toast(error.message || "Restore failed");
      }
      event.target.value = "";
    });

    els.exportLoreBasicButton.addEventListener("click", () => {
      exportCsv("model_list_basic.csv", core.loreKeeperBasicRows(state.items), ["Model Name", "URL"]);
    });

    els.exportLoreFullButton.addEventListener("click", () => {
      exportCsv("model_list_full_lore.csv", core.loreKeeperFullRows(state.items), [
        "Model Name",
        "URL",
        "Alignment",
        "Abilities",
        "Origin",
        "Backstory",
        "Famous Storyline"
      ]);
    });

    els.exportGumroadButton.addEventListener("click", () => {
      exportCsv("models.csv", core.gumroadHelperRows(state.items), ["Folder", "PageURL"]);
    });

    els.exportModelBrowserButton.addEventListener("click", () => {
      exportCsv("modelbrowser_metadata_import.csv", core.modelBrowserRows(state.items), [
        "model_folder_id",
        "character_name",
        "origin_universe",
        "alignment",
        "model_type",
        "abilities",
        "origin_story",
        "backstory",
        "famous_storylines",
        "extra_info_for_query",
        "gumroad_url",
        "custom_Local Model Location",
        "custom_Custom notes"
      ]);
    });

    els.exportQueueButton.addEventListener("click", () => {
      downloadText("model-intake-queue.json", JSON.stringify({ items: state.items }, null, 2), "application/json;charset=utf-8");
      toast(`Backed up ${state.items.length} items`);
    });

    els.resetButton.addEventListener("click", () => {
      if (!confirm("Reset the queue in this app?")) return;
      state.items = [];
      state.selectedId = "";
      saveState();
      render();
      toast("Queue reset");
    });

    els.queueSearch.addEventListener("input", () => {
      state.search = els.queueSearch.value;
      renderTable();
    });

    els.statusFilter.addEventListener("change", () => {
      state.statusFilter = els.statusFilter.value;
      renderTable();
    });

    els.openSelectedButton.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      window.open(item.purchasedUrl || item.originalUrl, "_blank", "noopener");
    });

    els.markDownloadReadyButton.addEventListener("click", () => {
      updateSelected({ status: "download_ready" });
      toast("Marked download ready");
    });

    els.removeSelectedButton.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || !confirm(`Remove ${item.modelName}?`)) return;
      state.items = state.items.filter((row) => row.id !== item.id);
      state.selectedId = state.items[0]?.id || "";
      saveState();
      render();
      toast("Removed");
    });

    detailBindings.forEach(([elementKey, itemKey]) => {
      els[elementKey].addEventListener("input", () => {
        updateSelected({ [itemKey]: els[elementKey].value }, { partial: true });
      });
      els[elementKey].addEventListener("change", () => {
        updateSelected({ [itemKey]: els[elementKey].value });
      });
    });
  }

  loadState();
  wireEvents();
  render();
})();
