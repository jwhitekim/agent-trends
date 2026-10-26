# agent-trends

LLM 에이전트 산업 동향과 주도 기업을 **공식 REST API로** 수집하는 TypeScript CLI(Node.js 24 내장 기능만, npm 의존성 없음).
- 용도: 본인 연구, 산업 동향 파악, 취업처 파악. 범위: 국내 + 글로벌.
- 우선순위: 뉴스(개발·출시 기업) > 논문(연구 기업).

## 시작 전 필수: Node 설치
작업을 시작하면 먼저 `node --version`을 실행한다. Node가 없거나 v24 미만이면 수집 명령을 실행하지 않는다. 사용자에게 설치를 미루지 말고, 에이전트가 아래 명령으로 직접 설치한 뒤 다시 확인한다.

| OS | 설치 명령 |
|---|---|
| Windows | `winget install --id OpenJS.NodeJS.LTS -e` |
| macOS | `brew install node@24` (brew가 없으면 nvm 사용) |
| Linux·WSL | `nvm install 24` (nvm이 없으면 nvm 공식 설치 안내를 먼저 따른다) |

- 설치 명령은 실행 전에 사용자 확인을 받는다. 관리자 권한(sudo 등)이 필요하면 그 이유도 함께 알린다.
- 설치 후 새 터미널에서만 PATH가 잡히면, 그 사실과 터미널 재시작 방법을 사용자에게 알린다.

## 사용 방식
코딩 에이전트가 `node src/cli.ts`를 **도구로 실행**해 조사하고 한국어로 보고한다. 별도 GUI·대시보드는 만들지 않는다.

## 실행
```
node src/cli.ts <명령> [옵션] [--format csv|json] [--out 파일|-]
```
- Node.js 24 이상 필요(내장 TypeScript 실행). `npm install` 불필요. Windows·macOS·Linux 동일. `npm start -- <명령>`도 된다.
- 프로젝트 루트에서 실행한다. 인자 없이 실행하면 사용 안내가 나온다.
- MCP 서버는 `npm run mcp`로 실행한다(`node src/mcp.ts`도 가능). npm 진입점은 Node 버전을 먼저 검사한다.
- 명령: `전체`, `논문`(openalex), `뉴스`(news), `해외뉴스`(gnews), `동향`(itfind). 옵션은 `<명령> --help`.

## 규칙
- Node.js 내장 기능만 쓴다. npm 의존성 추가 금지.
- 공식 API만 쓴다. 웹 크롤링 금지(ITFIND는 robots.txt로 막음). 조사도 웹서치보다 REST API 우선.
- `.env`(API 키) 값은 출력하거나 코드·채팅에 노출하지 않는다.
- 네이버 뉴스는 건수·제목·링크만 쓰고 본문 요약은 하지 않는다(약관상 AI 요약 금지 가능성, 공식 미확인).
- 보고는 코드 구조보다 기능·기획 관점으로, 표 위주로 간결하게.

## 동향 조사·보고

### 스킬 목록 (`.agents/skills/`)

스킬 원본은 `.agents/skills/`에 있고, `.claude/skills`에는 원본을 가리키는 짧은 안내 파일만 둔다(Windows에서도 깨지지 않게 심볼릭 링크는 쓰지 않음). 스킬을 고칠 때는 원본만 고친다.
| 이름 | 언제 | 하는 일 |
|---|---|---|
| trend-report | "동향 보고해줘" | 상위 진입점. 수집→검증→비교 후 보고서 작성 |
| trend-collect | 자료 수집 | 소스·옵션 선택, 한도 지켜 실행, 실패 기록 |
| trend-verify | 수집 직후 | 오매칭 제거, 그룹사 묶기, 기간·출처 확인 |
| trend-compare | "뭐 바뀌었어?" | 최근 두 결과 비교, 첫 실행이면 기준선 저장 |
| company-profile | "업스테이지 조사해줘" | 기업 하나를 모든 소스로 조회해 한 장 요약 |

스킬을 못 읽는 에이전트(Codex 등)는 같은 순서를 따른다: 수집 → 검증 → 비교 → 보고. 기업 하나 조사는 모든 소스를 `--query <기업명>`으로 부른 뒤 검증해 한 장으로 요약한다.

### 도구
MCP 서버 "agent-trends"(도구 openalex, news, gnews, itfind, compare)가 연결돼 있으면 MCP 도구를, 없으면 `node src/cli.ts` 명령을 쓴다.

| 명령 | 얻는 것 | 갱신·한도 |
|---|---|---|
| `뉴스 [--query Q] [--mode articles] [--days N]` | 국내 기사 기업 순위 / 기사 목록. period 열에 집계 기간 | 실시간. `--days` 기본 7(한국 시간 오늘 포함 7개 날짜), 0=제한 없음 |
| `해외뉴스 [--query Q] [--timespan 7days]` | 해외 기사 기업 순위 / 목록 | 15분. 429 재시도가 내장돼 있으므로 조사당 1회만 실행한다. 실패하면 다시 돌리지 않고 건너뛴다 |
| `논문 [--query Q] [--country KR]` | 기업 소속 논문 수 | 매일. 논문 적은 기업(OpenAI 등)은 누락 → 뉴스로 보완 |
| `동향 [--query Q] [--from YYYY-MM-DD]` | 정부 ICT 보고서 목록(제목·날짜만) | 주 1~2건. 하루 100회 한도 → 조사당 1~2회만 |
| `비교 <이름>` | `output/`의 최근 두 결과 비교(신규·증감·사라짐) | 이전 파일이 없으면 안내만 나온다. 같은 조건·집계 버전(`.meta.json`) 결과끼리 비교하고, 다르거나 기록이 없으면 중단 |

