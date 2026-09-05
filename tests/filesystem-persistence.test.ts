import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(
  new URL("../site/js/filesystem.js", import.meta.url),
  "utf8",
);
class TestLocks {
  held = false;
  queue: (() => void)[] = [];
  request(
    _name: string,
    options: { ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: object | null) => unknown,
  ): Promise<unknown> {
    if (options.ifAvailable && options.signal)
      return Promise.reject(
        new TypeError("ifAvailable cannot be combined with signal"),
      );
    if (this.held && options.ifAvailable)
      return Promise.resolve(callback(null));
    return new Promise((resolve, reject) => {
      const run = () => {
        if (options.signal?.aborted) {
          reject(options.signal.reason);
          return;
        }
        this.held = true;
        Promise.resolve(callback({}))
          .then(resolve, reject)
          .finally(() => {
            this.held = false;
            this.queue.shift()?.();
          });
      };
      if (this.held) this.queue.push(run);
      else run();
    });
  }
}
const createStorage = () => {
  const values = new Map<string, string>();
  return {
    fail: false,
    getItem: (key: string) => values.get(key) || null,
    removeItem: (key: string) => values.delete(key),
    setItem(key: string, value: string) {
      if (this.fail && key === "virtualFileSystem")
        throw new DOMException("Full", "QuotaExceededError");
      values.set(key, value);
    },
  };
};
const createTab = (
  storage: ReturnType<typeof createStorage>,
  locks = new TestLocks(),
) => {
  const events = new EventTarget();
  const context = createContext({
    localStorage: storage,
    document: {},
    navigator: { locks },
    AbortController,
    console,
    addEventListener: events.addEventListener.bind(events),
  });
  runInContext(source, context);
  return { fs: context.VirtualFS, events };
};

test("failed durable writes roll back creates and edits", async () => {
  const storage = createStorage();
  const { fs, events } = createTab(storage);
  await fs.ready;
  const file = fs.createFile(fs.MY_DOCUMENTS, "notes.txt", {
    content: "saved",
  });
  storage.fail = true;
  expect(() => fs.setContent(file.id, "unsaved")).toThrow("storage is full");
  expect(fs.getContent(file.id)).toBe("saved");
  expect(() => fs.createFile(fs.MY_DOCUMENTS, "lost.txt")).toThrow(
    "storage is full",
  );
  expect(fs.findChild(fs.MY_DOCUMENTS, "lost.txt")).toBeNull();
  events.dispatchEvent(new Event("pagehide"));
});

test("a second tab stays read-only and takes over the latest filesystem when the writer closes", async () => {
  const storage = createStorage();
  const locks = new TestLocks();
  const first = createTab(storage, locks);
  await first.fs.ready;
  const second = createTab(storage, locks);
  await second.fs.ready;
  const a = first.fs.createFile(first.fs.MY_DOCUMENTS, "a.txt", {
    content: "A",
  });
  expect(second.fs.canWrite).toBeFalse();
  expect(() => second.fs.createFile(second.fs.MY_DOCUMENTS, "b.txt")).toThrow(
    "read-only",
  );
  expect(second.fs.getContent(a.id)).toBe("A");
  first.events.dispatchEvent(new Event("pagehide"));
  await new Promise((resolve) => setImmediate(resolve));
  expect(second.fs.canWrite).toBeTrue();
  const b = second.fs.createFile(second.fs.MY_DOCUMENTS, "b.txt", {
    content: "B",
  });
  expect(second.fs.getContent(a.id)).toBe("A");
  expect(second.fs.getContent(b.id)).toBe("B");
  second.events.dispatchEvent(new Event("pagehide"));
});

test("renaming excludes the file itself but still deduplicates other files", async () => {
  const { fs, events } = createTab(createStorage());
  await fs.ready;
  const file = fs.createFile(fs.MY_DOCUMENTS, "notes.txt");
  expect(fs.rename(file.id, "notes.txt").name).toBe("notes.txt");
  expect(fs.rename(file.id, "NOTES.txt").name).toBe("NOTES.txt");
  fs.createFile(fs.MY_DOCUMENTS, "other.txt");
  expect(fs.rename(file.id, "other.txt").name).toBe("other (2).txt");
  events.dispatchEvent(new Event("pagehide"));
});
