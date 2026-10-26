// OpenAlex: 키워드 관련 논문의 기업 소속 기관 집계 (API 키 불필요).
import type { Row, Source } from "../types.ts";

const API = "https://api.openalex.org";
const DEFAULT_QUERY = '"LLM agent" OR "agentic AI" OR "language model agents"';

async function get(path: string, params: Record<string, string | number>): Promise<any> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const r = await fetch(`${API}/${path}?${qs}`, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`OpenAlex HTTP ${r.status}`);
  return r.json();
}

export const source: Source = {
  name: "openalex",
  label: "논문",
  description: "OpenAlex: 키워드 관련 논문의 기업 소속 기관 집계 (API 키 불필요)",
  options: [
    { name: "query", type: "string", default: DEFAULT_QUERY },
    { name: "from", type: "string", default: "2024-01-01" },
    { name: "country", type: "string", default: "", help: "예: KR, US, CN (비우면 전체)" },
    { name: "top", type: "integer", default: 50 },
  ],
  async fetch(opts) {
    const query = String(opts.query ?? DEFAULT_QUERY);
    const from = String(opts.from ?? "2024-01-01");
    const country = String(opts.country ?? "").toUpperCase();
    const top = Number(opts.top ?? 50);
    if (!Number.isInteger(top) || top < 1) throw new Error("top은 1 이상 정수여야 합니다.");
    if (country && !/^[A-Z]{2}$/.test(country)) throw new Error("country는 KR 같은 두 자리 국가 코드여야 합니다.");
    let flt = `from_publication_date:${from},authorships.institutions.type:company`;
    if (country) flt += `,authorships.institutions.country_code:${country}`;
    const works = await get("works", { search: query, filter: flt, group_by: "authorships.institutions.lineage", per_page: 200 });
    const groups: any[] = works.group_by;
    // group_by 결과에는 대학도 섞여 있으므로 기관 타입을 조회해 기업만 남김
    const ids = groups.map((g) => String(g.key).split("/").pop()!);
    const companies = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 50) {
      const res = await get("institutions", { filter: `openalex:${ids.slice(i, i + 50).join("|")},type:company`, per_page: 50 });
      for (const inst of res.results) if (!country || inst.country_code === country)
        companies.set(String(inst.id).split("/").pop()!, inst.country_code ?? "");
    }
    const rows: Row[] = [];
    for (let i = 0; i < groups.length; i++) {
      const id = ids[i];
      if (companies.has(id)) {
        rows.push({ rank: rows.length + 1, company: groups[i].key_display_name, country: companies.get(id)!, papers: groups[i].count, openalex_id: id });
      }
      if (rows.length === top) break;
    }
    return rows;
  },
};
