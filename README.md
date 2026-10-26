# agent-trends

LLM 에이전트 산업 동향과 주도 기업을 공식 REST API로 모읍니다. Node.js 24로 실행하며 추가 패키지가 없습니다.

처음 쓰는 분은 [사용설명서](사용설명서.md)를 보세요.

## 주 사용법: Claude Code, Codex, Cursor 등 에이전트에게 묻기

이 폴더에서 코딩 에이전트(Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot 등)를 켜고 이렇게 묻습니다.

- "이번 주 에이전트 동향 보고해줘"
- "업스테이지 조사해줘"

- "지난번이랑 뭐 바뀌었어?"

에이전트는 [AGENTS.md](AGENTS.md)의 절차(스킬 원본은 `.agents/skills/`, Claude Code는 `.claude/skills`의 안내 파일을 거쳐 읽음)에 따라 수집 → 검증 → 비교 순으로 조사한 뒤 한국어로 보고합니다. MCP 서버 "agent-trends"가 연결돼 있으면 그 도구를 씁니다.

## 직접 실행

Node.js 24 이상이 필요합니다. `npm install`은 필요 없습니다. 프로젝트 루트에서 실행합니다.

```
node src/cli.ts 뉴스 --days 7
node src/cli.ts 논문 --country KR
node src/cli.ts 비교 <이름>
```

`npm start -- <명령>`도 됩니다. MCP 서버는 `npm run mcp`로 띄웁니다.

결과는 `output/<이름>_<날짜>.csv`(같은 날 재실행 시 `_HHMM`, 충돌 시 순번 추가)에 자동 저장되고(실행 조건은 `<파일>.meta.json`에 함께 저장), 상위 10개를 화면에 보여 줍니다. 옵션은 `node src/cli.ts <명령> --help` 또는 [AGENTS.md](AGENTS.md)의 도구 표를 봅니다.

## 소스

| 명령 | 내용 | 갱신 주기 | API 키 (.env) |
|---|---|---|---|
| 뉴스 | 국내 뉴스(NAVER API HUB)의 기업 언급 순위·기사 목록 | 실시간 | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| 해외뉴스 | 해외 뉴스(GDELT)의 기업 언급 순위·기사 목록 | 15분. 429 차단 잦음 | 불필요 |
| 논문 | 에이전트 논문(OpenAlex)의 기업 소속별 논문 수 | 매일 | 불필요 |
| 동향 | 정부 ICT 동향 보고서(ITFIND) 목록. 제목·날짜만 | 주 1~2건. 하루 100회 한도 | `DATA_GO_KR_KEY` |

`.env`는 현재 폴더, 그다음 프로젝트 루트 순으로 읽습니다. 기업명 사전은 `src/companies.ts`에서 고칩니다.

## 소스 추가

`src/sources/<이름>.ts`에서 `export const source: Source`를 구현하고 `src/sources/index.ts`의 `SOURCES`에 추가합니다. npm 의존성은 추가하지 않습니다.

검증·저장 규칙은 [AGENTS.md](AGENTS.md)의 검증 기준을 따릅니다. MCP 조회는 기본적으로 저장하지 않으며, 기준선이 필요하면 `save: true`를 지정합니다. 전체 결과를 저장 없이 받으려면 `node src/cli.ts 전체 --format json --out -`를 사용합니다. `npm test`는 실제 API를 호출하지 않는 회귀 테스트입니다.

기업 사전을 확장한 뒤에도 저장 원본을 `뉴스 --input <원본.json>`으로 다시 집계할 수 있습니다. 제목은 새 사전으로 매칭하고, 설명 전문이 없는 과거 원본의 설명 매칭은 당시 근거만 보존합니다. 사전 버전이 다른 결과는 직접 비교하지 않습니다.