- MCP 조회는 기본적으로 저장하지 않는다. 기준선을 남길 때만 `save: true`를 지정한다.
- `전체 --format json --out -`는 소스별 rows/error를 가진 JSON 객체를 출력한다. 개별 파일 경로는 소스 하나씩 지정한다.
- 결과 파일은 새 CSV/JSON 파일에만 저장한다. 기존 파일과 `.env` 경로는 덮어쓰지 않는다.
- 공통 옵션: `--out 파일`(기본 `output/<이름>_<날짜>.csv`, 같은 날 재실행 시 `_HHMM`, 충돌 시 순번 추가, `-`는 화면), `--format csv|json`.
- 실패한 소스는 건너뛰고 사유를 "확인하지 못한 것"에 적는다.

### 검증 기준
- 대표 기사 하나로 기업 전체를 제외하지 않는다. `뉴스 --mode articles`의 `match_evidence`(기업·별칭·title/description)를 보고 기사·기업 조합별로 검증한다. 설명 원문은 출력·요약하지 않는다.
- 수집 기간은 Asia/Seoul의 날짜 경계로 고정한다. `--days 7`은 오늘 포함 7개 날짜이며, 오늘은 수집 시각까지다. `.meta.json`의 collection에 시작·종료일, 수집 시각(UTC), 시간대, API 요청 수를 기록한다.
- 검토 중 재수집하지 않도록 `뉴스 --mode articles --format json --out <새 원본.json>`을 저장한 뒤 `뉴스 --input <원본.json> --review <검토.json>`으로 API 호출 없이 재집계할 수 있다. 원본 검색 조건·기간·수집 시각이 복원되며 원본 옆 `.meta.json`도 필요하다.
- 기업 사전이 바뀌면 `--input`은 제목만 현재 사전으로 재매칭하고 과거 설명 매칭 근거를 보존한다. 설명 전문이 없어 새 기업의 설명 매칭은 복구할 수 없다. `matching_coverage`와 메타의 company-dictionary/description-dictionary를 확인하며, 사전·설명 매칭 범위가 다르면 증감 비교를 중단한다.
- 제외 시 `[{"link":"기사 URL","company":"대표 기업명","reason":"제외 사유"}]` 형식 JSON을 작성하고 `뉴스 --review <파일>`로 재집계한다. 제외 기록은 현재 기사·기업 조합과 정확히 일치해야 한다.
- `articles`는 자동 매칭 기사 수이며 확정된 관련 기사 수가 아니다. `title_articles`와 `description_only_articles`를 구분하고, 출처로는 `representative_title`/`representative_link`를 우선 검토한다.
- 그룹사·계열사는 대표명 하나로 묶고 합산 내역을 적는다.
- 숫자는 기간과 센 대상을 함께 쓴다(예: "국내 기사 235건(최근 7일)"). 출처는 기사·보고서 링크로 단다.
- 비교는 같은 실행 조건(`<파일>.meta.json`) 결과끼리만 한다. 조건이 다르거나 기록이 없으면 비교를 중단한다.
- 첫 실행이라 이전 결과가 없으면 비교하지 않고 "기준선 저장(같은 조건으로 한 번 더 수집한 뒤 비교)"으로 적는다.

### 보고 형식 (한국어)
```
# <주제> 보고 (<날짜>)
결론: 한두 문장.

| 기업 | 국가 | 근거(논문·기사 수, 기간) | 무엇을 하나 | 출처 |

## 지난번 대비 변화 (또는 "기준선 저장")
## 눈여겨볼 점 (최대 3개)
## 확인하지 못한 것
```
- 저장을 요청받으면 `reports/<주제>_<YYYYMMDD>.md`에 쓴다.

## 구조와 소스 추가
| 파일 | 역할 |
|---|---|
| `src/cli.ts` | CLI, `.env` 자동 로드(현재 폴더 → 프로젝트 루트) |
| `src/mcp.ts` | MCP 서버 |
| `src/output.ts` | CSV(utf-8-sig)/JSON 출력, `.meta.json` 저장 |
| `src/companies.ts` | 기업명 사전(대표명 → 별칭), 매칭·순위 |
| `src/sources/*.ts` | 소스 하나당 모듈 하나 |

새 소스: `src/sources/<이름>.ts`에서 `export const source: Source`를 구현하고 `src/sources/index.ts`의 `SOURCES`에 추가한다.

## API에서 확인된 사실
- **NAVER 검색 API**는 NAVER API HUB로 이전됨. `GET https://naverapihub.apigw.ntruss.com/search/v1/news`, 헤더 `X-NCP-APIGW-API-KEY-ID`/`X-NCP-APIGW-API-KEY`. 파라미터(query, display≤100, start≤1000, sort=sim|date)·응답 형식은 기존과 동일. 일 25,000회. 키: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`.
- **ITFIND ICT동향정보**(`http://open.itfind.or.kr/openapi/service/ICTTrendInformationService/getCrdnsScrapInfo`, 키 `DATA_GO_KR_KEY`)
  - `issuedStart`/`issuedEnd`(YYYYMMDD) 없으면 무조건 0건.
  - `searchType=0`은 제목+출처+내용 검색이라 무관한 자료도 섞임. 제목 전용 코드값은 미확인.
  - 응답 issued 형식 `2026.10.14`. fileLink 없는 자료 있음. 개발계정 일 100회.
- **GDELT DOC 2.0**: 5초당 1회 제한, 429 시 재시도 로직 있음.
- **OpenAlex**: 키 불필요. 1차 결과(2024~, 기업 소속 에이전트 논문 7,118편) 상위: Microsoft 704, Alphabet 541, Alibaba 535 / 국내 삼성 43, LG 32, 네이버 27.
