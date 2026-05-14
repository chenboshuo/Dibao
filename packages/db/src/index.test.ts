import { describe, expect, it } from "vitest";
import {
  float32VectorToBuffer,
  getSqliteVecVersion,
  openDatabase,
  vectorToJson
} from "./index.js";

describe("db package", () => {
  it("loads sqlite-vec and exposes vec_version", () => {
    const db = openDatabase();
    try {
      const result = getSqliteVecVersion(db);
      expect(result.version).toMatch(/^v\d+\./);
    } finally {
      db.close();
    }
  });

  it("serializes vectors for blob and sqlite-vec json inputs", () => {
    expect(float32VectorToBuffer([1, 0, 0, 0])).toBeInstanceOf(Buffer);
    expect(vectorToJson([1, 0, 0, 0])).toBe("[1,0,0,0]");
  });
});

