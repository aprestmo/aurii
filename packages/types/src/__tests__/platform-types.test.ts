import { describe, expect, test } from "bun:test";
import {
	AUTH_SCOPES,
	DATA_SOURCE_KINDS,
	isAuthScope,
	isDataSourceKind,
	isRouteAccess,
	PROJECT_CONFIG_VERSION,
	scopeAllows,
} from "../index";

describe("platform types", () => {
	test("data source kinds include file and http", () => {
		expect(isDataSourceKind("file")).toBe(true);
		expect(isDataSourceKind("http")).toBe(true);
		expect(isDataSourceKind("cms")).toBe(false);
		expect(DATA_SOURCE_KINDS.length).toBeGreaterThanOrEqual(6);
	});

	test("route access values", () => {
		expect(isRouteAccess("public")).toBe(true);
		expect(isRouteAccess("authenticated")).toBe(true);
		expect(isRouteAccess("private")).toBe(true);
		expect(isRouteAccess("open")).toBe(false);
	});

	test("scopes — admin implies all", () => {
		expect(scopeAllows(["project:admin"], "import:run")).toBe(true);
		expect(scopeAllows(["project:read"], "import:run")).toBe(false);
		expect(scopeAllows(["import:run"], "import:run")).toBe(true);
		expect(isAuthScope("route:manage")).toBe(true);
		expect(AUTH_SCOPES).toContain("source:manage");
	});

	test("project config version is 1", () => {
		expect(PROJECT_CONFIG_VERSION).toBe(1);
	});
});
