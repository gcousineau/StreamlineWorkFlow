const assert = require("assert");
const core = require("../src/core.js");

const sample = `1. Ozzy Osbourne Sculpture Scale 1/6 (450mm):
https://3dwicked.gumroad.com/l/OzzyOsbourneS/jgwjlmr

2. Iron Maiden Portrait Bust Scale 1/4 (297mm):
https://3dwicked.gumroad.com/l/IronMaidenPB/9u5kgkh`;

const parsed = core.parsePatreonText(sample);
assert.strictEqual(parsed.length, 2);
assert.strictEqual(parsed[0].modelName, "Ozzy Osbourne Sculpture");
assert.strictEqual(parsed[0].creator, "Wicked");
assert.strictEqual(parsed[1].modelName, "Iron Maiden Portrait Bust");

const csv = `Model Name,URL,Alignment,Abilities,Origin,Backstory,Famous Storyline
"Ozzy Osbourne Sculpture","https://3dwicked.gumroad.com/l/OzzyOsbourneS/jgwjlmr","Chaotic Neutral","Voice, stage presence","Birmingham","Black Sabbath","Blizzard of Ozz"`;
const rows = core.parseCsv(csv);
assert.strictEqual(rows.length, 1);
const item = core.itemFromLoreKeeperRow(rows[0]);
assert.strictEqual(item.alignment, "Chaotic Neutral");
assert.strictEqual(item.origin, "Birmingham");

const merged = core.mergeItems(parsed, [item]);
assert.strictEqual(merged.length, 2);
assert.strictEqual(merged[0].abilities, "Voice, stage presence");

const helperRows = core.gumroadHelperRows([
  { ...merged[0], purchasedUrl: "https://gumroad.com/d/example", targetFolder: "Ozzy Osbourne Sculpture" }
]);
assert.deepStrictEqual(helperRows, [
  { Folder: "Ozzy Osbourne Sculpture", PageURL: "https://gumroad.com/d/example" }
]);

console.log("core smoke tests passed");
