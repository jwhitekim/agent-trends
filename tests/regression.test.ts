import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { evidence, match, rank } from "../src/companies.ts";
import { applyReview } from "../src/review.ts";
import { source as papers } from "../src/sources/openalex.ts";
import { source as news } from "../src/sources/naver_news.ts";
import * as output from "../src/output.ts";
import * as compare from "../src/compare.ts";
import { saveResult } from "../src/results.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
function temp(t: test.TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "agent-trends-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function child(code: string, cwd: string, input = "") {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd, input, encoding: "utf8", timeout: 10000,
  });
  assert.equal(r.error, undefined);
  return r;
}
const moduleUrl = (file: string) => new URL(file, new URL("../", import.meta.url)).href;

test("짧은 별칭 오매칭을 줄이고 영문 대소문자를 처리한다", () => {
  assert.deepEqual(match("메타버스 메타데이터 그록봇 TASK HTML"), []);
  assert.deepEqual(match("메타는 AI 공개"), ["Meta"]);
  assert.deepEqual(match("openai와 LG전자, SK텔레콤"), ["LG", "SK", "OpenAI"]);
  assert.ok(evidence("SKT 출시", "AWS 협력").some((e) => e.company === "Amazon" && e.field === "description"));
});

test("제외는 기사·기업 조합만 적용하고 정상 기사는 유지한다", () => {
  const rows = [{ date: "2026-10-26", title: "타사 소식", link: "a", companies: "Amazon;Meta" },
    { date: "2026-10-25", title: "AWS 플랫폼", link: "b", companies: "Amazon" }];
  const reviewed = applyReview(rows, [{ link: "a", company: "Amazon", reason: "무관한 언급" }]);
  assert.equal(reviewed[0].companies, "Meta");
  assert.equal(reviewed[1].companies, "Amazon");
  const amazon = rank(reviewed).find((r) => r.company === "Amazon")!;
  assert.equal(amazon.articles, 1);
  assert.equal(amazon.title_articles, 1);
  assert.throws(() => applyReview(rows, [{ link: "missing", company: "Amazon", reason: "오류" }]));
});

test("대표 기사는 제목 매칭을 우선하고 설명 매칭 건수를 구분한다", () => {
  const [r] = rank([{ date: "2026-10-26", title: "가비아 공시", link: "a", companies: "Amazon" },
    { date: "2026-10-25", title: "AWS 공개", link: "b", companies: "Amazon;Amazon" }]);
  assert.equal(r.articles, 2);
  assert.equal(r.description_only_articles, 1);
  assert.equal(r.representative_link, "b");
});

test("KR 논문 필터가 공동저자의 미국 기관을 제외하고 순위를 다시 매긴다", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(++calls === 1 ? {
    group_by: [{ key: "I1", key_display_name: "US company", count: 50 },
      { key: "I2", key_display_name: "KR company", count: 40 }],
  } : { results: [{ id: "I1", country_code: "US" }, { id: "I2", country_code: "KR" }] })));
  const rows = await papers.fetch({ country: "kr", top: 1 });
  assert.deepEqual(rows.map((r) => [r.rank, r.country, r.papers]), [[1, "KR", 40]]);
  await assert.rejects(papers.fetch({ top: 0 }));
});

test("뉴스는 설명 원문 대신 매칭 근거를 출력하며 max를 지킨다", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-26T12:00:00Z") });
  const original = { id: process.env.NAVER_CLIENT_ID, secret: process.env.NAVER_CLIENT_SECRET };
  process.env.NAVER_CLIENT_ID = "test"; process.env.NAVER_CLIENT_SECRET = "test";
  t.after(() => {
    for (const [key, value] of [["NAVER_CLIENT_ID", original.id], ["NAVER_CLIENT_SECRET", original.secret]])
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  });
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(new URL(url).searchParams.get("display"), "1");
    return new Response(JSON.stringify({ items: [{ title: "AWS 공개", description: "원문비공개 메타버스",
      originallink: "https://example.test/a", pubDate: "Mon, 26 Oct 2026 09:00:00 +0900" }] }));
  });
  const rows = await news.fetch({ query: ["AI"], max: 1, days: 0, mode: "articles" });
  assert.equal(rows[0].companies, "Amazon");
  assert.ok(String(rows[0].match_evidence).includes("AWS"));
  assert.ok(!JSON.stringify(rows).includes("원문비공개"));
  await assert.rejects(news.fetch({ days: -1 }));
});

test("동일 조건만 비교하며 불일치·기록 부재·이전 버전은 중단한다", async (t) => {
  const dir = temp(t), a = join(dir, "a.csv"), b = join(dir, "b.csv");
  output.write([{ company: 'A,"B\nC', articles: 2 }], "csv", a);
  output.write([{ company: 'A,"B\nC', articles: 3 }], "csv", b);
  compare.writeMeta(a, "news", { days: 7 });
  compare.writeMeta(b, "news", { days: 7 });
  const opts = { from: a, to: b };
  assert.equal((await compare.fetch(opts))[0].change, 1);
  assert.equal((await compare.fetch(opts))[0].company, 'A,"B\nC');
  writeFileSync(b + ".meta.json", JSON.stringify({ schemaVersion: 2, command: "news", options: { days: 30 } }));
  await assert.rejects(compare.fetch(opts), /중단/);
  rmSync(b + ".meta.json");
  await assert.rejects(compare.fetch(opts), /중단/);
  writeFileSync(b + ".meta.json", JSON.stringify({ command: "news", options: { days: 7 } }));
  await assert.rejects(compare.fetch(opts), /버전/);
  assert.throws(() => compare.files({ from: a }), /함께/);
});

