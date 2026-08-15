const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXECUTABLE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9_. -]+)+\.exe$/i;
const PACKAGE_PATTERN = /^site\/iframe\/[a-z0-9-]+\/[a-z0-9-]+\.zip$/;

export const validateBoxedWineApplications = (definitions) => {
  if (!Array.isArray(definitions))
    throw new TypeError("BoxedWine applications must be an array");
  const ids = new Set();
  return Object.freeze(
    definitions.map((definition) => {
      const { id, executable, packagePath } = definition || {};
      if (typeof id !== "string" || !ID_PATTERN.test(id))
        throw new TypeError("Invalid BoxedWine application ID");
      if (ids.has(id))
        throw new TypeError(`Duplicate BoxedWine application ID: ${id}`);
      if (
        typeof executable !== "string" ||
        !EXECUTABLE_PATTERN.test(executable) ||
        executable.includes("..")
      )
        throw new TypeError(`Invalid BoxedWine executable for ${id}`);
      if (typeof packagePath !== "string" || !PACKAGE_PATTERN.test(packagePath))
        throw new TypeError(`Invalid BoxedWine package path for ${id}`);
      ids.add(id);
      const processExecutables = definition.processExecutables || [executable];
      if (
        !Array.isArray(processExecutables) ||
        processExecutables.length === 0 ||
        processExecutables.some(
          (path) =>
            typeof path !== "string" ||
            !EXECUTABLE_PATTERN.test(path) ||
            path.includes(".."),
        )
      )
        throw new TypeError(`Invalid BoxedWine process executable for ${id}`);
      return Object.freeze({
        id,
        executable,
        packagePath,
        processExecutables: Object.freeze([...new Set(processExecutables)]),
      });
    }),
  );
};

export const boxedWineApplications = validateBoxedWineApplications([
  {
    id: "calculator",
    executable: "calculator/calc.exe",
    packagePath: "site/iframe/calculator/xp-calculator.zip",
  },
  {
    id: "solitaire",
    executable: "solitaire/resize-host.exe",
    packagePath: "site/iframe/solitaire/xp-solitaire.zip",
    processExecutables: ["solitaire/resize-host.exe", "solitaire/sol.exe"],
  },
  {
    id: "freecell",
    executable: "freecell/resize-host.exe",
    packagePath: "site/iframe/freecell/xp-freecell.zip",
    processExecutables: ["freecell/resize-host.exe", "freecell/freecell.exe"],
  },
  {
    id: "spider-solitaire",
    executable: "spider-solitaire/resize-host.exe",
    packagePath: "site/iframe/spider-solitaire/xp-spider-solitaire.zip",
    processExecutables: [
      "spider-solitaire/resize-host.exe",
      "spider-solitaire/spider.exe",
    ],
  },
]);

const applicationsById = new Map(
  boxedWineApplications.map((application) => [application.id, application]),
);

export const getBoxedWineApplication = (id) => applicationsById.get(id) || null;
