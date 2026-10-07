// 써볼 도구 메모 (Claude 플러그인·MCP·스킬 등). 아이디어 탭 안에 있음

export const TOOL_STATUSES = ["want", "using", "dropped"] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  want: "써볼 것",
  using: "쓰는 중",
  dropped: "안 씀",
};

/** 처음 쓸 때 고르기 쉽게 보여주는 분류. 직접 적은 분류도 같이 뜸 */
export const DEFAULT_TOOL_KINDS = ["플러그인", "MCP", "스킬", "에이전트"];

export type Tool = {
  id: string;
  name: string;
  url: string;
  kind: string;
  note: string;
  status: ToolStatus;
  created_at: string;
};

export const TOOL_COLUMNS = "id, name, url, kind, note, status, created_at";

export function isToolStatus(value: unknown): value is ToolStatus {
  return typeof value === "string" && (TOOL_STATUSES as readonly string[]).includes(value);
}
