# 명령 사용법 (node src/cli.ts)

LLM 에이전트 업계에서 어떤 기업이 많이 언급되는지 모아 주는 터미널 명령입니다.

## 이것만 기억하세요

```
node src/cli.ts 전체
```

모든 자료를 한 번에 모아 `output/` 폴더에 저장하고, 결과 상위 10개를 화면에 보여 줍니다.

## 하나씩 보기

| 입력 | 보여 주는 것 |
|---|---|
| `node src/cli.ts 논문` | 에이전트 논문을 많이 낸 기업 순위 (글로벌) |
| `node src/cli.ts 뉴스` | 국내 뉴스에 많이 나온 기업 순위 |
| `node src/cli.ts 해외뉴스` | 해외 뉴스에 많이 나온 기업 순위 |
| `node src/cli.ts 동향` | 정부 ICT 동향 보고서 목록 |
| `node src/cli.ts` | 이 안내를 다시 보기 |

결과 파일은 `output/<이름>_<날짜>.csv`로 저장됩니다. 엑셀로 바로 열 수 있습니다.

## 조금 더 쓰고 싶을 때

| 하고 싶은 것 | 입력 예시 |
|---|---|
| 국내 기업만 보기 | `node src/cli.ts 논문 --country KR` |
| 검색어 바꾸기 | `node src/cli.ts 뉴스 --query "AI 에이전트 출시"` |
| 순위 대신 기사 목록 보기 | `node src/cli.ts 뉴스 --mode articles` |
| 최근 1주일만 보기 | `node src/cli.ts 해외뉴스 --timespan 7days` |
| 국내 뉴스 기간 정하기 | `node src/cli.ts 뉴스 --days 30` (0=제한 없음) |
| 지난 결과와 비교 | `node src/cli.ts 비교 뉴스` |
| 기간 정하기 | `node src/cli.ts 동향 --from 2025-01-01` |
| 원하는 파일로 저장 | `node src/cli.ts 논문 --out 내파일.csv` |
| JSON으로 저장 | `node src/cli.ts 논문 --format json` |

명령마다 쓸 수 있는 옵션은 `node src/cli.ts 논문 --help`처럼 확인합니다.

## 알아 두면 좋은 것

- **API 키:** 뉴스와 동향은 프로젝트 폴더의 `.env`에 키가 있어야 합니다. 없으면 무엇이 없는지 알려 줍니다.
- **논문:** OpenAI, Anthropic처럼 논문이 적은 기업은 순위에 잘 안 나옵니다. 뉴스 결과와 함께 보세요.
