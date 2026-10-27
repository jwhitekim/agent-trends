# agent-trends

LLM 에이전트 관련 국내·해외 뉴스, 논문, 정부 ICT 동향을 공식 REST API로 모으는 CLI입니다. 기업별 기사·논문 수와 출처를 정리해, 업계 흐름과 조사할 기업을 빠르게 볼 수 있습니다.

```text
$ node src/cli.ts 논문 --country KR
[논문] 수집 중...
[논문] 16행 -> output/논문_20261028.csv
  rank  company                          country  papers
  ----  -------------------------------  -------  ------
  1     Samsung (South Korea)            KR       45
  2     LG (South Korea)                 KR       33
  3     Naver (South Korea)              KR       27
  4     LG AI Research (South Korea)     KR       23
  5     NAVER Cloud (South Korea)        KR       22
  6     Samsung Electronics (South Ko…  KR       18
  7     Samsung SDS (South Korea)        KR       9
  8     UpStage (South Korea)            KR       6
  9     PricewaterhouseCoopers (South…  KR       5
  10    Kakao Corporation (South Kore…  KR       5
  … 외 6행
```

<sub>2026-10-28 실행 결과입니다. 2024-01-01 이후 기본 에이전트 검색어에 해당하는 논문을 국내 기업 소속별로 셌습니다(OpenAlex, API 키 불필요).</sub>

## 시작하기

Node.js 24 이상이 필요하고, npm 패키지 설치는 필요 없습니다. API 키 설정은 [사용설명서](사용설명서.md)에 있습니다.

### 에이전트에게 묻기

이 폴더에서 Claude Code, Codex, Cursor 같은 코딩 에이전트를 열고 묻습니다. 에이전트는 [AGENTS.md](AGENTS.md)의 절차대로 수집 → 검증 → 비교한 뒤 한국어로 보고합니다.

- "이번 주 에이전트 동향 보고해줘"
- "업스테이지 조사해줘"
- "지난번이랑 뭐 바뀌었어?"

### 직접 실행

```sh
node src/cli.ts 뉴스 --days 7       # 국내 뉴스, 오늘 포함 7일
node src/cli.ts 논문 --country KR   # 국내 기업 소속 논문
```

결과는 `output/<이름>_<날짜>.csv`에, 실행 조건은 `<파일>.meta.json`에 저장되고 상위 10행이 화면에 나옵니다. 기존 파일은 덮어쓰지 않습니다.

## 수집하는 자료

| 명령 | 소스 | 내용 | API 키 (`.env`) |
| --- | --- | --- | --- |
| `뉴스` | NAVER API HUB | 국내 뉴스의 기업 언급 순위·기사 | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| `해외뉴스` | GDELT | 해외 뉴스 제목의 기업 언급 순위·기사 | 불필요 |
| `논문` | OpenAlex | 기업 소속별 에이전트 논문 수 | 불필요 |
| `동향` | ITFIND | 정부 ICT 동향 보고서 제목·날짜 | `DATA_GO_KR_KEY` |

기사 수는 기업명 자동 매칭 결과라 관련성을 확인하고 해석해야 합니다. 비교는 실행 조건과 집계 기준이 같은 결과끼리만 합니다. 검증·재집계, MCP 서버, 소스 추가는 [AGENTS.md](AGENTS.md)를 보세요.

## 라이선스

LICENSE 파일이 없습니다. 라이선스는 확인이 필요합니다.
