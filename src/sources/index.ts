// 데이터 소스 등록. 새 소스는 `export const source: Source`를 가진 모듈로 만들고 여기에 추가.
import type { Source } from "../types.ts";
import { source as openalex } from "./openalex.ts";
import { source as news } from "./naver_news.ts";
import { source as gnews } from "./gdelt.ts";
import { source as itfind } from "./itfind.ts";

export const SOURCES: Source[] = [openalex, news, gnews, itfind];
