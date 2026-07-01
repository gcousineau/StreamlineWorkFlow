(function initCore(root) {
  const STATUS_NEEDS_PURCHASE = "needs_purchase";

  function sanitizeFolderName(value) {
    return String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 160);
  }

  function normalizeKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeUrlKey(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }

  function cleanModelName(rawName) {
    let name = String(rawName || "").trim();
    name = name.replace(/^\s*\d+\s*[\.)-]\s*/, "");
    name = name.replace(/\s*:\s*$/, "");
    name = name.replace(/\s+-\s+tested\s+and\s+ready\s+for\s+3d\s+printing.*$/i, "");
    name = name.replace(/\bscale\s+1\s*\/\s*\d+\b/gi, "");
    name = name.replace(/\bscale\s+\d+\s*\/\s*\d+\b/gi, "");
    name = name.replace(/\bscale\s+\d+\b/gi, "");
    name = name.replace(/\(\s*\d+(?:\.\d+)?\s*mm\s*\)/gi, "");
    name = name.replace(/\b\d+(?:\.\d+)?\s*mm\b/gi, "");
    name = name.replace(/\s+/g, " ").trim();
    return name || String(rawName || "").trim();
  }

  function inferCreator(url, fallbackText) {
    const source = `${url || ""} ${fallbackText || ""}`.toLowerCase();
    if (source.includes("3dwicked") || source.includes("wicked")) return "Wicked";
    if (source.includes("b3dserk")) return "B3DSERK";
    return "";
  }

  function inferSearchTerm(modelName) {
    return cleanModelName(modelName)
      .replace(/\b(portrait bust|bust portrait|sculpture|diorama|statue|bust|base|one piece)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function makeId(seed) {
    const base = normalizeKey(seed).replace(/\s+/g, "-") || "model";
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  function createItem(input) {
    const modelName = cleanModelName(input.modelName || input.name || "");
    const originalUrl = String(input.originalUrl || input.url || "").trim();
    const creator = input.creator || inferCreator(originalUrl, modelName);
    const purchasedUrl = String(input.purchasedUrl || input.pageUrl || "").trim();
    return {
      id: input.id || makeId(`${modelName}-${originalUrl}`),
      modelName,
      originalUrl,
      creator,
      status: input.status || (purchasedUrl ? "purchased" : STATUS_NEEDS_PURCHASE),
      purchasedUrl,
      targetFolder: sanitizeFolderName(input.targetFolder || modelName),
      contextHint: input.contextHint || "",
      alignment: input.alignment || "",
      abilities: input.abilities || "",
      origin: input.origin || "",
      backstory: input.backstory || "",
      famousStoryline: input.famousStoryline || input.famousStorylines || "",
      notes: input.notes || "",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function parsePatreonText(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const items = [];
    let pendingName = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const numbered = trimmed.match(/^\s*(\d+)\s*[\.)-]\s*(.+)$/);
      const urlMatch = trimmed.match(/https?:\/\/[^\s)]+/i);

      if (numbered && !urlMatch) {
        pendingName = numbered[2].trim();
        continue;
      }

      if (numbered && urlMatch) {
        const beforeUrl = numbered[2].slice(0, numbered[2].indexOf(urlMatch[0])).trim();
        items.push(createItem({ modelName: beforeUrl || numbered[2], originalUrl: urlMatch[0] }));
        pendingName = "";
        continue;
      }

      if (urlMatch && /gumroad\.com\/l\//i.test(urlMatch[0])) {
        const beforeUrl = trimmed.slice(0, trimmed.indexOf(urlMatch[0])).trim();
        items.push(createItem({ modelName: pendingName || beforeUrl || urlMatch[0], originalUrl: urlMatch[0] }));
        pendingName = "";
      }
    }

    return dedupeItems(items);
  }

  function dedupeItems(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
      const key = normalizeKey(`${item.modelName} ${item.originalUrl}`);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const src = String(text || "");

    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      const next = src[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        row.push(field);
        field = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(field);
        if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    row.push(field);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
    if (!rows.length) return [];

    const headers = rows.shift().map((h) => h.trim());
    return rows.map((cells) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] || "";
      });
      return record;
    });
  }

  function csvEscape(value) {
    const text = String(value == null ? "" : value);
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function toCsv(rows, headers) {
    const headerLine = headers.map(csvEscape).join(",");
    const body = rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","));
    return [headerLine].concat(body).join("\r\n");
  }

  function itemFromLoreKeeperRow(row) {
    const name = row["Model Name"] || row["Name"] || row["Folder"] || "";
    const url = row.URL || row.Url || row.url || row.PageURL || "";
    const item = createItem({
      modelName: name,
      originalUrl: url,
      purchasedUrl: row["Purchased URL"] || row.PageURL || "",
      contextHint: row["Context Hint"] || row["Origin Universe"] || "",
      alignment: row.Alignment || "",
      abilities: row.Abilities || "",
      origin: row.Origin || row["Origin Story"] || "",
      backstory: row.Backstory || "",
      famousStoryline: row["Famous Storyline"] || row["Famous Storylines"] || "",
      notes: row.Notes || ""
    });
    return item.modelName || item.originalUrl ? item : null;
  }

  function mergeItems(existing, incoming) {
    const merged = existing.map((item) => ({ ...item }));
    const indexByUrl = new Map();
    const indexByName = new Map();

    merged.forEach((item, index) => {
      const urlKey = normalizeUrlKey(item.originalUrl);
      const nameKey = normalizeKey(item.modelName);
      if (urlKey) indexByUrl.set(urlKey, index);
      if (nameKey) indexByName.set(nameKey, index);
    });

    for (const item of incoming) {
      const urlKey = normalizeUrlKey(item.originalUrl);
      const nameKey = normalizeKey(item.modelName);
      const existingIndex = urlKey && indexByUrl.has(urlKey) ? indexByUrl.get(urlKey) : indexByName.get(nameKey);

      if (existingIndex == null) {
        merged.push(item);
        continue;
      }

      const current = merged[existingIndex];
      const next = { ...current };
      Object.keys(item).forEach((key) => {
        if (key === "id" || key === "createdAt") return;
        if (item[key] && (!next[key] || key === "updatedAt")) next[key] = item[key];
      });
      if (item.purchasedUrl && current.status === STATUS_NEEDS_PURCHASE) next.status = "purchased";
      next.updatedAt = new Date().toISOString();
      merged[existingIndex] = next;
    }

    return merged;
  }

  function hasLore(item) {
    return ["alignment", "abilities", "origin", "backstory", "famousStoryline"].some((key) => {
      return String(item[key] || "").trim().length > 0;
    });
  }

  function loreScore(item) {
    return ["alignment", "abilities", "origin", "backstory", "famousStoryline"].reduce((count, key) => {
      return count + (String(item[key] || "").trim() ? 1 : 0);
    }, 0);
  }

  function buildMetadataCache(items) {
    const cache = {};
    for (const item of items) {
      if (!hasLore(item)) continue;
      cache[normalizeKey(`${item.modelName} ${item.contextHint}`)] = {
        alignment: item.alignment,
        abilities: item.abilities,
        origin: item.origin,
        backstory: item.backstory,
        famousStoryline: item.famousStoryline
      };
      cache[normalizeKey(inferSearchTerm(item.modelName))] = cache[normalizeKey(`${item.modelName} ${item.contextHint}`)];
    }
    return cache;
  }

  function applyMetadataCache(items, cache) {
    return items.map((item) => {
      if (hasLore(item)) return item;
      const keys = [
        normalizeKey(`${item.modelName} ${item.contextHint}`),
        normalizeKey(inferSearchTerm(item.modelName)),
        normalizeKey(item.modelName)
      ];
      const found = keys.map((key) => cache[key]).find(Boolean);
      return found ? { ...item, ...found, updatedAt: new Date().toISOString() } : item;
    });
  }

  function loreKeeperBasicRows(items) {
    return items.map((item) => ({
      "Model Name": item.modelName,
      URL: item.originalUrl
    }));
  }

  function loreKeeperFullRows(items) {
    return items.map((item) => ({
      "Model Name": item.modelName,
      URL: item.originalUrl,
      Alignment: item.alignment,
      Abilities: item.abilities,
      Origin: item.origin,
      Backstory: item.backstory,
      "Famous Storyline": item.famousStoryline
    }));
  }

  function gumroadHelperRows(items) {
    return items
      .filter((item) => String(item.purchasedUrl || "").trim())
      .map((item) => ({
        Folder: sanitizeFolderName(item.targetFolder || item.modelName),
        PageURL: item.purchasedUrl
      }));
  }

  function modelBrowserRows(items) {
    return items.map((item) => ({
      Description: sanitizeFolderName(item.targetFolder || item.modelName),
      Character: item.modelName,
      Origin: item.contextHint,
      "Extra Info for Query": inferSearchTerm(item.modelName),
      "Villian or Hero": item.alignment,
      Abilities: item.abilities,
      "Origin Story": item.origin,
      Backstory: item.backstory,
      "Famous Storylines": item.famousStoryline,
      "Gumroad URL": item.purchasedUrl || item.originalUrl
    }));
  }

  const api = {
    STATUS_NEEDS_PURCHASE,
    sanitizeFolderName,
    normalizeKey,
    normalizeUrlKey,
    cleanModelName,
    inferCreator,
    inferSearchTerm,
    createItem,
    parsePatreonText,
    parseCsv,
    toCsv,
    itemFromLoreKeeperRow,
    mergeItems,
    hasLore,
    loreScore,
    buildMetadataCache,
    applyMetadataCache,
    loreKeeperBasicRows,
    loreKeeperFullRows,
    gumroadHelperRows,
    modelBrowserRows
  };

  root.IntakeCore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
