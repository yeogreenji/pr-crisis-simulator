import { useState } from "react";
import type { MediaDesk } from "../lib/mediaDesks";
import { readOutlets } from "../lib/readOutlets";

const key = "prism.media-outlets.v1";
type Outlets = Partial<Record<MediaDesk, string[]>>;

export function MediaList({ desk, outlet, onOutlet }: {
  desk: MediaDesk | "";
  outlet: string;
  onOutlet: (value: string) => void;
}) {
  const [outlets, setOutlets] = useState<Outlets>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "{}") ?? {}; }
    catch { return {}; }
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const list = desk ? outlets[desk] ?? [] : [];

  async function importList(files: File[]) {
    if (!desk || !files.length) return;
    setBusy(true);
    setStatus("");
    try {
      const incoming = (await Promise.all(files.map(readOutlets))).flat();
      if (!incoming.length) throw new Error("‘매체’ 또는 ‘매체명’ 열에서 가져올 항목을 찾지 못했습니다.");
      const combined = [...new Set([...list, ...incoming])].sort((a, b) => a.localeCompare(b, "ko"));
      const next = { ...outlets, [desk]: combined };
      localStorage.setItem(key, JSON.stringify(next));
      setOutlets(next);
      setStatus(`${desk} 매체 ${combined.length}개 저장 · 새로 추가 ${combined.length - list.length}개`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="rounded-lg border border-line p-2">
    <summary className="cursor-pointer text-xs font-semibold">미디어리스트에서 매체 선택</summary>
    <div className="mt-2 space-y-2 text-xs">
      <p className="text-muted">데스크를 고른 뒤 엑셀을 선택하면 매체명만 이 브라우저에 저장합니다.</p>
      <input aria-label="미디어리스트 엑셀 가져오기" className="w-full" type="file" accept=".xlsx" multiple disabled={!desk || busy}
        onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void importList(files); }} />
      {list.length > 0 && <select aria-label="대상 매체" className="field p-2" value={outlet} onChange={(event) => onOutlet(event.target.value)}>
        <option value="">매체 선택 안 함</option>
        {list.map((name) => <option key={name}>{name}</option>)}
      </select>}
      {list.length > 0 && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => {
        if (!desk) return;
        try {
          const next = { ...outlets, [desk]: [] };
          localStorage.setItem(key, JSON.stringify(next));
          setOutlets(next);
          onOutlet("");
          setStatus("이 데스크의 저장 목록을 비웠습니다.");
        } catch { setStatus("브라우저에 변경사항을 저장하지 못했습니다."); }
      }}>이 데스크 목록 비우기</button>}
      <p role="status">{busy ? "엑셀 읽는 중…" : status}</p>
    </div>
  </details>;
}
