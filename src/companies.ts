/** 기업명 사전: 대표명 -> 기사에서 찾을 별칭 목록. 새 기업은 여기에 추가. */
import type { Row } from "./types.ts";
import { createHash } from "node:crypto";

export const COMPANIES: Record<string, string[]> = {
  "삼성": ["삼성전자", "삼성SDS", "삼성에스디에스", "삼성"],
  "LG": ["LG AI연구원", "LG CNS", "LG유플러스", "LG전자", "LG"],
  "SK": ["SK텔레콤", "SKT", "SK AX", "SK C&C", "SK"],
  "KT": ["KT"],
  "네이버": ["네이버", "NAVER", "하이퍼클로바"],
  "카카오": ["카카오", "Kakao", "카나나"],
  "업스테이지": ["업스테이지", "Upstage"],
  "포티투마루": ["포티투마루"],
  "솔트룩스": ["솔트룩스"],
  "코난테크놀로지": ["코난테크놀로지"],
  "마음AI": ["마음AI"],
  "뤼튼": ["뤼튼"],
  "OpenAI": ["오픈AI", "OpenAI", "챗GPT", "ChatGPT"],
  "Anthropic": ["앤트로픽", "Anthropic", "클로드"],
  "Google": ["구글", "Google", "딥마인드", "제미나이", "Gemini"],
  "Microsoft": ["마이크로소프트", "Microsoft", "MS", "코파일럿", "Copilot"],
  "Amazon": ["아마존", "AWS", "Amazon"],
  "Meta": ["메타", "Meta"],
  "Nvidia": ["엔비디아", "NVIDIA", "Nvidia"],
  "Salesforce": ["세일즈포스", "Salesforce"],
  "ServiceNow": ["서비스나우", "ServiceNow"],
  "IBM": ["IBM"],
  "Mistral": ["미스트랄", "Mistral"],
  "Alibaba": ["알리바바", "Alibaba", "Qwen"],
  "Tencent": ["텐센트", "Tencent"],
  "ByteDance": ["바이트댄스", "ByteDance"],
  "Baidu": ["바이두", "Baidu"],
  "Huawei": ["화웨이", "Huawei"],
  "Apple": ["애플", "Apple"],
  "SAP": ["SAP"],
  "Palantir": ["팔란티어", "Palantir"],
  "xAI": ["xAI", "그록", "Grok"],
  "Cohere": ["코히어", "Cohere"],
  "Perplexity": ["퍼플렉시티", "Perplexity"],
  // 2026-10-20~26 수집 기사 제목에서 개발·출시·운영을 확인한 기업.
  "제논": ["제논"],
  "한글과컴퓨터": ["한글과컴퓨터", "한컴"],
  "허드슨에이아이": ["허드슨에이아이"],
  "Zoho": ["조호", "Zoho"],
  "패티": ["패티", "미르코드"],
  "티맥스티베로": ["티맥스티베로"],
  "마에스트로포렌식": ["마에스트로포렌식", "마에스트로 포렌식"],
  "윈웨이": ["윈웨이"],
  "넥스톰": ["넥스톰"],
  "Cloudflare": ["클라우드플레어", "Cloudflare"],
  "Intel": ["인텔", "Intel"],
  "나무에이엑스": ["나무에이엑스"],
  "인핸스": ["인핸스"],
  "카페24": ["카페24", "Cafe24"],
  "당근": ["당근", "당근마켓"],
  "트웰브랩스": ["트웰브랩스", "Twelve Labs"],
  "Coinbase": ["코인베이스", "Coinbase"],
  "씽킹AI": ["씽킹AI"],
  "Cisco": ["시스코", "Cisco", "스플렁크", "Splunk"],
  "이스트소프트": ["이스트소프트"],
  "OutSystems": ["아웃시스템즈", "OutSystems"],
  "Zoom": ["줌", "Zoom"],
  "스렛북": ["스렛북", "ThreatBook"],
  "SailPoint": ["세일포인트", "SailPoint"],
  "비젠트로": ["비젠트로"],
  "플래티어": ["플래티어"],
  "원라인에이아이": ["원라인에이아이"],
  "MiniMax": ["미니맥스", "MiniMax"],
  "Brave": ["브레이브", "Brave"],
  "안랩": ["안랩", "AhnLab"],
  "Fortinet": ["포티넷", "Fortinet"],
  "올마이투어": ["올마이투어"],
  "삼보컴퓨터": ["삼보컴퓨터"],
};

