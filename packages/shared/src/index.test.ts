import { describe, expect, it } from "vitest";
import { dibaoVersion } from "./index.js";

describe("shared package", () => {
  it("exports the Dibao version", () => {
    expect(dibaoVersion).toBe("0.0.0");
  });
});

