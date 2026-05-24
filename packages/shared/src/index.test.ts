import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dibaoVersion } from "./index.js";

describe("shared package", () => {
  it("exports the root package version", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
    ) as { version: string };

    expect(dibaoVersion).toBe(rootPackageJson.version);
  });
});