// 동음이의어가 있는 짧은 이름은 기사에 제품·사업 문맥이 있을 때만 인정한다.
const CONTEXTS: Record<string, RegExp> = {
  "제논": /젠가드|제논[^.!?]*(?:AI|인공지능|에이전트|보안)/iu,
  "패티": /미르코드/iu,
  "당근": /당근마켓|당근[^.!?]*(?:AI|에이전트|중고거래)/iu,
  Zoom: /zoom[^.!?]*(?:AI|agent|meeting|video)|줌[^.!?]*(?:AI|에이전트|회의|비디오|컨텍스트)/iu,
  Brave: /브레이브[^.!?]*(?:BAT|보상|광고|브라우저|에이전트)|brave[^.!?]*(?:browser|agent|BAT)/iu,
  MiniMax: /미니맥스[^!?]*(?:M\d|플래시|신모델|모델[^!?]*(?:공개|출시))|MiniMax[^!?]*(?:M\d|Flash|launch|release)/iu,
};

export const COMPANY_DICTIONARY_VERSION = createHash("sha256").update(JSON.stringify({
  companies: COMPANIES, contexts: Object.entries(CONTEXTS).map(([k, v]) => [k, v.source, v.flags]), matcher: 2,
})).digest("hex");

// 영문 약칭(MS, SK, KT 등)이 다른 단어의 일부로 잡히지 않게 영문/숫자 경계를 둠
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = Object.entries(COMPANIES).map(([company, aliases]) => ({ company,
  aliases: aliases.map((alias) => ({ alias, pattern: new RegExp(
    `(?<![A-Za-z0-9])${esc(alias)}${["메타", "그록", "인텔", "조호", "줌", "제논", "패티", "당근", "미니맥스"].includes(alias)
      ? "(?=$|[^가-힣A-Za-z0-9]|(?:는|은|가|이|의|와|과|를|을|도|에서)(?=$|[^가-힣A-Za-z0-9]))"
      : "(?![A-Za-z0-9])"}`, "i") })),
}));

/** 원문을 복사하지 않고 매칭된 별칭과 위치만 제공한다. */
export function evidence(title: string, description = "") {
  const text = `${title} ${description}`;
  return PATTERNS.filter(({ company }) => !CONTEXTS[company] || CONTEXTS[company].test(text))
    .flatMap(({ company, aliases }) => aliases.flatMap(({ alias, pattern }) =>
    (["title", "description"] as const).filter((field) => pattern.test(field === "title" ? title : description))
      .map((field) => ({ company, alias, field }))));
}

/** text에 언급된 기업 대표명 목록. */
export function match(text: string): string[] {
  return [...new Set(evidence(text).map((e) => e.company))];
}

/** 기사 목록(date, title, link, companies 포함, 최신순)을 기업별 언급 수 순위로 집계. */
export function rank(articles: Row[]): Row[] {
  const stats = new Map<string, Row>();
  for (const a of articles) {
    for (const name of new Set(String(a.companies ?? "").split(";").filter(Boolean))) {
      const inTitle = match(String(a.title)).includes(name);
      let s = stats.get(name);
      if (!s) {
        s = { company: name, articles: 0, title_articles: 0, description_only_articles: 0,
          latest: String(a.date), latest_title: String(a.title), latest_link: String(a.link),
          representative_title: String(a.title), representative_link: String(a.link) };
        stats.set(name, s);
      }
      if (inTitle && s.title_articles === 0) {
        s.representative_title = String(a.title);
        s.representative_link = String(a.link);
      }
      s.articles = Number(s.articles) + 1;
      const column = inTitle ? "title_articles" : "description_only_articles";
      s[column] = Number(s[column]) + 1;
    }
  }
  const ranked = [...stats.values()].sort((x, y) => Number(y.articles) - Number(x.articles));
  return ranked.map((s, i) => ({ rank: i + 1, ...s }));
}
