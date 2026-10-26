// ITFIND(국내 공공): 한국연구재단_ICT동향정보에서 에이전트 관련 동향 자료 수집 (DATA_GO_KR_KEY 필요).
import type { Row, Source } from "../types.ts";
import { COMPANY_DICTIONARY_VERSION, match, rank } from "../companies.ts";

const API = "http://open.itfind.or.kr/openapi/service/ICTTrendInformationService/getCrdnsScrapInfo";
const DEFAULT_QUERIES = ["에이전트", "에이전틱", "LLM"];

function unescapeXml(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (_m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" } as Record<string, string>)[e.toLowerCase()]);
}
/** 첫 <tag>의 텍스트 (없으면 null, 빈 태그는 ""). ElementTree findtext와 같은 의미. */
function text(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`));
  return m ? unescapeXml(m[1] ?? "") : null;
}

export interface ItfindPage { code: string | null; msg: string | null; total: number; items: Record<string, string | null>[]; }

/** ITFIND XML 응답 파싱 (네트워크와 분리해 단위 시험 가능). */
export function parsePage(xml: string): ItfindPage {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, b]) => ({
    identifier: text(b, "identifier"), title: text(b, "title"), issued: text(b, "issued"),
    publisher: text(b, "publisher"), fileLink: text(b, "fileLink"),
  }));
  return { code: text(xml, "resultCode"), msg: text(xml, "resultMsg"), total: Number(text(xml, "totalCount") || 0), items };
}

/** 페이지 items를 행으로 변환해 docs에 추가 (identifier 공백 제거, issued 2026.10.14 -> 2026-10-14). */
export function addItems(items: ItfindPage["items"], q: string, docs: Map<string, Row>): void {
  for (const it of items) {
    const id = (it.identifier ?? "").trim();
    if (docs.has(id)) continue;
    const title = it.title ?? "";
    docs.set(id, {
      date: (it.issued ?? "").trim().replaceAll(".", "-"),
      title, publisher: it.publisher ?? "", companies: match(title).join(";"),
      query: q, link: it.fileLink ?? "", identifier: id,
    });
  }
}

function todayIso(): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const source: Source = {
  name: "itfind",
  label: "동향",
  description: "ITFIND(국내 공공): 한국연구재단_ICT동향정보에서 에이전트 관련 동향 자료 수집 (DATA_GO_KR_KEY 필요)",
  options: [
    { name: "query", type: "string[]", help: `여러 번 지정 가능 (기본: ${DEFAULT_QUERIES.join(", ")})` },
    { name: "from", type: "string", default: "2024-01-01" },
    { name: "to", type: "string", default: todayIso() },
    { name: "search-type", type: "string", default: "0", help: "0: 전체(제목+출처+내용). 기본 0" },
    { name: "mode", type: "string", default: "articles", choices: ["companies", "articles"], help: "articles: 자료 목록, companies: 제목 기준 기업별 집계" },
  ],
  async fetch(opts) {
    opts["company-dictionary"] = COMPANY_DICTIONARY_VERSION;
    const key = process.env.DATA_GO_KR_KEY;
    if (!key) throw new Error("DATA_GO_KR_KEY 환경변수를 설정하세요.");
    const queries = (opts.query as string[] | undefined)?.length ? (opts.query as string[]) : DEFAULT_QUERIES;
    const from = String(opts.from ?? "2024-01-01").replaceAll("-", "");
    const to = String(opts.to ?? todayIso()).replaceAll("-", "");
    const searchType = String(opts["search-type"] ?? opts.searchType ?? "0");
    const docs = new Map<string, Row>();
    for (const q of queries) {
      for (let page = 1; ; page++) {
        // 날짜 범위가 없으면 API가 0건을 돌려주므로 항상 지정
        const qs = new URLSearchParams({ serviceKey: key, numOfRows: "100", pageNo: String(page), searchType, searchWord: q, issuedStart: from, issuedEnd: to });
        const r = await fetch(`${API}?${qs}`, { signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`ITFIND HTTP ${r.status}`);
        const p = parsePage(await r.text());
        if (p.code !== "00") throw new Error(`ITFIND API 오류 ${p.code}: ${p.msg}`);
        addItems(p.items, q, docs);
        if (page * 100 >= p.total || !p.items.length) break;
      }
    }
    const rows = [...docs.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return opts.mode === "articles" ? rows : rank(rows);
  },
};
