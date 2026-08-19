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
      const { id, title, icon, executable, packagePath } = definition || {};
      if (typeof id !== "string" || !ID_PATTERN.test(id))
        throw new TypeError("Invalid BoxedWine application ID");
      if (ids.has(id))
        throw new TypeError(`Duplicate BoxedWine application ID: ${id}`);
      if (typeof title !== "string" || !title.trim())
        throw new TypeError(`Invalid BoxedWine application title for ${id}`);
      if (typeof icon !== "string" || !/^[a-z0-9_. -]+\.png$/i.test(icon))
        throw new TypeError(`Invalid BoxedWine application icon for ${id}`);
      if (
        typeof executable !== "string" ||
        !EXECUTABLE_PATTERN.test(executable) ||
        executable.includes("..")
      )
        throw new TypeError(`Invalid BoxedWine executable for ${id}`);
      if (typeof packagePath !== "string" || !PACKAGE_PATTERN.test(packagePath))
        throw new TypeError(`Invalid BoxedWine package path for ${id}`);
      ids.add(id);
      return Object.freeze({
        id,
        title,
        icon,
        executable,
        launchExecutable: `${id}/resize-host.exe`,
        packagePath,
      });
    }),
  );
};

export const boxedWineApplications = validateBoxedWineApplications([
  {
    id: "calculator",
    title: "Calculator",
    icon: "Calculator.png",
    executable: "calculator/calc.exe",
    packagePath: "site/iframe/calculator/xp-calculator.zip",
  },
  {
    id: "solitaire",
    title: "Solitaire",
    icon: "Solitaire.png",
    executable: "solitaire/sol.exe",
    packagePath: "site/iframe/solitaire/xp-solitaire.zip",
  },
  {
    id: "freecell",
    title: "FreeCell",
    icon: "FreeCell.png",
    executable: "freecell/freecell.exe",
    packagePath: "site/iframe/freecell/xp-freecell.zip",
  },
  {
    id: "spider-solitaire",
    title: "Spider Solitaire",
    icon: "SpiderSolitaire.png",
    executable: "spider-solitaire/spider.exe",
    packagePath: "site/iframe/spider-solitaire/xp-spider-solitaire.zip",
  },
]);

const applicationsById = new Map(
  boxedWineApplications.map((application) => [application.id, application]),
);

export const getBoxedWineApplication = (id) => applicationsById.get(id) || null;
