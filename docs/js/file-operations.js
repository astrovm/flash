"use strict";

// ============================================
// Shared Virtual Filesystem Operations
// ============================================
// Desktop, Explorer, and future XP applications use this small service for
// mutations instead of each maintaining its own clipboard or delete rules.

(function (root, factory) {
    const filesystem = (root && root.VirtualFS)
        || (typeof module !== "undefined" && module.exports
            ? require("./filesystem.js")
            : null);
    const api = factory(filesystem);
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.FileOperations = api;
    }
})(typeof self !== "undefined" ? self : globalThis, function (fs) {
    if (!fs) throw new Error("FileOperations requires VirtualFS");

    let clipboard = null;
    const listeners = new Set();

    const snapshotClipboard = () => (clipboard ? {
        mode: clipboard.mode,
        ids: [...clipboard.ids]
    } : null);

    const getState = () => ({ clipboard: snapshotClipboard() });

    const notify = (event) => {
        const state = getState();
        listeners.forEach((listener) => {
            try {
                listener(state, event);
            } catch (error) {
                console.error("FileOperations listener error:", error);
            }
        });
    };

    const subscribe = (listener) => {
        if (typeof listener !== "function") {
            throw new Error("FileOperations: listener must be a function");
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    // A filesystem mutation can come from any shell surface. Forward those
    // changes so views using this service stay synchronized as well.
    fs.subscribe(() => notify({ type: "filesystem-change" }));

    const requireFolder = (id) => {
        const node = fs.getNode(id);
        if (!node || node.type !== "folder") {
            throw new Error("FileOperations: destination must be a folder");
        }
        return node;
    };

    const getTopLevelIds = (ids) => {
        if (!Array.isArray(ids)) {
            throw new Error("FileOperations: items must be an array");
        }
        const uniqueIds = [...new Set(ids)];
        if (!uniqueIds.length) {
            throw new Error("FileOperations: select at least one item");
        }
        uniqueIds.forEach((id) => {
            if (!fs.getNode(id)) throw new Error(`FileOperations: item "${id}" was not found`);
        });
        return uniqueIds.filter((id) => !uniqueIds.some((otherId) => (
            otherId !== id && fs.isDescendantOf(otherId, id)
        )));
    };

    const assertMovableTo = (ids, destinationId) => {
        requireFolder(destinationId);
        ids.forEach((id) => {
            const node = fs.getNode(id);
            if (node.protected) {
                throw new Error(`FileOperations: cannot move "${node.name}": access is denied`);
            }
            if (id === destinationId || fs.isDescendantOf(id, destinationId)) {
                throw new Error(`FileOperations: cannot move "${node.name}" into itself`);
            }
        });
    };

    const assertCopyableTo = (ids, destinationId) => {
        requireFolder(destinationId);
        ids.forEach((id) => {
            const node = fs.getNode(id);
            if (id === destinationId || fs.isDescendantOf(id, destinationId)) {
                throw new Error(`FileOperations: cannot copy "${node.name}" into itself`);
            }
        });
    };

    const setClipboard = (mode, ids) => {
        clipboard = { mode, ids: getTopLevelIds(ids) };
        notify({ type: "clipboard", mode });
        return snapshotClipboard();
    };

    const copy = (ids) => setClipboard("copy", ids);

    const cut = (ids) => {
        const topLevelIds = getTopLevelIds(ids);
        topLevelIds.forEach((id) => {
            const node = fs.getNode(id);
            if (node.protected) {
                throw new Error(`FileOperations: cannot cut "${node.name}": access is denied`);
            }
        });
        clipboard = { mode: "cut", ids: topLevelIds };
        notify({ type: "clipboard", mode: "cut" });
        return snapshotClipboard();
    };

    const canPaste = (destinationId) => {
        if (!clipboard) return false;
        try {
            const ids = getTopLevelIds(clipboard.ids);
            if (clipboard.mode === "cut") assertMovableTo(ids, destinationId);
            else assertCopyableTo(ids, destinationId);
            return true;
        } catch (error) {
            return false;
        }
    };

    const paste = (destinationId) => {
        if (!clipboard) throw new Error("FileOperations: clipboard is empty");
        const ids = getTopLevelIds(clipboard.ids);
        const mode = clipboard.mode;
        if (mode === "cut") assertMovableTo(ids, destinationId);
        else assertCopyableTo(ids, destinationId);

        // VirtualFS deduplicates conflicts deterministically. All validation
        // happens before mutations so ordinary paste failures preserve state.
        const results = mode === "cut"
            ? ids.map((id) => fs.move(id, destinationId))
            : ids.map((id) => fs.copy(id, destinationId));
        if (mode === "cut") {
            clipboard = null;
            notify({ type: "clipboard", mode: null });
        }
        notify({ type: "paste", mode, destinationId, ids: results.map((node) => node.id) });
        return results;
    };

    const createFolder = (parentId, name) => fs.createFolder(parentId, name);
    const createFile = (parentId, name, options = {}) => fs.createFile(parentId, name, options);
    const rename = (id, name) => fs.rename(id, name);

    const removeToBin = (ids) => {
        const topLevelIds = getTopLevelIds(ids);
        topLevelIds.forEach((id) => {
            const node = fs.getNode(id);
            if (node.protected || fs.isInRecycleBin(id)) {
                throw new Error(`FileOperations: cannot delete "${node.name}" to the Recycle Bin`);
            }
        });
        topLevelIds.forEach((id) => fs.remove(id));
        return topLevelIds;
    };

    const permanentlyDelete = (ids) => {
        const topLevelIds = getTopLevelIds(ids);
        topLevelIds.forEach((id) => {
            const node = fs.getNode(id);
            if (!fs.isInRecycleBin(id) || node.protected) {
                throw new Error(`FileOperations: "${node.name}" is not deletable from the Recycle Bin`);
            }
        });
        topLevelIds.forEach((id) => fs.destroy(id));
        return topLevelIds;
    };

    const restore = (ids) => {
        const topLevelIds = getTopLevelIds(ids);
        topLevelIds.forEach((id) => {
            if (!fs.isInRecycleBin(id)) {
                throw new Error("FileOperations: only Recycle Bin items can be restored");
            }
        });
        return topLevelIds.map((id) => fs.restore(id));
    };

    const emptyRecycleBin = () => fs.emptyRecycleBin();

    const resetForTests = () => {
        clipboard = null;
        listeners.clear();
    };

    return {
        subscribe,
        getState,
        getClipboard: snapshotClipboard,
        getTopLevelIds,
        canPaste,
        copy,
        cut,
        paste,
        createFolder,
        createFile,
        rename,
        removeToBin,
        permanentlyDelete,
        restore,
        emptyRecycleBin,
        resetForTests
    };
});
