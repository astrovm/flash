import { join } from "node:path";

const PROJECT_DIR = join(import.meta.dir, "..");
export async function validateJavaScript(
  siteDirectory = join(PROJECT_DIR, "site"),
) {
  const parser = new Bun.Transpiler({ loader: "js" });
  const files = [
    ...new Bun.Glob("**/*.js").scanSync({
      cwd: siteDirectory,
      onlyFiles: true,
    }),
  ].sort();

  for (const relativePath of files) {
    const path = join(siteDirectory, relativePath);
    try {
      parser.scan(await Bun.file(path).text());
    } catch (error) {
      console.error(`Invalid JavaScript in site/${relativePath}`);
      throw error;
    }
  }

  return files.length;
}

if (import.meta.main)
  console.log(
    `Validated ${await validateJavaScript()} browser JavaScript files.`,
  );
