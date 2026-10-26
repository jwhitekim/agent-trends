import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPANY_DICTIONARY_VERSION, match } from "../src/companies.ts";
import { newsPeriod, NEWS_DATE_POLICY } from "../src/dates.ts";
import { source } from "../src/sources/naver_news.ts";
import { write } from "../src/output.ts";
import { writeMeta, check } from "../src/compare.ts";

test("신규 기업과 표기 변형을 같은 대표명으로 잡는다", () => {
  assert.deepEqual(match("한글과컴퓨터·한컴, AI 에이전트 출시"), ["한글과컴퓨터"]);
  assert.deepEqual(match("마에스트로 포렌식, AI 에이전트 출시"), ["마에스트로포렌식"]);
  assert.deepEqual(match("마에스트로포렌식, AI 에이전트 출시"), ["마에스트로포렌식"]);
  assert.deepEqual(match("카페24, WebMCP 적용…에이전틱 커머스"), ["카페24"]);
  assert.deepEqual(match("조호, 기업용 에이전틱 AI 전략 발표"), ["Zoho"]);
});

test("짧거나 일반적인 신규 별칭은 제품·사업 문맥으로 구분한다", () => {
  for (const title of ["제논의 역설", "패티 두 장 햄버거", "당근 가격 상승", "광학 줌 렌즈 출시", "brave new world", "미니맥스 알고리즘", "인텔리전스 기술"]) assert.deepEqual(match(title), [], title);
  for (const [title, company] of [
    ["제논, AI 보안 젠가드 출시", "제논"], ["패티, AI 코딩 에이전트 미르코드 출시", "패티"],
    ["당근, 사내 AI 에이전트 180개", "당근"], ["줌, AI 에이전트 통합 컨텍스트 공개", "Zoom"],
    ["미니맥스, M3.1 플래시 공개", "MiniMax"], ["브레이브, BAT 광고 줄이고 AI 에이전트 결제 지원", "Brave"],
    ["인텔 팹의 에이전틱 AI", "Intel"],
  ]) assert.ok(match(title).includes(company), title);
});

test("사전 확장 후 원본 재집계는 제목만 다시 매칭하고 과거 설명 근거를 보존한다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "company-rematch-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const raw = join(dir, "raw.json");
  const collection = newsPeriod(7, new Date("2026-10-26T12:00:00Z"));
  write([{ date: "2026-10-26", title: "한컴, AI 에이전트 공개", link: "https://example.test/a", companies: "Amazon",
    period: collection.period, match_evidence: JSON.stringify([{ company: "Amazon", alias: "AWS", field: "description" }]) }], "json", raw);
  writeMeta(raw, "news", { mode: "articles", days: 7, "date-policy": NEWS_DATE_POLICY, _collection: collection });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("API 호출 금지"); });
  const opts: Record<string, unknown> = { input: raw, mode: "articles" };
  const rows = await source.fetch(opts);
  assert.equal(rows[0].companies, "Amazon;한글과컴퓨터");
  assert.equal(opts["company-dictionary"], COMPANY_DICTIONARY_VERSION);
  assert.equal(opts["description-dictionary"], "legacy-unknown");
  assert.equal(rows[0].matching_coverage, "title-current;description-historical");
  assert.ok(JSON.parse(String(rows[0].match_evidence)).some((e) => e.company === "한글과컴퓨터" && e.field === "title"));
  const old = join(dir, "old.json"), current = join(dir, "current.json");
  writeMeta(old, "news", { days: 7, "company-dictionary": "old" });
  writeMeta(current, "news", { days: 7, "company-dictionary": COMPANY_DICTIONARY_VERSION });
  assert.match(check(old, current), /company-dictionary/);
});

test("사전이 같으면 수집 당시 설명 문맥으로 성립한 제목 매칭을 보존한다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "company-current-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const raw = join(dir, "raw.json"), collection = newsPeriod(7, new Date("2026-10-26T12:00:00Z"));
  const matches = JSON.stringify([{ company: "제논", alias: "제논", field: "title" }]);
  write([{ date: "2026-10-26", title: "제논, 새 제품 공개", link: "https://example.test/a", companies: "제논",
    period: collection.period, match_evidence: matches }], "json", raw);
  writeMeta(raw, "news", { mode: "articles", days: 7, "date-policy": NEWS_DATE_POLICY,
    "company-dictionary": COMPANY_DICTIONARY_VERSION, "description-dictionary": COMPANY_DICTIONARY_VERSION, _collection: collection });
  const rows = await source.fetch({ input: raw, mode: "articles" });
  assert.equal(rows[0].companies, "제논");
  assert.equal(rows[0].match_evidence, matches);
  assert.equal(rows[0].matching_coverage, "title+description-current");
});
