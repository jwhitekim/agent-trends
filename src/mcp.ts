/**
 * agent_trends 수집 명령을 MCP 도구로 노출하는 stdio 서버 (Node 내장 모듈만).
 * 실행: node src/mcp.ts   (작업 폴더 = 프로젝트 루트)
 * stdout에는 JSON-RPC 메시지만 쓴다. 로그는 stderr.
 * legacy(initialize 핸드셰이크) 방식 MCP. modern 클라이언트의 server/discover에는 Method not found로 답한다.
 */
import { createInterface } from "node:readline";
import { coerce, defaults, LABELS } from "./common.ts";
import * as compare from "./compare.ts";
import { loadDotenv } from "./env.ts";
import { SOURCES } from "./sources/index.ts";
import type { Option, Row } from "./types.ts";
import { saveResult } from "./results.ts";

const SERVER = { name: "agent-trends", version: "0.2.0" };
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const NOTES: Record<string, string> = {
  openalex: "논문 많이 낸 기업 순위 (OpenAlex, 키 불필요). 논문 색인은 수일~수주 지연.",
  news: "국내 뉴스 기업 순위 (NAVER API HUB). 실시간 갱신, 일 25,000회 한도. 검색어당 최대 1000건.",
  gnews: "해외 뉴스 기업 순위 (GDELT). 15분 단위 갱신, 5초당 1회 제한, 최근 약 3개월만.",
  itfind: "ICT 동향 보고서 목록 (ITFIND, data.go.kr). 개발계정 일 100회 한도, 아껴 쓸 것.",
};

const log = (...a: unknown[]) => console.error(...a);
const LIMIT = { type: "integer", minimum: 1, default: 50, description: "반환할 상위 행 수" };

interface Tool {
  def: { name: string; description: string; inputSchema: Record<string, unknown> };
  options: Option[];
  fetch(opts: Record<string, unknown>): Promise<Row[]>;
  label: string;
}

/** Option 목록에서 JSON Schema properties. 속성 이름 = 플래그명. */
function schema(options: Option[]): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const op of options) {
    const s: Record<string, unknown> = op.type === "string[]" ? { type: "array", items: { type: "string" } }
      : { type: op.type === "integer" ? "integer" : op.type === "boolean" ? "boolean" : "string" };
    if (op.choices) ((s.items as Record<string, unknown>) ?? s).enum = op.choices;
    if (op.default !== undefined) s.default = op.default;
    if (op.help) s.description = op.help;
    props[op.name] = s;
  }
  return { type: "object", properties: { ...props, limit: LIMIT,
    save: { type: "boolean", default: false, description: "true이면 전체 결과와 실행 조건 저장 (기본: 조회만)" } }, additionalProperties: false };
}

function buildTools(): Map<string, Tool> {
  const tools = new Map<string, Tool>();
  for (const s of SOURCES) {
    const label = LABELS[s.name] ?? s.label;
    tools.set(s.name, { def: { name: s.name, description: `[${label}] ` + (NOTES[s.name] ?? s.description), inputSchema: schema(s.options) },
      options: s.options, fetch: (o) => s.fetch(o), label });
  }
  tools.set("compare", { def: { name: "compare", description: "[비교] " + compare.description, inputSchema: schema(compare.options) },
    options: compare.options, fetch: compare.fetch, label: "비교" });
  return tools;
}

async function callTool(tool: Tool, args: Record<string, unknown> = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments는 객체여야 합니다.");
  const allowed = new Set(["limit", "save", ...tool.options.flatMap((o) => [o.name, o.name.replace(/-/g, "_")])]);
  if (Object.keys(args).some((k) => !allowed.has(k))) throw new Error("알 수 없는 도구 인자입니다.");
  const a = { ...args };
  const limit = a.limit ?? 50;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) throw new Error("limit은 1 이상 정수여야 합니다.");
  if (a.save !== undefined && typeof a.save !== "boolean") throw new Error("save는 boolean이어야 합니다.");
  delete a.limit;
  const opts = defaults(tool.options);
  for (const op of tool.options) {
    // 플래그명(search-type)과 밑줄형(search_type) 둘 다 받는다
    const v = a[op.name] ?? a[op.name.replace(/-/g, "_")];
    if (v !== undefined && v !== null) opts[op.name] = coerce(op, v);
  }
  opts.format = "csv";
  opts.out = "";
  // 소스가 console.log를 써도 stdout(JSON-RPC)을 오염시키지 않게 stderr로 돌린다
  const orig = console.log;
  console.log = (...x: unknown[]) => console.error(...x);
  let rows: Row[];
  try {
    rows = await tool.fetch(opts);
  } finally {
    console.log = orig;
  }
  const result: Record<string, unknown> = { total: rows.length, returned: Math.min(limit, rows.length), rows: rows.slice(0, limit) };
  if (tool.label !== "비교" && a.save === true) {
    const saved = saveResult(rows, "csv", tool.label, tool.def.name, opts);
    result.saved = saved;
  }
  return result;
}

class RpcError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

async function handle(msg: Record<string, any>, tools: Map<string, Tool>): Promise<unknown> {
  const method = msg.method;
  if (method === "initialize") {
    const req = msg.params?.protocolVersion;
    return { protocolVersion: VERSIONS.includes(req) ? req : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: [...tools.values()].map((t) => t.def) };
  if (method === "tools/call") {
    const p = msg.params ?? {};
    const t = tools.get(p.name);
    if (!t) throw new RpcError(-32602, `알 수 없는 도구: ${p.name}`);
    try {
      const res = await callTool(t, p.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(res) }], isError: false };
    } catch (e) {
      const text = `${(e as Error)?.name ?? "Error"}: ${(e as Error)?.message ?? e}`;
      log(`[${p.name}] 실패: ${text}`);
      return { content: [{ type: "text", text }], isError: true };
    }
  }
  throw new RpcError(-32601, `Method not found: ${method}`);
}

loadDotenv();
const tools = buildTools();
log(`agent-trends MCP 서버 시작: 도구 ${[...tools.keys()].join(", ")}`);
const send = (o: unknown) => process.stdout.write(JSON.stringify(o) + "\n");
// 요청은 받은 순서대로 하나씩 처리한다
for await (const raw of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  const line = raw.trim();
  if (!line) continue;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    continue;
  }
  if (!msg || typeof msg !== "object" || !("id" in msg) || !("method" in msg)) continue; // 알림/응답은 무시
  try {
    send({ jsonrpc: "2.0", id: msg.id, result: await handle(msg, tools) });
  } catch (e) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: e instanceof RpcError ? e.code : -32603, message: (e as Error)?.message ?? String(e) } });
  }
}
