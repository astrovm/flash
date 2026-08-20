import { describe, expect, test } from "bun:test";

import {
  boxedWineApplications,
  validateBoxedWineApplications,
} from "../site/apps/core/boxedwine-applications.js";

const application = (index: number) => ({
  id: `application-${index}`,
  title: `Application ${index}`,
  icon: `Application-${index}.png`,
  executable: `application-${index}/program.exe`,
  packagePath: `site/iframe/application-${index}/application-${index}.zip`,
});

describe("BoxedWine application catalog", () => {
  test("registers Hearts and WordPad with only generic application data", () => {
    expect(
      boxedWineApplications.filter(({ id }) =>
        ["hearts", "wordpad"].includes(id),
      ),
    ).toEqual([
      {
        id: "wordpad",
        title: "WordPad",
        icon: "WordPad.png",
        executable: "wordpad/wordpad.exe",
        packagePath: "site/iframe/wordpad/xp-wordpad.zip",
      },
      {
        id: "hearts",
        title: "Hearts",
        icon: "Hearts.png",
        executable: "hearts/mshearts.exe",
        packagePath: "site/iframe/hearts/xp-hearts.zip",
      },
    ]);
  });

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
