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

Node.js 24 이상과 인터넷 연결이 필요합니다. 추가 패키지 설치나 API 키 설정 없이 저장소 루트에서 실행합니다.

```sh
node src/cli.ts 논문 --country KR
```

국내 기업 소속 논문 순위의 상위 10행을 화면에 보여 주고, 전체 결과를 `output/`에 CSV로 저장합니다.

## 관련 문서

- [설치·API 키 설정·에이전트 사용법·전체 명령 안내](사용설명서.md)
- [수집·검증·비교 규칙과 MCP 실행·소스 추가 안내](AGENTS.md)

## 라이선스

LICENSE 파일이 없습니다. 라이선스는 확인이 필요합니다.
