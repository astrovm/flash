"use strict";

// Node test suite for docs/js/dialogs.js pure definitions, driven by
// tests/test_dialogs.py. Exits non-zero on the first failed assertion.

const assert = require("assert");

const dialogs = require("../docs/js/dialogs.js");

// ---- DOM-free exports only under Node ----
assert.strictEqual(typeof dialogs.message, "undefined", "DOM APIs hidden under Node");
assert.strictEqual(typeof dialogs.openFile, "undefined", "DOM APIs hidden under Node");

// ---- Icon variants ----
["info", "warning", "error", "question"].forEach((icon) => {
    assert.ok(dialogs.ICONS.includes(icon), `icon variant: ${icon}`);
});

// ---- Button sets follow XP conventions ----
const sets = dialogs.BUTTON_SETS;
assert.deepStrictEqual(Object.keys(sets).sort(), [
    "ok", "okCancel", "retryCancel", "yesNo", "yesNoCancel"
]);
Object.entries(sets).forEach(([name, buttons]) => {
    assert.strictEqual(
        buttons.filter((b) => b.isDefault).length,
        1,
        `${name}: exactly one default button`
    );
    buttons.forEach((b) => {
        assert.ok(b.id && b.label, `${name}: every button has an id and label`);
    });
});
assert.ok(sets.ok[0].isCancel, "OK-only boxes close on Escape");
assert.ok(sets.okCancel.find((b) => b.id === "cancel").isCancel);
assert.ok(sets.yesNo.find((b) => b.id === "no").isCancel);
assert.ok(!sets.yesNo.find((b) => b.id === "yes").isCancel);
assert.ok(sets.retryCancel.find((b) => b.id === "cancel").isCancel);

// ---- Access keys ----
assert.deepStrictEqual(dialogs.parseAccessKey("&Yes"), { text: "Yes", key: "y" });
assert.deepStrictEqual(dialogs.parseAccessKey("&No"), { text: "No", key: "n" });
assert.deepStrictEqual(dialogs.parseAccessKey("&Retry"), { text: "Retry", key: "r" });
assert.deepStrictEqual(dialogs.parseAccessKey("F&avorites"), {
    text: "Favorites",
    key: "a"
});
assert.deepStrictEqual(dialogs.parseAccessKey("Cancel"), { text: "Cancel", key: null });

// ---- Byte formatting ----
assert.strictEqual(dialogs.formatBytes(0), "0 bytes");
assert.strictEqual(dialogs.formatBytes(1), "1 byte");
assert.strictEqual(dialogs.formatBytes(5), "5 bytes");
assert.strictEqual(dialogs.formatBytes(1023), "1023 bytes");
assert.strictEqual(dialogs.formatBytes(1536), "1.50 KB (1,536 bytes)");
assert.strictEqual(dialogs.formatBytes(1048576), "1.00 MB (1,048,576 bytes)");
assert.strictEqual(dialogs.formatBytes(-1), "0 bytes");
assert.strictEqual(dialogs.formatBytes(NaN), "0 bytes");

console.log("dialog tests passed");
