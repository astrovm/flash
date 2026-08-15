import { describe, expect, test } from "bun:test";

import { validateBoxedWineApplications } from "../site/apps/core/boxedwine-applications.js";

const application = (index: number) => ({
  id: `application-${index}`,
  executable: `application-${index}/program.exe`,
  packagePath: `site/iframe/application-${index}/application-${index}.zip`,
});

describe("BoxedWine application catalog", () => {
  test("validates a catalog with twenty independently registered applications", () => {
    const applications = validateBoxedWineApplications(
      Array.from({ length: 20 }, (_, index) => application(index + 1)),
    );

    expect(applications).toHaveLength(20);
    expect(applications.at(-1)).toMatchObject({
      id: "application-20",
      executable: "application-20/program.exe",
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