test("검토 파일 내용이 바뀌면 같은 경로여도 비교를 중단한다", async (t) => {
  const dir = temp(t), review = join(dir, "review.json"), a = join(dir, "a.json"), b = join(dir, "b.json");
  output.write([], "json", a); output.write([], "json", b);
  writeFileSync(review, "[]"); compare.writeMeta(a, "news", { review });
  writeFileSync(review, '[{"reason":"changed"}]'); compare.writeMeta(b, "news", { review });
  await assert.rejects(compare.fetch({ from: a, to: b }), /중단/);
});

test("기존 파일과 .env 경로를 보호한다", (t) => {
  const dir = temp(t), path = join(dir, "data.json");
  output.write([], "json", path);
  assert.throws(() => output.write([{ x: 1 }], "json", path), /EEXIST/);
  assert.equal(readFileSync(path, "utf8"), "[]");
  assert.throws(() => output.write([], "json", join(dir, ".env")), /출력/);
  assert.throws(() => output.write([], "json", join(dir, ".env.backup.json")), /출력/);
});

test("같은 분에 여러 번 저장해도 서로 다른 결과와 메타 파일을 만든다", (t) => {
  const dir = temp(t);
  const r = child(`import {saveResult} from ${JSON.stringify(moduleUrl("src/results.ts"))};
    for(let i=0;i<4;i++) saveResult([{count:i}],"csv","뉴스","news",{days:7});`, dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readdirSync(join(dir, "output")).length, 8);
});

test("자동 비교는 최신 결과와 조건이 같은 이전 결과를 선택한다", (t) => {
  const dir = temp(t);
  const r = child(`import {writeFileSync,utimesSync} from "node:fs";
    import {write,} from ${JSON.stringify(moduleUrl("src/output.ts"))};
    import {writeMeta,files} from ${JSON.stringify(moduleUrl("src/compare.ts"))};
    for(const [i,days] of [7,30,7].entries()) {
      const f="output/뉴스_20261026_"+i+".csv";
      write([{company:"A",articles:i}],"csv",f);writeMeta(f,"news",{days});utimesSync(f,i+1,i+1);
    }
    console.log(JSON.stringify(files({name:"뉴스"})));console.log(JSON.stringify(files({name:"없는결과"})));`, dir);
  assert.equal(r.status, 0, r.stderr);
  const [selected, missing] = r.stdout.trim().split("\n").map((s) => JSON.parse(s));
  assert.match(selected[0][0], /_0\.csv$/);
  assert.match(selected[0][1], /_2\.csv$/);
  assert.equal(missing[0], null);
  assert.match(missing[1], /이전 결과가 없습니다/);
});

test("전체 --out -는 저장 없이 하나의 JSON과 소스별 실패를 반환한다", (t) => {
  const dir = temp(t);
  const r = child(`import {SOURCES} from ${JSON.stringify(moduleUrl("src/sources/index.ts"))};
    for(const s of SOURCES) s.fetch=async()=>{if(s.name==="gnews")throw Error("mock failure");return [{count:1}];};
    process.argv=[process.execPath,"cli","전체","--format","json","--out","-"];
    await import(${JSON.stringify(moduleUrl("src/cli.ts"))});`, dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).gnews.error, "mock failure");
  assert.deepEqual(readdirSync(dir), []);
});

test("MCP는 초기화·도구 목록·조회 무저장·명시적 저장·인자 오류를 처리한다", (t) => {
  const dir = temp(t);
  const messages = [
    { id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    { method: "notifications/initialized" }, { id: 2, method: "tools/list" },
    { id: 3, method: "tools/call", params: { name: "openalex", arguments: { top: 3, limit: 3 } } },
    { id: 4, method: "tools/call", params: { name: "openalex", arguments: { save: true } } },
    { id: 5, method: "tools/call", params: { name: "openalex", arguments: { limit: -1 } } },
  ];
  const r = child(`import {SOURCES} from ${JSON.stringify(moduleUrl("src/sources/index.ts"))};
    SOURCES[0].fetch=async()=>[{company:"A"},{company:"B"},{company:"C"}];
    await import(${JSON.stringify(moduleUrl("src/mcp.ts"))});`, dir,
    messages.map((m) => JSON.stringify({ jsonrpc: "2.0", ...m })).join("\n") + "\n");
  assert.equal(r.status, 0, r.stderr);
  const responses = r.stdout.trim().split("\n").map((s) => JSON.parse(s));
  assert.equal(responses.length, 5);
  assert.equal(responses[0].result.protocolVersion, "2025-06-18");
  assert.equal(responses[1].result.tools.length, 5);
  const queried = JSON.parse(responses[2].result.content[0].text);
  assert.equal(queried.returned, 3); assert.equal(queried.saved, undefined);
  assert.equal(responses[4].result.isError, true);
  assert.equal(readdirSync(join(dir, "output")).length, 2);
});

test("npm 실행 진입점은 도움말을 제공한다", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts/run.mjs"), "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /동향 수집/);
});
