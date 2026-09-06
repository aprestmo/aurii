/**
 * Lightweight documentation status markers for vision docs.
 * Ensures Capabilities.md and AI.md retain explicit non-Core-default status banners.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const DOCS = join(import.meta.dir, "../../../../docs");

describe("documentation status markers", () => {
	it("Capabilities.md declares vision status and promotion ladder", () => {
		const text = readFileSync(join(DOCS, "Capabilities.md"), "utf8");
		expect(text).toContain("Status: architectural vision");
		expect(text).toContain("product-local");
		expect(text).not.toMatch(
			/^Core implements capabilities\.\s*$/m,
		);
	});

	it("AI.md declares vision status and consumer-of-Core framing", () => {
		const text = readFileSync(join(DOCS, "AI.md"), "utf8");
		expect(text).toContain("Status: architectural vision");
		expect(text).toContain("consumer of Core");
		expect(text).toContain("deterministically without AI");
	});
});
