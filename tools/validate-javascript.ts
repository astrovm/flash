import { join } from "node:path";

const PROJECT_DIR = join(import.meta.dir, "..");
const parser = new Bun.Transpiler({ loader: "js" });
const files = [
  ...new Bun.Glob("**/*.js").scanSync({
    cwd: join(PROJECT_DIR, "site"),
    onlyFiles: true,
  }),
].sort();

for (const relativePath of files) {
  const path = join(PROJECT_DIR, "site", relativePath);
  try {
    parser.scan(await Bun.file(path).text());
  } catch (error) {
    console.error(`Invalid JavaScript in site/${relativePath}`);
    throw error;
  }
}

console.log(`Validated ${files.length} browser JavaScript files.`);
