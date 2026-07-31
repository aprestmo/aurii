import { describe, expect, it } from "bun:test";
import { LEGACY_PROJECT_ID, LEGACY_PROJECT_SLUG } from "../project";

describe("Legacy project constants", () => {
	it("exposes a stable UUID and slug", () => {
		expect(LEGACY_PROJECT_ID).toBe("a0000000-0000-4000-8000-000000000001");
		expect(LEGACY_PROJECT_SLUG).toBe("legacy");
	});
});
