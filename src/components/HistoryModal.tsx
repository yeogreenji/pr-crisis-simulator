import { useEffect, useState } from "react";
import { ArrowRight, Check, GitCompare, History, Trash2, X } from "lucide-react";
import { cx } from "./ui";
import type { SimSnapshot } from "../lib/history";

const bandColor = (value: number) => (value >= 70 ? "#dc2626" : value >= 50 ? "#d97706" : value >= 35 ? "#2563eb" : "#059669");

export function HistoryModal({
  open,
  items,
  onClose,
  onCompare,
  onRemove,
  onClear,
  onOpenItem,
}: {
  open: boolean;
  items: SimSnapshot[];
  onClose: () => void;
  onCompare: (a: SimSnapshot, b: SimSnapshot) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenItem?: (item: SimSnapshot) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) setPicked([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)));

  const compare = () => {
    const [a, b] = picked.map((id) => items.find((i) => i.id === id)).filter((v): v is SimSnapshot => Boolean(v));
    if (a && b) onCompare(a, b);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-ink/40 px-3 py-6 backdrop-blur-sm" role="dialog" aria-label="시뮬레이션 기록">
      <div className="w-full max-w-[760px] border border-line-strong bg-surface shadow-float">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <History size={14} className="text-accent-deep" />
          <span className="text-[14px] font-semibold text-ink">시뮬레이션 기록</span>
          <span className="chip border border-line bg-white px-1.5 py-0 text-[12px] text-muted">{items.length}건</span>
          <span className="hidden text-[12px] text-faint sm:inline">이 브라우저에만 저장됩니다</span>
          <button type="button" onClick={onClose} className="btn btn-ghost ml-auto h-7 px-2 text-[12.5px] text-muted hover:text-ink" aria-label="닫기">
            <X size={13} /> 닫기
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-tint px-4 py-2">
          <span className="text-[12.5px] text-muted">두 건을 선택하면 입장·위험지수를 나란히 비교합니다.</span>
          <button
            type="button"
            onClick={compare}
            disabled={picked.length !== 2}
            data-testid="history-compare"
            className={cx("btn ml-auto h-7 px-2.5 text-[12.5px]", picked.length === 2 ? "btn-accent" : "btn-outline opacity-50")}
          >
            <GitCompare size={12} /> 선택한 2건 비교
          </button>
          {items.length > 0 && (
            <button type="button" onClick={onClear} className="btn btn-ghost h-7 px-2 text-[12.5px] text-muted hover:text-risk">
              전체 삭제
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-muted">아직 저장된 기록이 없습니다.</p>
            <p className="mt-1 text-[12.5px] text-faint">패키지를 만들면 자동으로 이 브라우저에 기록됩니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const on = picked.includes(item.id);
              return (
                <li key={item.id} className={cx("flex items-start gap-2 px-4 py-2.5", on && "bg-accent-soft/40")}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${item.brand} ${item.stanceShort} 선택`}
                    onClick={() => toggle(item.id)}
                    data-testid="history-item"
                    className={cx(
                      "mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold",
                      on ? "border-accent bg-accent text-white" : "border-line-strong bg-white text-transparent",
                    )}
                  >
                    <Check size={9} strokeWidth={3.5} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-ink">{item.brand}</span>
                      <span className="chip border border-line bg-white px-1.5 py-0 text-[12px] text-ink-2">{item.stanceShort}</span>
                      <span className="num chip px-1.5 py-0 text-[12px] font-semibold" style={{ color: bandColor(item.overall), background: `${bandColor(item.overall)}12` }}>
                        {item.overall}
                      </span>
                      <span className="text-[12px] text-faint">
                        {new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted">
                      {item.eventLabel} · {item.industryLabel}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-faint">{item.situation}</p>
                  </div>
                  {onOpenItem && (
                    <button
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="btn btn-ghost mt-0.5 h-6 shrink-0 px-1.5 text-[12px] text-muted hover:text-ink"
                    >
                      열기 <ArrowRight size={11} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={`${item.brand} 기록 삭제`}
                    className="btn btn-ghost mt-0.5 h-6 shrink-0 px-1.5 text-[12px] text-faint hover:text-risk"
                  >
                    <Trash2 size={11} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-line px-4 py-2.5 text-[12px] leading-relaxed text-faint">
          기록은 입장·종합지수·7축·문안 규모만 남깁니다. 입력 원문은 요약해 저장하며, 서버로 전송하지 않습니다.
        </div>
      </div>
    </div>
  );
}
