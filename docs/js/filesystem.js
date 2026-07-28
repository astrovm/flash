"use strict";

// ============================================
// Persistent Virtual Filesystem
// ============================================
// A flat node-map filesystem for the Windows XP shell. Every folder and
// file has a stable ID, a name, a type, a parent, timestamps, and a size.
// Metadata and user-created content persist between sessions through
// browser storage. The module also works under Node for testing, using
// an in-memory storage fallback.

(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.VirtualFS = api;
    }
})(typeof self !== "undefined" ? self : globalThis, function () {
    const STORAGE_KEY = "virtualFileSystem";
    const FS_VERSION = 1;

    const WELL_KNOWN = {
        MY_COMPUTER: "my-computer",
        DRIVE_C: "drive-c",
        DRIVE_D: "drive-d",
        DRIVE_F: "drive-f",
        DOCUMENTS_AND_SETTINGS: "documents-and-settings",
        USER_PROFILE: "user-profile",
        DESKTOP: "desktop",
        MY_DOCUMENTS: "my-documents",
        MY_PICTURES: "my-pictures",
        MY_MUSIC: "my-music",
        RECYCLE_BIN: "recycle-bin"
    };

    // ---- Storage (localStorage in the browser, in-memory under Node) ----

    const storage = (() => {
        try {
            if (typeof localStorage !== "undefined") {
                const probe = "__vfs_probe__";
                localStorage.setItem(probe, "1");
                localStorage.removeItem(probe);
                return localStorage;
            }
        } catch (error) { /* localStorage unavailable: use memory storage */ }
        const memory = new Map();
        return {
            getItem: (key) => (memory.has(key) ? memory.get(key) : null),
            setItem: (key, value) => memory.set(key, String(value)),
            removeItem: (key) => memory.delete(key)
        };
    })();

    let nodes = {};
    const listeners = new Set();
    const fileTypeHandlers = new Map();
    let folderHandler = null;

    const now = () => Date.now();

    const generateId = () => (
        `f${now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    );

    const isFolder = (node) => !!node && node.type === "folder";

    const extractExtension = (name) => {
        const dot = String(name).lastIndexOf(".");
        return dot > 0 ? String(name).slice(dot).toLowerCase() : "";
    };

    // Windows disallows these characters in file and folder names, along
    // with DOS device names (even when they have an extension). Keep this
    // check in the filesystem rather than duplicating it in each shell view.
    const INVALID_NAME_CHARACTERS = /[<>:"/\\\\|?*\u0000-\u001f]/;
    const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

    const validateName = (name) => {
        if (typeof name !== "string" && typeof name !== "number") {
            throw new Error("VirtualFS: a name is required");
        }

        const rawName = String(name);
        const normalizedName = rawName.trim();
        if (!normalizedName) {
            throw new Error("VirtualFS: a name is required");
        }
        if (INVALID_NAME_CHARACTERS.test(rawName)) {
            throw new Error(`VirtualFS: "${rawName}" contains invalid characters`);
        }
        if (/[.\s]$/.test(rawName)) {
            throw new Error(`VirtualFS: "${rawName}" cannot end with a period or space`);
        }
        if (normalizedName === "." || normalizedName === "..") {
            throw new Error(`VirtualFS: "${rawName}" is a reserved name`);
        }

        const baseName = normalizedName.split(".")[0].trimEnd();
        if (RESERVED_DEVICE_NAMES.test(baseName)) {
            throw new Error(`VirtualFS: "${rawName}" is a reserved device name`);
        }
        return normalizedName;
    };

    // ---- Seed ----

    const seedNodes = () => {
        const timestamp = now();
        const seeded = {};
        const folder = (id, name, parent) => {
            seeded[id] = {
                id,
                name,
                type: "folder",
                parent,
                children: [],
                created: timestamp,
                modified: timestamp,
                size: 0,
                protected: true,
                ext: "",
                content: "",
                app: null,
                originalParent: null
            };
        };

        folder(WELL_KNOWN.MY_COMPUTER, "My Computer", null);
        folder(WELL_KNOWN.DRIVE_C, "Local Disk (C:)", WELL_KNOWN.MY_COMPUTER);
        folder(WELL_KNOWN.DRIVE_D, "Local Disk (D:)", WELL_KNOWN.MY_COMPUTER);
        folder(WELL_KNOWN.DRIVE_F, "Removable Device (F:)", WELL_KNOWN.MY_COMPUTER);
        folder(
            WELL_KNOWN.DOCUMENTS_AND_SETTINGS,
            "Documents and Settings",
            WELL_KNOWN.DRIVE_C
        );
        folder(WELL_KNOWN.USER_PROFILE, "astro", WELL_KNOWN.DOCUMENTS_AND_SETTINGS);
        folder(WELL_KNOWN.DESKTOP, "Desktop", WELL_KNOWN.USER_PROFILE);
        folder(WELL_KNOWN.MY_DOCUMENTS, "My Documents", WELL_KNOWN.USER_PROFILE);
        folder(WELL_KNOWN.MY_PICTURES, "My Pictures", WELL_KNOWN.MY_DOCUMENTS);
        folder(WELL_KNOWN.MY_MUSIC, "My Music", WELL_KNOWN.MY_DOCUMENTS);
        folder(WELL_KNOWN.RECYCLE_BIN, "Recycle Bin", null);

        Object.values(seeded).forEach((node) => {
            if (node.parent) {
                seeded[node.parent].children.push(node.id);
            }
        });
        return seeded;
    };

    // Guarantee the protected system structure exists even if stored data
    // is stale or was tampered with.
    const healSeed = () => {
        const seeded = seedNodes();
        Object.values(seeded).forEach((seedNode) => {
            const existing = nodes[seedNode.id];
            if (!existing) {
                nodes[seedNode.id] = seedNode;
                const parent = nodes[seedNode.parent];
                if (parent && !parent.children.includes(seedNode.id)) {
                    parent.children.push(seedNode.id);
                }
                return;
            }
            existing.type = "folder";
            existing.name = seedNode.name;
            existing.protected = true;
            existing.parent = seedNode.parent;
            existing.children = Array.isArray(existing.children)
                ? existing.children.filter((childId) => nodes[childId])
                : [];
        });
    };

    // ---- Persistence ----

    const save = () => {
        try {
            storage.setItem(
                STORAGE_KEY,
                JSON.stringify({ version: FS_VERSION, nodes })
            );
        } catch (error) {
            console.error("VirtualFS: failed to persist filesystem:", error);
        }
    };

    const isValidData = (data) => (
        data
        && data.version === FS_VERSION
        && data.nodes
        && typeof data.nodes === "object"
    );

    const load = () => {
        let parsed = null;
        try {
            const raw = storage.getItem(STORAGE_KEY);
            parsed = raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.error("VirtualFS: failed to read stored filesystem:", error);
        }
        nodes = isValidData(parsed) ? parsed.nodes : seedNodes();
        healSeed();
    };

    const emitChange = () => {
        save();
        listeners.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                console.error("VirtualFS listener error:", error);
            }
        });
    };

    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    // ---- Lookup ----

    const getNode = (id) => nodes[id] || null;

    const getParent = (id) => (nodes[id] ? nodes[nodes[id].parent] || null : null);

    const getChildren = (id) => (
        nodes[id]
            ? nodes[id].children
                .map((childId) => nodes[childId])
                .filter(Boolean)
            : []
    );

    const findChild = (parentId, name) => (
        getChildren(parentId).find(
            (child) => child.name.toLowerCase() === String(name).toLowerCase()
        ) || null
    );

    const getPath = (id) => {
        const node = nodes[id];
        if (!node) return null;
        if (id === WELL_KNOWN.MY_COMPUTER) return "My Computer";
        if (id === WELL_KNOWN.DRIVE_C) return "C:\\";
        if (id === WELL_KNOWN.DRIVE_D) return "D:\\";
        if (id === WELL_KNOWN.DRIVE_F) return "F:\\";
        if (!node.parent || !nodes[node.parent]) return node.name;
        const parentPath = getPath(node.parent);
        if (parentPath === null) return node.name;
        const separator = parentPath.endsWith("\\") ? "" : "\\";
        return `${parentPath}${separator}${node.name}`;
    };

    const resolvePath = (path) => {
        if (typeof path !== "string" || !path.trim()) return null;
        const trimmed = path.trim();
        if (/^my computer$/i.test(trimmed)) return WELL_KNOWN.MY_COMPUTER;
        if (/^recycle bin$/i.test(trimmed)) return WELL_KNOWN.RECYCLE_BIN;

        const segments = trimmed
            .replace(/\//g, "\\")
            .split("\\")
            .map((segment) => segment.trim())
            .filter(Boolean);
        if (!segments.length) return null;

        let currentId;
        if (/^[cdf]:$/i.test(segments[0])) {
            currentId = {
                c: WELL_KNOWN.DRIVE_C,
                d: WELL_KNOWN.DRIVE_D,
                f: WELL_KNOWN.DRIVE_F
            }[segments[0][0].toLowerCase()];
            segments.shift();
        } else {
            currentId = WELL_KNOWN.MY_COMPUTER;
        }

        for (const segment of segments) {
            const match = findChild(currentId, segment);
            if (!match) return null;
            currentId = match.id;
        }
        return currentId;
    };

    const isDescendantOf = (ancestorId, id) => {
        let current = nodes[id];
        while (current) {
            if (current.id === ancestorId) return true;
            current = current.parent ? nodes[current.parent] : null;
        }
        return false;
    };

    const isInRecycleBin = (id) => (
        !!nodes[id] && isDescendantOf(WELL_KNOWN.RECYCLE_BIN, id)
    );

    const isProtected = (id) => !!nodes[id] && !!nodes[id].protected;

    const getSize = (id) => {
        const node = nodes[id];
        if (!node) return 0;
        if (node.type === "file") {
            return Number.isFinite(node.size) ? node.size : 0;
        }
        return node.children.reduce((total, childId) => total + getSize(childId), 0);
    };

    // ---- Name deduplication ----

    const dedupeName = (parentId, desiredName, copyStyle = false) => {
        const names = new Set(
            getChildren(parentId).map((child) => child.name.toLowerCase())
        );
        if (!names.has(desiredName.toLowerCase())) return desiredName;

        if (copyStyle) {
            let counter = 1;
            let candidate = `Copy of ${desiredName}`;
            while (names.has(candidate.toLowerCase())) {
                counter += 1;
                candidate = `Copy (${counter}) of ${desiredName}`;
            }
            return candidate;
        }

        const dot = desiredName.lastIndexOf(".");
        const base = dot > 0 ? desiredName.slice(0, dot) : desiredName;
        const extension = dot > 0 ? desiredName.slice(dot) : "";
        let counter = 2;
        let candidate = `${base} (${counter})${extension}`;
        while (names.has(candidate.toLowerCase())) {
            counter += 1;
            candidate = `${base} (${counter})${extension}`;
        }
        return candidate;
    };

    // ---- Mutations ----

    const touch = (id) => {
        if (nodes[id]) {
            nodes[id].modified = now();
        }
    };

    const requireNode = (id) => {
        const node = nodes[id];
        if (!node) {
            throw new Error(`VirtualFS: item "${id}" not found`);
        }
        return node;
    };

    const requireFolder = (id) => {
        const node = requireNode(id);
        if (!isFolder(node)) {
            throw new Error(`VirtualFS: "${node.name}" is not a folder`);
        }
        return node;
    };

    const detach = (node) => {
        const parent = nodes[node.parent];
        if (parent) {
            parent.children = parent.children.filter((childId) => childId !== node.id);
            touch(parent.id);
        }
    };

    const createNode = (parentId, name, type, options = {}) => {
        const parent = requireFolder(parentId);
        const validName = validateName(name);
        const timestamp = now();
        const node = {
            id: generateId(),
            name: dedupeName(parentId, validName),
            type,
            parent: parentId,
            children: [],
            created: timestamp,
            modified: timestamp,
            size: 0,
            protected: !!options.protected,
            ext: type === "file"
                ? (options.ext || extractExtension(validName))
                : "",
            content: type === "file" ? String(options.content ?? "") : "",
            app: options.app || null,
            originalParent: null
        };
        if (type === "file") {
            node.size = Number.isFinite(options.size)
                ? options.size
                : node.content.length;
        }
        nodes[node.id] = node;
        parent.children.push(node.id);
        touch(parentId);
        emitChange();
        return node;
    };

    const createFolder = (parentId, name, options) => (
        createNode(parentId, name, "folder", options)
    );

    const createFile = (parentId, name, options) => (
        createNode(parentId, name, "file", options)
    );

    const rename = (id, newName) => {
        const node = requireNode(id);
        if (node.protected) {
            throw new Error(`Cannot rename "${node.name}": access is denied`);
        }
        const validName = validateName(newName);
        node.name = node.parent
            ? dedupeName(node.parent, validName)
            : validName;
        if (node.type === "file") {
            node.ext = extractExtension(node.name);
        }
        touch(id);
        if (node.parent) touch(node.parent);
        emitChange();
        return node;
    };

    const move = (id, targetParentId) => {
        const node = requireNode(id);
        const target = requireFolder(targetParentId);
        if (node.protected) {
            throw new Error(`Cannot move "${node.name}": access is denied`);
        }
        if (id === targetParentId || isDescendantOf(id, targetParentId)) {
            throw new Error(`Cannot move "${node.name}" into itself`);
        }
        if (node.parent === targetParentId) return node;

        detach(node);
        node.name = dedupeName(targetParentId, node.name);
        node.parent = targetParentId;
        target.children.push(id);
        touch(id);
        touch(targetParentId);
        emitChange();
        return node;
    };

    const copy = (id, targetParentId) => {
        const node = requireNode(id);
        const target = requireFolder(targetParentId);
        if (id === targetParentId || isDescendantOf(id, targetParentId)) {
            throw new Error(`Cannot copy "${node.name}" into itself`);
        }

        const cloneRecursive = (sourceId, parentId, forcedName) => {
            const source = nodes[sourceId];
            const timestamp = now();
            const clone = {
                ...source,
                id: generateId(),
                name: forcedName || dedupeName(parentId, source.name),
                parent: parentId,
                children: [],
                created: timestamp,
                modified: timestamp,
                protected: false
            };
            nodes[clone.id] = clone;
            nodes[parentId].children.push(clone.id);
            source.children.forEach((childId) => cloneRecursive(childId, clone.id));
            return clone;
        };

        const topName = node.parent === targetParentId
            ? dedupeName(targetParentId, node.name, true)
            : dedupeName(targetParentId, node.name);
        const clone = cloneRecursive(id, targetParentId, topName);
        touch(targetParentId);
        emitChange();
        return clone;
    };

    // Permanently destroys a node and its descendants.
    const destroy = (id) => {
        const node = nodes[id];
        if (!node) return;
        if (node.protected) {
            throw new Error(`Cannot delete "${node.name}": access is denied`);
        }
        [...node.children].forEach(destroy);
        detach(node);
        delete nodes[id];
        emitChange();
    };

    // Sends a node to the Recycle Bin; deleting an item that is already
    // in the Recycle Bin destroys it permanently.
    const remove = (id) => {
        const node = requireNode(id);
        if (node.protected) {
            throw new Error(`Cannot delete "${node.name}": access is denied`);
        }
        if (isInRecycleBin(id)) {
            destroy(id);
            return;
        }
        const bin = nodes[WELL_KNOWN.RECYCLE_BIN];
        const originalParent = node.parent;
        detach(node);
        node.originalParent = originalParent;
        node.parent = WELL_KNOWN.RECYCLE_BIN;
        node.name = dedupeName(WELL_KNOWN.RECYCLE_BIN, node.name);
        bin.children.push(id);
        touch(id);
        touch(WELL_KNOWN.RECYCLE_BIN);
        emitChange();
    };

    const restore = (id) => {
        const node = requireNode(id);
        if (node.parent !== WELL_KNOWN.RECYCLE_BIN) {
            throw new Error("Only items in the Recycle Bin can be restored");
        }
        const targetId = node.originalParent && isFolder(nodes[node.originalParent])
            ? node.originalParent
            : WELL_KNOWN.DESKTOP;
        detach(node);
        node.originalParent = null;
        node.parent = targetId;
        node.name = dedupeName(targetId, node.name);
        nodes[targetId].children.push(id);
        touch(id);
        touch(targetId);
        emitChange();
        return node;
    };

    const emptyRecycleBin = () => {
        [...nodes[WELL_KNOWN.RECYCLE_BIN].children].forEach(destroy);
    };

    const getContent = (id) => {
        const node = requireNode(id);
        return node.type === "file" ? node.content : null;
    };

    const setContent = (id, content) => {
        const node = requireNode(id);
        if (node.type !== "file") {
            throw new Error(`VirtualFS: "${node.name}" is not a file`);
        }
        node.content = String(content ?? "");
        node.size = node.content.length;
        touch(id);
        if (node.parent) touch(node.parent);
        emitChange();
        return node;
    };

    // ---- File associations ----

    // Handlers are looked up by "app:<appId>" first, then by lowercase
    // extension (".txt"), then by the "*" wildcard.
    const registerFileType = (extension, handler) => {
        fileTypeHandlers.set(String(extension).toLowerCase(), handler);
    };

    const registerFolderHandler = (handler) => {
        folderHandler = handler;
    };

    const open = (id) => {
        const node = requireNode(id);
        if (node.type === "folder") {
            if (!folderHandler) return false;
            folderHandler(node);
            return true;
        }
        const handler = (node.app && fileTypeHandlers.get(`app:${node.app}`))
            || fileTypeHandlers.get((node.ext || "").toLowerCase())
            || fileTypeHandlers.get("*");
        if (!handler) return false;
        handler(node);
        return true;
    };

    // ---- Testing hook ----

    const resetForTests = () => {
        storage.removeItem(STORAGE_KEY);
        nodes = seedNodes();
        listeners.clear();
        fileTypeHandlers.clear();
        folderHandler = null;
    };

    load();

    return {
        ...WELL_KNOWN,
        WELL_KNOWN,
        subscribe,
        getNode,
        getParent,
        getChildren,
        findChild,
        getPath,
        resolvePath,
        isDescendantOf,
        isInRecycleBin,
        isProtected,
        getSize,
        validateName,
        createFolder,
        createFile,
        rename,
        move,
        copy,
        remove,
        delete: remove,
        restore,
        destroy,
        emptyRecycleBin,
        getContent,
        setContent,
        registerFileType,
        registerFolderHandler,
        open,
        resetForTests
    };
});
