import { describe, expect, it } from "bun:test";
import { parseQuery } from "../query/parser";

describe("parseQuery", () => {
	describe("from clause", () => {
		it("parses minimal from", () => {
			const q = parseQuery("from article");
			expect(q.from).toBe("article");
			expect(q.select).toBeUndefined();
			expect(q.where).toBeUndefined();
			expect(q.orderBy).toBeUndefined();
			expect(q.limit).toBeUndefined();
			expect(q.offset).toBeUndefined();
		});

		it("is case-insensitive for keywords", () => {
			expect(parseQuery("FROM article").from).toBe("article");
		});

		it("throws when from is missing", () => {
			expect(() => parseQuery("select id")).toThrow();
		});
	});

	describe("select clause", () => {
		it("parses single field select", () => {
			const q = parseQuery("from article select title");
			expect(q.select).toEqual(["title"]);
		});

		it("parses multi-field select", () => {
			const q = parseQuery("from article select id, title, published");
			expect(q.select).toEqual(["id", "title", "published"]);
		});
	});

	describe("where clause", () => {
		it("parses == with string value", () => {
			const q = parseQuery('from article where status == "published"');
			expect(q.where).toHaveLength(1);
			expect(q.where![0]).toEqual({
				field: "status",
				op: "==",
				value: "published",
			});
		});

		it("parses != operator", () => {
			const q = parseQuery('from article where status != "draft"');
			expect(q.where![0]!.op).toBe("!=");
		});

		it("parses > and < with numbers", () => {
			const q = parseQuery("from product where price > 100");
			expect(q.where![0]).toEqual({ field: "price", op: ">", value: 100 });
		});

		it("parses >= and <=", () => {
			const q1 = parseQuery("from product where price >= 10");
			const q2 = parseQuery("from product where price <= 100");
			expect(q1.where![0]!.op).toBe(">=");
			expect(q2.where![0]!.op).toBe("<=");
		});

		it("parses contains operator", () => {
			const q = parseQuery('from article where title contains "Aurii"');
			expect(q.where![0]).toEqual({
				field: "title",
				op: "contains",
				value: "Aurii",
			});
		});

		it("parses boolean values", () => {
			const q = parseQuery("from article where published == true");
			expect(q.where![0]!.value).toBe(true);
		});

		it("parses null value", () => {
			const q = parseQuery("from article where deletedAt == null");
			expect(q.where![0]!.value).toBeNull();
		});

		it("parses multiple AND conditions", () => {
			const q = parseQuery(
				'from article where published == true and status == "active"',
			);
			expect(q.where).toHaveLength(2);
			expect(q.where![0]!.field).toBe("published");
			expect(q.where![1]!.field).toBe("status");
		});
	});

	describe("order by clause", () => {
		it("defaults to asc when direction omitted", () => {
			const q = parseQuery("from article order by title");
			expect(q.orderBy).toEqual({ field: "title", direction: "asc" });
		});

		it("parses desc direction", () => {
			const q = parseQuery("from article order by createdAt desc");
			expect(q.orderBy).toEqual({ field: "createdAt", direction: "desc" });
		});

		it("parses asc direction explicitly", () => {
			const q = parseQuery("from article order by title asc");
			expect(q.orderBy!.direction).toBe("asc");
		});
	});

	describe("limit and offset", () => {
		it("parses limit", () => {
			const q = parseQuery("from article limit 10");
			expect(q.limit).toBe(10);
		});

		it("parses offset", () => {
			const q = parseQuery("from article offset 20");
			expect(q.offset).toBe(20);
		});

		it("parses limit and offset together", () => {
			const q = parseQuery("from article limit 10 offset 20");
			expect(q.limit).toBe(10);
			expect(q.offset).toBe(20);
		});
	});

	describe("full queries", () => {
		it("parses a complex query", () => {
			const q = parseQuery(
				'from article select id, title where published == true and status == "active" order by title asc limit 5 offset 0',
			);
			expect(q.from).toBe("article");
			expect(q.select).toEqual(["id", "title"]);
			expect(q.where).toHaveLength(2);
			expect(q.orderBy).toEqual({ field: "title", direction: "asc" });
			expect(q.limit).toBe(5);
			expect(q.offset).toBe(0);
		});

		it("handles extra whitespace", () => {
			const q = parseQuery("  from   article   limit  5  ");
			expect(q.from).toBe("article");
			expect(q.limit).toBe(5);
		});
	});

	describe("error cases", () => {
		it("throws on unexpected token", () => {
			expect(() => parseQuery("from article BADTOKEN")).toThrow();
		});

		it("throws on missing value after operator", () => {
			expect(() => parseQuery("from article where id ==")).toThrow();
		});
	});
});
