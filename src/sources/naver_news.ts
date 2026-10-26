// 네이버 뉴스(국내): 에이전트 기사에서 기업 언급 집계 (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 필요).
import type { Row, Source } from "../types.ts";
import { COMPANY_DICTIONARY_VERSION, evidence, rank } from "../companies.ts";
import { applyReview, readReview } from "../review.ts";
import { NEWS_DATE_POLICY, newsPeriod, seoulDate } from "../dates.ts";
import { readNewsSnapshot } from "../news-snapshot.ts";

const API = "https://naverapihub.apigw.ntruss.com/search/v1/news"; // NAVER API HUB
const DEFAULT_QUERIES = ["AI 에이전트", "에이전틱 AI", "LLM 에이전트"];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function clean(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** RFC 2822 pubDate를 한국 날짜 YYYY-MM-DD로 정규화한다. */
export function pubDate(s: string): string {
  const date = new Date(s);
  if (!Number.isFinite(date.getTime())) throw new Error("뉴스 응답에 잘못된 발행 시각이 있습니다.");
  return seoulDate(date);
}

async function search(query: string, start: number, cid: string, secret: string, display: number): Promise<any[]> {
  const qs = new URLSearchParams({ query, display: String(display), start: String(start), sort: "date" });
  const r = await fetch(`${API}?${qs}`, {
    headers: { "X-NCP-APIGW-API-KEY-ID": cid, "X-NCP-APIGW-API-KEY": secret },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`네이버 뉴스 API HTTP ${r.status}`);
  return (await r.json()).items;
}

export const source: Source = {
  name: "news",
  label: "뉴스",
  description: "네이버 뉴스(국내): 에이전트 기사에서 기업 언급 집계 (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 필요)",
  options: [
    { name: "query", type: "string[]", help: `여러 번 지정 가능 (기본: ${DEFAULT_QUERIES.join(", ")})` },
    { name: "max", type: "integer", default: 1000, help: "검색어당 최대 기사 수 (API 한도 1000)" },
    { name: "mode", type: "string", default: "companies", choices: ["companies", "articles"], help: "companies: 기업별 집계, articles: 기사 목록" },
    { name: "days", type: "integer", default: 7, help: "한국 시간 오늘 포함 N개 날짜 (기본 7, 0: 기간 제한 없음)" },
    { name: "review", type: "string", default: "", help: "기사·기업별 제외 기록 JSON (link, company, reason)" },
    { name: "input", type: "string", default: "", help: "저장된 원본 기사 JSON을 API 호출 없이 재집계 (원본 조건 복원)" },
  ],
  async fetch(opts) {
    const review = opts.review ? readReview(String(opts.review)) : null;
    const exclusions = review?.exclusions ?? [];
    if (review) opts["review-sha256"] = review.digest;
    if (opts.input) {
      const rows = applyReview(readNewsSnapshot(String(opts.input), opts), exclusions);
      return opts.mode === "articles" ? rows : rank(rows).map((r) => ({ ...r, period: (opts._collection as { period: string }).period }));
    }
    const cid = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
    if (!cid || !secret) throw new Error("NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수를 설정하세요.");
    const queries = (opts.query as string[] | undefined)?.length ? (opts.query as string[]) : DEFAULT_QUERIES;
    const max = Number(opts.max ?? 1000);
    const days = Number(opts.days ?? 7) || 0;
    if (!Number.isInteger(days) || days < 0 || !Number.isInteger(max) || max < 1 || max > 1000)
      throw new Error("days는 0 이상 정수, max는 1~1000 정수여야 합니다.");
    const now = new Date();
    opts.query = queries;
    opts.days = days;
    opts.max = max;
    const collection = { ...newsPeriod(days, now), requests: 0, cappedQueries: [] as string[] };
    const { today, since, period } = collection;
    opts["date-policy"] = NEWS_DATE_POLICY;
    opts["company-dictionary"] = COMPANY_DICTIONARY_VERSION;
    opts["description-dictionary"] = COMPANY_DICTIONARY_VERSION;
    opts._collection = collection;
    console.error(`[뉴스] 집계 기간: ${period}`);

    const articles = new Map<string, Row>();
    for (const q of queries) {
      for (let start = 1; start <= Math.min(max, 1000); start += 100) {
        const display = Math.min(100, max - start + 1);
        collection.requests++;
        const items = await search(q, start, cid, secret, display);
        let outOfRange = false;
        for (const it of items) {
          const pub = pubDate(it.pubDate);
          if (pub > today || Date.parse(it.pubDate) > now.getTime()) continue;
          if (since && pub < since) { outOfRange = true; continue; } // sort=date라 이후는 더 오래됨
          const link = it.originallink || it.link;
          if (articles.has(link)) continue;
          const title = clean(it.title), desc = clean(it.description);
          const matches = evidence(title, desc);
          articles.set(link, { date: pub, title, companies: [...new Set(matches.map((e) => e.company))].join(";"),
            query: q, link, period, collected_at: collection.collectedAt, time_zone: collection.timeZone,
            match_evidence: JSON.stringify(matches) });
        }
        if (outOfRange || items.length < display) break;
        if (start + display > max) collection.cappedQueries.push(q);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (collection.cappedQueries.length)
      console.error(`[뉴스] 경고: 검색어 ${collection.cappedQueries.length}개가 max=${max} 한도에 도달했습니다. 기간 내 기사 일부가 누락될 수 있습니다.`);
    const rows = applyReview([...articles.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))), exclusions);
    if (opts.mode === "articles") return rows;
    return rank(rows).map((r) => ({ ...r, period }));
  },
};
