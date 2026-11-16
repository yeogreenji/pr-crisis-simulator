import { ChevronDown, Command, Sparkles } from "lucide-react";
import type { AppView } from "./Sidebar";
import { cx } from "./ui";

const VIEWS: { id: AppView; label: string }[] = [
  { id: "simulator", label: "시뮬레이터" },
  { id: "library", label: "사례·매뉴얼" },
  { id: "history", label: "히스토리" },
];

export function TopBar({
  view,
  apiEnabled,
  onOpenApi,
  onChangeView,
}: {
  view: AppView;
  apiEnabled: boolean;
  onOpenApi: () => void;
  onChangeView: (v: AppView) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md lg:pl-[68px]">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] font-semibold tracking-tight text-ink hover:bg-paper-deep"
            title="데모 워크스페이스"
          >
            <span className="grid h-5 w-5 place-items-center rounded-[5px] bg-ink text-[9px] font-bold text-white lg:hidden">
              P
            </span>
            <span className="hidden sm:inline">데모 워크스페이스</span>
            <span className="sm:hidden">PRISM</span>
            <ChevronDown size={13} className="text-faint" />
          </button>
          <button type="button" className={cx("btn btn-outline shrink-0 text-xs", view === "incident" && "font-bold")} aria-current={view === "incident" ? "page" : undefined} onClick={() => onChangeView("incident")}>초동 대응</button>
          <span className="hidden h-4 w-px bg-line-strong sm:block" />
          <div className="hidden items-center gap-0.5 sm:flex">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onChangeView(v.id)}
                className={cx(
                  "rounded-md px-2 py-1 text-[12px] transition-colors",
                  view === v.id ? "bg-paper-deep font-semibold text-ink" : "text-muted hover:text-ink",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
            </span>
            <span className="text-[11px] font-medium text-ink-2">내장 엔진 v2.5 · 6개 업종</span>
          </span>

          <button
            type="button"
            onClick={onOpenApi}
            className={cx(
              "btn h-[30px] gap-1.5 px-2.5 text-[11.5px]",
              apiEnabled ? "border border-accent/25 bg-accent-soft text-accent-deep" : "btn-outline",
            )}
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">{apiEnabled ? "LLM 정밀 분석" : "LLM 연동"}</span>
            {apiEnabled && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>

          <span className="hidden items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] text-muted lg:inline-flex">
            <Command size={11} /> Enter
          </span>
        </div>
      </div>
    </header>
  );
}
