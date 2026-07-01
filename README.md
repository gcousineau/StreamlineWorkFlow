# Model Intake Queue

Local intake app for Patreon/Gumroad 3D model drops.

Open `index.html` in Chrome or Edge. The app stores its queue in browser local storage and exports CSV files for the existing tools.

## Workflow

1. Paste a Patreon direct message or numbered Gumroad list.
2. Click `Parse`.
3. Export `Lore Basic` if you want to process metadata in LoreKeeper / AI Studio.
4. Import the returned `model_list_full_lore.csv`.
5. Open each queued Gumroad product, purchase manually, and paste the final `https://gumroad.com/d/...` URL into `Purchased URL`.
6. Export `Gumroad CSV` as `models.csv` for `C:\Projects\GumroadHelper`.
7. Run the existing GumroadHelper downloader.
8. Export `ModelBrowser CSV` when you want a metadata import file for `C:\Projects\ModelBrowserApp`.

## Files

- `index.html` - app shell
- `styles.css` - app styling
- `src/core.js` - parser, CSV, merge, and export logic
- `src/app.js` - browser UI and local storage
- `tests/core-smoke.cjs` - smoke test for parser and CSV logic

## Compatibility

LoreKeeper basic CSV:

```csv
Model Name,URL
```

LoreKeeper full CSV:

```csv
Model Name,URL,Alignment,Abilities,Origin,Backstory,Famous Storyline
```

GumroadHelper CSV:

```csv
Folder,PageURL
```

ModelBrowser metadata CSV:

```csv
Description,Character,Origin,Extra Info for Query,Villian or Hero,Abilities,Origin Story,Backstory,Famous Storylines,Gumroad URL
```
