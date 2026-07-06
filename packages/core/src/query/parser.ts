/**
 * Query Language v0 parser.
 *
 * Syntax:
 *   from <schema>
 *   [select <field>[, <field>]*]
 *   [where <condition> [and <condition>]*]
 *   [order by <field> [asc | desc]]
 *   [limit <n>]
 *   [offset <n>]
 *
 * Condition:
 *   <field> <op> <value>
 *   op: == != > < >= <= contains
 */

export type Operator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains";
export type ScalarValue = string | number | boolean | null;

export interface Condition {
	field: string;
	op: Operator;
	value: ScalarValue;
}

export interface OrderBy {
	field: string;
	direction: "asc" | "desc";
}

export interface ParsedQuery {
	from: string;
	select?: string[];
	where?: Condition[];
	orderBy?: OrderBy;
	limit?: number;
	offset?: number;
}

// ── Tokenizer ───────────────────────────────────────────────────────────────

type TokenKind =
	| "keyword"
	| "ident"
	| "string"
	| "number"
	| "boolean"
	| "null"
	| "op"
	| "comma"
	| "eof";

interface Token {
	kind: TokenKind;
	value: ScalarValue | string;
	raw: string;
}

const KEYWORDS = new Set([
	"from",
	"select",
	"where",
	"and",
	"order",
	"by",
	"limit",
	"offset",
	"asc",
	"desc",
]);

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < input.length) {
		if (/\s/.test(input[i]!)) {
			i++;
			continue;
		}

		// Two-char operators first
		const two = input.slice(i, i + 2);
		if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
			tokens.push({ kind: "op", value: two, raw: two });
			i += 2;
			continue;
		}

		const ch = input[i]!;

		if (ch === ">" || ch === "<") {
			tokens.push({ kind: "op", value: ch, raw: ch });
			i++;
			continue;
		}

		if (ch === ",") {
			tokens.push({ kind: "comma", value: ",", raw: "," });
			i++;
			continue;
		}

		// Quoted string
		if (ch === '"' || ch === "'") {
			const quote = ch;
			let str = "";
			i++;
			while (i < input.length && input[i] !== quote) {
				if (input[i] === "\\" && i + 1 < input.length) {
					i++;
					str += input[i];
				} else {
					str += input[i];
				}
				i++;
			}
			i++; // closing quote
			tokens.push({ kind: "string", value: str, raw: `"${str}"` });
			continue;
		}

		// Number (including negative)
		if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
			let num = ch === "-" ? (i++, "-") : "";
			while (i < input.length && /[0-9.]/.test(input[i]!)) num += input[i++];
			tokens.push({ kind: "number", value: parseFloat(num), raw: num });
			continue;
		}

		// Identifier / keyword / boolean / null / contains operator
		if (/[a-zA-Z_]/.test(ch)) {
			let word = "";
			while (i < input.length && /[a-zA-Z0-9_\-.]/.test(input[i]!))
				word += input[i++];
			const lower = word.toLowerCase();

			if (lower === "true") {
				tokens.push({ kind: "boolean", value: true, raw: word });
				continue;
			}
			if (lower === "false") {
				tokens.push({ kind: "boolean", value: false, raw: word });
				continue;
			}
			if (lower === "null") {
				tokens.push({ kind: "null", value: null, raw: word });
				continue;
			}
			if (lower === "contains") {
				tokens.push({ kind: "op", value: "contains", raw: word });
				continue;
			}
			if (KEYWORDS.has(lower)) {
				tokens.push({ kind: "keyword", value: lower, raw: word });
				continue;
			}

			tokens.push({ kind: "ident", value: word, raw: word });
			continue;
		}

		throw new Error(`Unexpected character "${ch}" at position ${i}`);
	}

	tokens.push({ kind: "eof", value: null, raw: "" });
	return tokens;
}

// ── Recursive-descent parser ─────────────────────────────────────────────────

class Parser {
	private tokens: Token[];
	private pos = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	private peek(): Token {
		return this.tokens[this.pos]!;
	}

	private advance(): Token {
		return this.tokens[this.pos++]!;
	}

	private expect(kind: TokenKind, value?: string): Token {
		const tok = this.peek();
		if (tok.kind !== kind) {
			throw new Error(
				`Expected ${kind}${value ? ` "${value}"` : ""} but got ${tok.kind} ("${tok.raw}")`,
			);
		}
		if (value !== undefined && tok.value !== value) {
			throw new Error(`Expected "${value}" but got "${tok.raw}"`);
		}
		return this.advance();
	}

	private match(kind: TokenKind, value?: string): boolean {
		const tok = this.peek();
		if (tok.kind !== kind) return false;
		if (value !== undefined && tok.value !== value) return false;
		return true;
	}

	parse(): ParsedQuery {
		this.expect("keyword", "from");
		const from = this.expect("ident").value as string;
		const query: ParsedQuery = { from };

		while (!this.match("eof")) {
			if (this.match("keyword", "select")) {
				this.advance();
				query.select = this.parseFieldList();
			} else if (this.match("keyword", "where")) {
				this.advance();
				query.where = this.parseConditions();
			} else if (this.match("keyword", "order")) {
				this.advance();
				this.expect("keyword", "by");
				const field = this.expect("ident").value as string;
				let direction: "asc" | "desc" = "asc";
				if (this.match("keyword", "asc") || this.match("keyword", "desc")) {
					direction = this.advance().value as "asc" | "desc";
				}
				query.orderBy = { field, direction };
			} else if (this.match("keyword", "limit")) {
				this.advance();
				query.limit = this.expect("number").value as number;
			} else if (this.match("keyword", "offset")) {
				this.advance();
				query.offset = this.expect("number").value as number;
			} else {
				const tok = this.peek();
				throw new Error(
					`Unexpected token "${tok.raw}" at position ${this.pos}`,
				);
			}
		}

		return query;
	}

	private parseFieldList(): string[] {
		const fields: string[] = [this.expect("ident").value as string];
		while (this.match("comma")) {
			this.advance();
			fields.push(this.expect("ident").value as string);
		}
		return fields;
	}

	private parseConditions(): Condition[] {
		const conditions: Condition[] = [this.parseCondition()];
		while (this.match("keyword", "and")) {
			this.advance();
			conditions.push(this.parseCondition());
		}
		return conditions;
	}

	private parseCondition(): Condition {
		const field = this.expect("ident").value as string;
		const op = this.expect("op").value as Operator;
		const tok = this.peek();

		if (!["string", "number", "boolean", "null"].includes(tok.kind)) {
			throw new Error(
				`Expected a value after operator but got ${tok.kind} ("${tok.raw}")`,
			);
		}

		const value = this.advance().value as ScalarValue;
		return { field, op, value };
	}
}

// ── Public API ───────────────────────────────────────────────────────────────

export function parseQuery(input: string): ParsedQuery {
	const tokens = tokenize(input.trim());
	return new Parser(tokens).parse();
}
