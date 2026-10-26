export type Row = Record<string, string | number>;

export interface Option {
  name: string;
  type: "string" | "integer" | "boolean" | "string[]";
  default?: string | number | boolean | string[];
  choices?: string[];
  help?: string;
}

// name은 CLI 플래그명(예: "from", "search-type"). opts 객체 키도 같은 이름.
export interface Source {
  name: string;
  label: string;
  description: string;
  options: Option[];
  fetch(opts: Record<string, unknown>): Promise<Row[]>;
}
