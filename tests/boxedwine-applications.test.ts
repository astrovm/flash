import { describe, expect, test } from "bun:test";

import { validateBoxedWineApplications } from "../site/apps/core/boxedwine-applications.js";

// Each id's first six characters, and each executable's basename, must stay
// unique across the whole catalog (see boxedwine-applications.js), so this
// fixture cannot reuse a shared "application-" prefix or "program.exe" name.
const application = (index: number) => ({
  id: `game${String(index).padStart(2, "0")}`,
  title: `Application ${index}`,
  icon: `Application-${index}.png`,
  executable: `application-${index}/program${index}.exe`,
  packagePath: `site/iframe/application-${index}/application-${index}.zip`,
});

describe("BoxedWine application catalog", () => {
  test("validates a catalog with twenty independently registered applications", () => {
    const applications = validateBoxedWineApplications(
      Array.from({ length: 20 }, (_, index) => application(index + 1)),
    );

    expect(applications).toHaveLength(20);
    expect(applications.at(-1)).toMatchObject({
      id: "game20",
      executable: "application-20/program20.exe",
    });
  });

  test("rejects duplicate IDs and unsafe paths", () => {
    expect(() =>
      validateBoxedWineApplications([application(1), application(1)]),
    ).toThrow("Duplicate BoxedWine application ID");
    expect(() =>
      validateBoxedWineApplications([
        { ...application(1), executable: "application-1/../program.exe" },
      ]),
    ).toThrow("Invalid BoxedWine executable");
  });
});
