"use strict";

// ============================================
// Reusable Windows XP Dialogs
// ============================================
// Modal dialogs with authentic XP chrome, focus trapping, focus restore,
// and Enter/Escape/Tab/access-key navigation. A single primitive
// (createDialog) backs message boxes, progress, properties, and the
// filesystem-backed Open/Save As dialogs, so every shell feature shares
// the same appearance and keyboard behavior. Pure definitions (button
// sets, access keys, byte formatting) are exported for Node tests.

(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.XPDialogs = api;
    }
})(typeof self !== "undefined" ? self : globalThis, function () {
    // ---- Pure definitions (no DOM, unit tested) ----

    const ICONS = ["info", "warning", "error", "question"];

    // Standard XP button sets. The first button is the default unless a
    // later one sets isDefault; isCancel marks the Escape/close result.
    const BUTTON_SETS = {
        ok: [
            { id: "ok", label: "OK", isDefault: true, isCancel: true }
        ],
        okCancel: [
            { id: "ok", label: "OK", isDefault: true },
            { id: "cancel", label: "Cancel", isCancel: true }
        ],
        yesNo: [
            { id: "yes", label: "&Yes", isDefault: true },
            { id: "no", label: "&No", isCancel: true }
        ],
        yesNoCancel: [
            { id: "yes", label: "&Yes", isDefault: true },
            { id: "no", label: "&No" },
            { id: "cancel", label: "Cancel", isCancel: true }
        ],
        retryCancel: [
            { id: "retry", label: "&Retry", isDefault: true },
            { id: "cancel", label: "Cancel", isCancel: true }
        ]
    };

    // "&Yes" -> { text: "Yes", key: "y" }. "&&" escapes a literal ampersand.
    const parseAccessKey = (label) => {
        const match = /&([^&])/.exec(label);
        return {
            text: label.replace(/&([^&])/g, "$1").replace(/&&/g, "&"),
            key: match ? match[1].toLowerCase() : null
        };
    };

    // XP-style byte formatting: "5 bytes", "1.50 KB (1,536 bytes)".
    const formatBytes = (bytes) => {
        if (!Number.isFinite(bytes) || bytes < 0) return "0 bytes";
        if (bytes === 1) return "1 byte";
        if (bytes < 1024) return `${bytes} bytes`;
        const units = ["KB", "MB", "GB"];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length) {
            value /= 1024;
            unit += 1;
        }
        const grouped = Math.round(bytes).toLocaleString("en-US");
        return `${value.toFixed(2)} ${units[unit - 1]} (${grouped} bytes)`;
    };

    const hasDOM = typeof document !== "undefined";
    const getFS = () => (typeof self !== "undefined" ? self : globalThis).VirtualFS;

    if (!hasDOM) {
        // Node: expose only the pure definitions for tests.
        return { ICONS, BUTTON_SETS, parseAccessKey, formatBytes };
    }

    // ---- Dialog stack and shared keyboard handling ----

    const BASE_Z_INDEX = 9000;
    const dialogStack = [];

    const FOCUSABLE = [
        "button", "input", "select", "textarea",
        "a[href]", '[tabindex]:not([tabindex="-1"])'
    ].join(", ");

    const focusableItems = (el) =>
        Array.from(el.querySelectorAll(FOCUSABLE))
            .filter((item) => !item.disabled && item.offsetParent !== null);

    const handleGlobalKeydown = (e) => {
        const top = dialogStack[dialogStack.length - 1];
        if (top) top.onKeydown(e);
    };

    // ---- Core primitive ----

    // Builds a modal dialog with XP window chrome. Options:
    //   title    - title bar text
    //   wide     - use the wider dialog variant (file dialogs)
    //   onCancel - Escape/title-close behavior (default: close with null)
    // Returns { el, body, close, onResult }.
    const createDialog = ({ title = "", wide = false, onCancel = null } = {}) => {
        const previouslyFocused = document.activeElement;

        const overlay = document.createElement("div");
        overlay.className = "xp-dialog-overlay";

        const el = document.createElement("div");
        el.className = `xp-window active xp-dialog${wide ? " xp-dialog-wide" : ""}`;
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-modal", "true");
        el.setAttribute("aria-label", title);

        const titleBar = document.createElement("div");
        titleBar.className = "title-bar";
        const titleText = document.createElement("span");
        titleText.className = "title-text";
        titleText.textContent = title;
        const titleButtons = document.createElement("div");
        titleButtons.className = "title-buttons";
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "tb-btn close-btn";
        closeBtn.title = "Close";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.addEventListener("click", () => dialog.cancel());
        titleButtons.appendChild(closeBtn);
        titleBar.append(titleText, titleButtons);

        const body = document.createElement("div");
        body.className = "dlg-body";

        el.append(titleBar, body);
        overlay.appendChild(el);

        let resultCallback = null;

        const dialog = {
            el,
            body,
            defaultButton: null,
            accessKeys: new Map(),
            onResult(callback) {
                resultCallback = callback;
            },
            close(result = null) {
                if (!dialogStack.includes(dialog)) return;
                dialogStack.splice(dialogStack.indexOf(dialog), 1);
                overlay.remove();
                if (!dialogStack.length) {
                    document.removeEventListener("keydown", handleGlobalKeydown, true);
                }
                if (previouslyFocused && previouslyFocused.isConnected) {
                    previouslyFocused.focus();
                }
                if (resultCallback) resultCallback(result);
            },
            cancel: onCancel || (() => dialog.close(null)),
            onKeydown(e) {
                if (e.key === "Tab") {
                    trapFocus(e);
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    dialog.cancel();
                    return;
                }
                if (e.key === "Enter") {
                    // Click the focused button, or the default button when
                    // focus is elsewhere. preventDefault suppresses the
                    // browser's own button activation to avoid double-fire.
                    const active = document.activeElement;
                    if (active && el.contains(active) && active.tagName === "BUTTON") {
                        e.preventDefault();
                        active.click();
                    } else if (active?.tagName !== "TEXTAREA" && dialog.defaultButton) {
                        e.preventDefault();
                        dialog.defaultButton.click();
                    }
                    return;
                }
                handleAccessKey(e);
            }
        };

        const trapFocus = (e) => {
            const items = focusableItems(el);
            if (!items.length) {
                e.preventDefault();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (e.shiftKey) {
                if (active === first || !el.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last || !el.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        };

        // Alt+key always works; the bare key works outside text fields.
        const handleAccessKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.key.length !== 1) return;
            const inTextField = /^(INPUT|TEXTAREA|SELECT)$/.test(
                document.activeElement?.tagName || ""
            );
            if (!e.altKey && inTextField) return;
            const button = dialog.accessKeys.get(e.key.toLowerCase());
            if (button && !button.disabled) {
                e.preventDefault();
                button.click();
            }
        };

        if (!dialogStack.length) {
            document.addEventListener("keydown", handleGlobalKeydown, true);
        }
        dialogStack.push(dialog);
        overlay.style.zIndex = BASE_Z_INDEX + dialogStack.length;
        document.body.appendChild(overlay);
        return dialog;
    };

    // ---- Shared building blocks ----

    const createDialogButton = ({ id, label, isDefault }, onChoose) => {
        const { text, key } = parseAccessKey(label);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `xp-btn${isDefault ? " default" : ""}`;
        button.dataset.action = id;
        const amp = label.indexOf("&");
        if (key && amp !== -1) {
            button.append(label.slice(0, amp));
            const underlined = document.createElement("u");
            underlined.textContent = label[amp + 1];
            button.append(underlined, label.slice(amp + 2));
        } else {
            button.textContent = text;
        }
        button.addEventListener("click", () => onChoose(id));
        return button;
    };

    // Register a button's access key (&X) so Alt+X / bare X activates it.
    const registerAccessKey = (dialog, button, label) => {
        const { key } = parseAccessKey(label);
        if (key && !dialog.accessKeys.has(key)) {
            dialog.accessKeys.set(key, button);
        }
    };

    const addButtonRow = (dialog, buttons) => {
        const row = document.createElement("div");
        row.className = "dlg-buttons";
        buttons.forEach((definition) => {
            const button = createDialogButton(definition, (id) => dialog.close(id));
            if (definition.isDefault) dialog.defaultButton = button;
            registerAccessKey(dialog, button, definition.label);
            row.appendChild(button);
        });
        dialog.body.appendChild(row);
        (dialog.defaultButton || row.querySelector("button"))?.focus();
    };

    // ---- Message boxes ----

    // XPDialogs.message({
    //   title, text, icon: info|warning|error|question,
    //   buttons: BUTTON_SETS.*, defaultButton: optional id override
    // }) -> Promise resolving with the chosen button id.
    const message = ({
        title = "Message",
        text = "",
        icon = "info",
        buttons = BUTTON_SETS.ok,
        defaultButton = null
    } = {}) => new Promise((resolve) => {
        const resolvedButtons = buttons.map((definition) => ({
            ...definition,
            isDefault: defaultButton
                ? definition.id === defaultButton
                : definition.isDefault
        }));
        const dialog = createDialog({
            title,
            onCancel: () => {
                const cancel = resolvedButtons.find((b) => b.isCancel)
                    || resolvedButtons.find((b) => b.isDefault);
                dialog.close(cancel ? cancel.id : null);
            }
        });
        dialog.onResult(resolve);

        const row = document.createElement("div");
        row.className = "dlg-message";
        if (ICONS.includes(icon)) {
            const iconEl = document.createElement("span");
            iconEl.className = `dlg-icon dlg-icon-${icon}`;
            iconEl.setAttribute("aria-hidden", "true");
            row.appendChild(iconEl);
        }
        const textEl = document.createElement("p");
        textEl.className = "dlg-text";
        textEl.textContent = text;
        row.appendChild(textEl);
        dialog.body.appendChild(row);

        addButtonRow(dialog, resolvedButtons);
    });

    const alert = (text, title = "Message", icon = "info") =>
        message({ title, text, icon, buttons: BUTTON_SETS.ok });

    const confirm = (text, title = "Confirm", icon = "question") =>
        message({ title, text, icon, buttons: BUTTON_SETS.yesNo })
            .then((result) => result === "yes");

    // ---- Progress dialog ----

    // XPDialogs.progress({ title, text, cancellable, onCancel }) ->
    //   { update(fraction, detail?), close() }
    const progress = ({
        title = "Progress",
        text = "",
        cancellable = false,
        onCancel = null
    } = {}) => {
        const dialog = createDialog({
            title,
            onCancel: () => {
                if (cancellable && onCancel) onCancel();
            }
        });

        const label = document.createElement("p");
        label.className = "dlg-text dlg-progress-text";
        label.textContent = text;

        const bar = document.createElement("div");
        bar.className = "xp-progress";
        bar.setAttribute("role", "progressbar");
        const fill = document.createElement("div");
        fill.className = "xp-progress-fill";
        bar.appendChild(fill);

        dialog.body.append(label, bar);

        if (cancellable) {
            const cancelBtn = createDialogButton(
                { id: "cancel", label: "Cancel" },
                () => {
                    cancelBtn.disabled = true;
                    if (onCancel) onCancel();
                }
            );
            const row = document.createElement("div");
            row.className = "dlg-buttons";
            row.appendChild(cancelBtn);
            dialog.body.appendChild(row);
        }

        return {
            el: dialog.el,
            update(fraction, detail) {
                const percent = Math.min(Math.max(fraction, 0), 1) * 100;
                fill.style.width = `${percent}%`;
                bar.setAttribute("aria-valuenow", String(Math.round(percent)));
                if (detail !== undefined) label.textContent = detail;
            },
            close: () => dialog.close()
        };
    };

    // ---- Icon helpers shared by Properties and the file dialogs ----

    const fs = () => getFS();

    const createNodeIcon = (node) => {
        const icon = document.createElement("span");
        icon.className = "dlg-node-icon";
        if (node.id === fs().DRIVE_C) {
            icon.classList.add("drive-icon");
        } else if (node.id === fs().DRIVE_D) {
            icon.classList.add("disc-icon");
        } else if (node.type === "folder") {
            const image = document.createElement("img");
            image.src = "assets/xp/icons/mydocuments.png";
            image.alt = "";
            icon.appendChild(image);
        } else {
            icon.classList.add("dlg-node-icon-file");
            icon.textContent = "📄";
        }
        return icon;
    };

    const describeNodeType = (node) => {
        if (node.id === fs().DRIVE_C) return "Local Disk";
        if (node.id === fs().DRIVE_D) return "CD Drive";
        if (node.type === "folder") return "File folder";
        if (!node.ext) return "File";
        return `${node.ext.replace(".", "").toUpperCase()} File`;
    };

    // ---- Properties dialog ----

    // XPDialogs.properties(nodeId) -> Promise resolving when closed.
    const properties = (nodeId) => new Promise((resolve) => {
        const node = fs()?.getNode(nodeId);
        if (!node) {
            resolve(null);
            return;
        }

        const dialog = createDialog({
            title: `${node.name} Properties`,
            onCancel: () => dialog.close("ok")
        });
        dialog.onResult(resolve);

        const header = document.createElement("div");
        header.className = "dlg-props-header";
        const name = document.createElement("span");
        name.className = "dlg-props-name";
        name.textContent = node.name;
        header.append(createNodeIcon(node), name);

        const table = document.createElement("dl");
        table.className = "dlg-props-table";
        const addRow = (label, value) => {
            const dt = document.createElement("dt");
            dt.textContent = label;
            const dd = document.createElement("dd");
            dd.textContent = value;
            table.append(dt, dd);
        };

        addRow("Type:", describeNodeType(node));
        if (node.parent) {
            const parent = fs().getNode(node.parent);
            addRow("Location:", parent ? fs().getPath(parent.id) : "");
        }
        addRow("Size:", formatBytes(fs().getSize(node.id)));
        if (node.type === "folder") {
            let files = 0;
            let folders = 0;
            const pending = [node.id];
            while (pending.length) {
                fs().getChildren(pending.pop()).forEach((child) => {
                    if (child.type === "folder") {
                        folders += 1;
                        pending.push(child.id);
                    } else {
                        files += 1;
                    }
                });
            }
            addRow("Contains:", `${files} files, ${folders} folders`);
        }
        const formatDate = (ts) => new Date(ts).toLocaleString();
        addRow("Created:", formatDate(node.created));
        addRow("Modified:", formatDate(node.modified));

        dialog.body.append(header, table);
        addButtonRow(dialog, BUTTON_SETS.ok);
    });

    // ---- Open / Save As dialogs ----

    const findChildByName = (folderId, name) => {
        const wanted = String(name).trim().toLowerCase();
        if (!wanted) return null;
        return fs().getChildren(folderId)
            .find((child) => child.name.toLowerCase() === wanted) || null;
    };

    // Shared folder browser. onAccept({ folderId, name }) validates the
    // current entry and returns false (or Promise<false>) to keep the
    // dialog open, or any other value (or Promise of one) to close the
    // dialog and resolve with that value. Cancel resolves with null.
    const browseFiles = ({
        title,
        startFolder = null,
        filter = null,
        initialName = "",
        acceptLabel = "&Open",
        onAccept
    }) => new Promise((resolve) => {
        let currentFolderId = startFolder || fs().MY_DOCUMENTS;
        if (!fs().getNode(currentFolderId)) currentFolderId = fs().MY_DOCUMENTS;

        const dialog = createDialog({
            title,
            wide: true,
            onCancel: () => dialog.close(null)
        });
        dialog.onResult(resolve);

        // Toolbar: Up one level + current path.
        const toolbar = document.createElement("div");
        toolbar.className = "dlg-file-toolbar";
        const upBtn = createDialogButton({ id: "up", label: "&Up" }, () => {
            const folder = fs().getNode(currentFolderId);
            if (folder && folder.parent) {
                currentFolderId = folder.parent;
                renderList();
            }
        });
        const pathLabel = document.createElement("span");
        pathLabel.className = "dlg-file-path";
        toolbar.append(upBtn, pathLabel);

        // File list.
        const list = document.createElement("div");
        list.className = "dlg-file-list";
        list.setAttribute("role", "listbox");

        // Filename field.
        const nameRow = document.createElement("div");
        nameRow.className = "dlg-file-name-row";
        const nameLabel = document.createElement("label");
        nameLabel.textContent = "File &name:";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "xp-input";
        nameInput.value = initialName;
        nameLabel.htmlFor = nameInput.id = "dlg-file-name";
        nameRow.append(nameLabel, nameInput);

        dialog.body.append(toolbar, list, nameRow);

        const matchesFilter = (node) =>
            node.type === "folder" || !filter || filter.includes(node.ext);

        const accept = () => {
            const context = { folderId: currentFolderId, name: nameInput.value.trim() };
            Promise.resolve(onAccept(context)).then((result) => {
                if (result !== false) dialog.close(result ?? null);
            });
        };

        const renderList = () => {
            const folder = fs().getNode(currentFolderId);
            pathLabel.textContent = fs().getPath(folder.id);
            upBtn.disabled = !folder.parent;
            list.innerHTML = "";
            fs().getChildren(folder.id)
                .filter(matchesFilter)
                .sort((a, b) => (
                    a.type === b.type
                        ? a.name.localeCompare(b.name)
                        : a.type === "folder" ? -1 : 1
                ))
                .forEach((child) => {
                    const item = document.createElement("button");
                    item.type = "button";
                    item.className = "dlg-file-item";
                    item.setAttribute("role", "option");
                    const label = document.createElement("span");
                    label.textContent = child.name;
                    item.append(createNodeIcon(child), label);
                    item.addEventListener("click", () => {
                        list.querySelectorAll(".selected").forEach((el) => {
                            el.classList.remove("selected");
                        });
                        item.classList.add("selected");
                        if (child.type === "file") nameInput.value = child.name;
                    });
                    item.addEventListener("dblclick", () => {
                        if (child.type === "folder") {
                            currentFolderId = child.id;
                            renderList();
                        } else {
                            nameInput.value = child.name;
                            accept();
                        }
                    });
                    list.appendChild(item);
                });
        };

        // Accept / Cancel row (Accept is validated, Cancel closes).
        const row = document.createElement("div");
        row.className = "dlg-buttons";
        const acceptBtn = createDialogButton(
            { id: "accept", label: acceptLabel, isDefault: true },
            accept
        );
        const cancelBtn = createDialogButton(
            { id: "cancel", label: "Cancel" },
            () => dialog.close(null)
        );
        row.append(acceptBtn, cancelBtn);
        dialog.body.appendChild(row);
        dialog.defaultButton = acceptBtn;
        registerAccessKey(dialog, acceptBtn, acceptLabel);
        registerAccessKey(dialog, upBtn, "&Up");

        renderList();
        nameInput.focus();
        nameInput.select();
    });

    // XPDialogs.openFile({ title, startFolder, filter }) ->
    //   Promise resolving with the chosen node, or null on cancel.
    const openFile = ({
        title = "Open",
        startFolder = null,
        filter = null
    } = {}) => browseFiles({
        title,
        startFolder,
        filter,
        acceptLabel: "&Open",
        onAccept: ({ folderId, name }) => {
            const node = findChildByName(folderId, name);
            if (node && node.type === "file") return node;
            message({
                title,
                text: `Cannot find the "${name}" file.\nCheck the file name and try again.`,
                icon: "error",
                buttons: BUTTON_SETS.ok
            });
            return false;
        }
    });

    // XPDialogs.saveFile({ title, startFolder, defaultName, filter }) ->
    //   Promise resolving with { parentId, name, existingId }, or null.
    const saveFile = ({
        title = "Save As",
        startFolder = null,
        defaultName = "",
        filter = null
    } = {}) => browseFiles({
        title,
        startFolder,
        filter,
        initialName: defaultName,
        acceptLabel: "&Save",
        onAccept: ({ folderId, name }) => {
            if (!name) return false;
            const existing = findChildByName(folderId, name);
            const result = {
                parentId: folderId,
                name,
                existingId: existing ? existing.id : null
            };
            if (!existing) return result;
            return message({
                title: "Confirm Save As",
                text: `${name} already exists.\nDo you want to replace it?`,
                icon: "warning",
                buttons: BUTTON_SETS.yesNo,
                defaultButton: "no"
            }).then((answer) => (answer === "yes" ? result : false));
        }
    });

    return {
        ICONS,
        BUTTON_SETS,
        parseAccessKey,
        formatBytes,
        createDialog,
        createDialogButton,
        addButtonRow,
        message,
        alert,
        confirm,
        progress,
        properties,
        openFile,
        saveFile
    };
});
