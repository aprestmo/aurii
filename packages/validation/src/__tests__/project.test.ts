import { describe, expect, it } from "bun:test";
import {
	generateSlugFromName,
	validateCreateProject,
	validateProjectStatus,
	validateUpdateProject,
} from "../project";

describe("generateSlugFromName", () => {
	it("slugifies plain names", () => {
		expect(generateSlugFromName("Valgdata")).toBe("valgdata");
		expect(generateSlugFromName("News CMS")).toBe("news-cms");
		expect(generateSlugFromName("Norge Data")).toBe("norge-data");
	});

	it("folds Norwegian letters", () => {
		expect(generateSlugFromName("Sør-Trøndelag")).toBe("sor-trondelag");
	});
});

describe("validateCreateProject", () => {
	it("accepts explicit slug", () => {
		const result = validateCreateProject({
			name: "Valgdata",
			slug: "valgdata",
			description: "Offisielle valgdata.",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({
				name: "Valgdata",
				slug: "valgdata",
				description: "Offisielle valgdata.",
			});
		}
	});

	it("generates slug when omitted", () => {
		const result = validateCreateProject({ name: "News CMS" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.slug).toBe("news-cms");
		}
	});

	it("rejects invalid slugs", () => {
		for (const slug of ["News CMS", "-news", "news_", "news/"]) {
			const result = validateCreateProject({ name: "Test", slug });
			expect(result.success).toBe(false);
		}
	});

	it("rejects short names", () => {
		const result = validateCreateProject({ name: "A" });
		expect(result.success).toBe(false);
	});
});

describe("validateUpdateProject", () => {
	it("requires at least one field", () => {
		const result = validateUpdateProject({});
		expect(result.success).toBe(false);
	});
});

describe("validateProjectStatus", () => {
	it("accepts known statuses", () => {
		expect(validateProjectStatus("active").success).toBe(true);
		expect(validateProjectStatus("inactive").success).toBe(true);
		expect(validateProjectStatus("archived").success).toBe(true);
	});

	it("rejects unknown statuses", () => {
		expect(validateProjectStatus("deleted").success).toBe(false);
		expect(validateProjectStatus(null).success).toBe(false);
	});
});
