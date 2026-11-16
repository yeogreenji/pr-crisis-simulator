import { BookOpen, History, LifeBuoy, Radar, Settings2, ShieldCheck } from "lucide-react";
import { cx } from "./ui";

export type AppView = "incident" | "simulator" | "history" | "library";

function NavButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group relative grid h-10 w-10 place-items-center rounded-xl transition-colors",
        active ? "bg-white/12 text-white" : "text-white/45 hover:bg-white/8 hover:text-white/80",
      )}
    >
      {active && <span className="absolute -left-[14px] h-4 w-[2px] rounded-full bg-white/80" />}
      {children}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-[#1b1f28] px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block">
        {label}
      </span>
    </button>
  );
}

export function Sidebar({
  view,
  onChangeView,
  onOpenApi,
  onOpenHelp,
}: {
  view: AppView;
  onChangeView: (v: AppView) => void;
  onOpenApi: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col items-center bg-[#101319] py-4 lg:flex">
      <div className="mb-7 flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/12 bg-white/6">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3.2 21 19.4H3L12 3.2Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M12 3.2V19.4" stroke="#7C8CFF" strokeWidth="1.4" />
          <path d="M8.2 11.4h13.3" stroke="#7C8CFF" strokeWidth="1.2" opacity=".55" />
        </svg>
      </div>

      <nav className="flex flex-col items-center gap-1.5">
        <NavButton active={view === "simulator"} label="시뮬레이터" onClick={() => onChangeView("simulator")}>
          <Radar size={18} strokeWidth={1.9} />
        </NavButton>
        <NavButton active={view === "library"} label="위기 사례·업종 매뉴얼" onClick={() => onChangeView("library")}>
          <BookOpen size={18} strokeWidth={1.9} />
        </NavButton>
        <NavButton active={view === "history"} label="시뮬레이션 히스토리" onClick={() => onChangeView("history")}>
          <History size={18} strokeWidth={1.9} />
        </NavButton>
        <div className="my-2 h-px w-6 bg-white/10" />
        <NavButton label="엔진·API 설정" onClick={onOpenApi}>
          <Settings2 size={18} strokeWidth={1.9} />
        </NavButton>
        <NavButton label="도움말" onClick={onOpenHelp}>
          <LifeBuoy size={18} strokeWidth={1.9} />
        </NavButton>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70" title="보안 연결">
          <ShieldCheck size={15} strokeWidth={2} />
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-[10px] font-bold tracking-tight text-ink">
          PR
        </div>
      </div>
    </aside>
  );
}
