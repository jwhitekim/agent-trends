// GDELT(글로벌): 해외 에이전트 기사 제목에서 기업 언급 집계 (API 키 불필요).
import type { Row, Source } from "../types.ts";
import { COMPANY_DICTIONARY_VERSION, match, rank } from "../companies.ts";

const API = "https://api.gdeltproject.org/api/v2/doc/doc";
const DEFAULT_QUERIES = ['"AI agent"', '"agentic AI"', '"AI agents"'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 응답 본문 파싱. JSON이 아니면(속도 제한 안내 텍스트) null. */
export function parseBody(body: string): any | null {
  try { return JSON.parse(body); } catch { return null; }
}

/** GDELT artlist 응답의 articles를 행으로 변환 (seen에 있는 url은 건너뜀). */
export function parseArticles(data: any, q: string, seen: Map<string, Row>): void {
  for (const it of data?.articles ?? []) {
    if (seen.has(it.url)) continue;
    const d = String(it.seendate);
    seen.set(it.url, {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      title: it.title,
      companies: match(it.title).join(";"),
      query: q,
      link: it.url,
      domain: it.domain,
      country: it.sourcecountry ?? "",
    });
  }
}

// 공유 IP 등에서 첫 요청도 429로 거절될 수 있어 간격을 늘려 가며 재시도. 200 + 텍스트도 같은 실패로 본다.
async function get(url: string, retries = 4): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    let reason: string;
    if (r.status === 429) reason = "HTTP 429";
    else if (!r.ok) throw new Error(`GDELT HTTP ${r.status}`);
    else {
      const body = await r.text();
      const data = parseBody(body);
      if (data !== null) return data;
      reason = "JSON 아님: " + body.slice(0, 80).trim();
    }
    if (attempt === retries - 1) throw new Error(`GDELT 속도 제한으로 실패 (${reason}). 몇 분 뒤 다시 실행하세요.`);
    const wait = 15 * 2 ** attempt;
    console.error(`[gnews] ${reason}, ${wait}초 후 재시도`);
    await sleep(wait * 1000);
  }
}

export const source: Source = {
  name: "gnews",
  label: "해외뉴스",
  description: "GDELT(글로벌): 해외 에이전트 기사 제목에서 기업 언급 집계 (API 키 불필요)",
  options: [
    { name: "query", type: "string[]", help: `여러 번 지정 가능 (기본: ${DEFAULT_QUERIES.join(", ")})` },
    { name: "timespan", type: "string", default: "3months", help: "최근 기간 (예: 7days, 3months; GDELT 한도 약 3개월)" },
    { name: "lang", type: "string", default: "english", help: "기사 언어 (sourcelang)" },
    { name: "mode", type: "string", default: "companies", choices: ["companies", "articles"], help: "companies: 기업별 집계, articles: 기사 목록" },
  ],
  async fetch(opts) {
    opts["company-dictionary"] = COMPANY_DICTIONARY_VERSION;
    const queries = (opts.query as string[] | undefined)?.length ? (opts.query as string[]) : DEFAULT_QUERIES;
    const lang = String(opts.lang ?? "english"), timespan = String(opts.timespan ?? "3months");
    const articles = new Map<string, Row>();
    for (const [i, q] of queries.entries()) {
      if (i) await sleep(5000); // 요청 간격 5초 권장
      const qs = new URLSearchParams({ query: `${q} sourcelang:${lang}`, mode: "artlist", maxrecords: "250", format: "json", sort: "datedesc", timespan });
      parseArticles(await get(`${API}?${qs}`), q, articles);
    }
    if (!articles.size) console.error("[gnews] 경고: 기사 0건. 검색어나 기간을 확인하세요.");
    const rows = [...articles.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return opts.mode === "articles" ? rows : rank(rows);
  },
};
