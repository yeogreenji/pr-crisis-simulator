import { useEffect, useState } from "react";
import { CRISIS_CASES } from "../lib/cases";

const sections = ["내부 확인 요청", "기자 회신", "이용자 공지", "파트너 안내"] as const;
const field = "w-full rounded-lg border border-line bg-surface p-2 text-sm";
type Rule = { owner: string; channel: string; instruction: string };
type Client = { id: string; name: string; rules: Rule[] };
type Fact = { text: string; source: string; status: string; external: boolean };
type Snapshot = { section: string; text: string; at: string; state: string; context: string };
type Incident = { id: string; title: string; memo: string; client: string; deadline: string; facts: Fact[]; log: Snapshot[] };
const id = () => crypto.randomUUID();
const emptyIncident = (): Incident => ({ id: id(), title: "", memo: "", client: "", deadline: "", facts: [], log: [] });
const storageKey = "prism.incident-desk.v1";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved && Array.isArray(saved.incidents) && saved.incidents.length && Array.isArray(saved.clients)) {
      return saved as { incidents: Incident[]; clients: Client[]; active: string };
    }
  } catch {
    // A fresh workspace is available when browser data cannot be read.
  }
  const incident = emptyIncident();
  return { incidents: [incident], clients: [] as Client[], active: incident.id };
}

export function IncidentDesk() {
  const [desk, setDesk] = useState(load);
  const [clientName, setClientName] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const incident = desk.incidents.find((item) => item.id === desk.active) ?? desk.incidents[0];
  const client = desk.clients.find((item) => item.id === incident.client);
  const update = (changes: Partial<Incident>) => setDesk((value) => ({
    ...value,
    incidents: value.incidents.map((item) => item.id === incident.id ? { ...item, ...changes } : item),
  }));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(desk));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [desk]);

  const publicFacts = incident.facts.filter((fact) => fact.status === "확인됨" && fact.external && fact.text.trim() && fact.source.trim());
  const confirmed = publicFacts.map((fact) => fact.text.trim()).join("\n");
  const pending = incident.facts.filter((fact) => fact.text.trim() && (fact.status !== "확인됨" || !fact.source.trim()));
  const internalFacts = incident.facts.filter((fact) => fact.text.trim()).map((fact) =>
    `- [${fact.status === "확인됨" && !fact.source.trim() ? "출처 확인 필요" : fact.status}] ${fact.text}${fact.source ? ` (${fact.source})` : ""}`).join("\n");
  const drafts = [
    [
      incident.title.trim() && `건명 ${incident.title.trim()}`,
      incident.memo.trim(),
      internalFacts,
      "발생·접수 시각, 영향 범위, 현재 조치, 다음 안내 가능 시점을 확인해 주세요.",
      ...pending.map((fact) => `확인 요청 — ${fact.text}`),
      incident.deadline && `회신 마감 ${incident.deadline.replace("T", " ")}`,
    ].filter(Boolean).join("\n\n"),
    ["문의 주신 내용에 대해 답변드립니다.", confirmed || "문의 내용을 접수했습니다. 회신 가능한 내용을 확인한 뒤 안내드리겠습니다."].join("\n\n"),
    confirmed ? ["이용자 여러분께 안내드립니다.", confirmed].join("\n\n") : "",
    confirmed ? ["관련 상황을 공유드립니다.", confirmed].join("\n\n") : "",
  ];
  const hasInput = Boolean(incident.memo.trim() || incident.title.trim() || internalFacts);
  const terms = caseQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const cases = terms.length ? CRISIS_CASES.filter((item) => {
    const text = [item.title, item.company, item.trigger, ...item.response, item.lesson].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  }) : [];

  function addClient() {
    const name = clientName.trim();
    if (!name || desk.clients.some((item) => item.name === name)) return;
    const newClient = { id: id(), name, rules: sections.map(() => ({ owner: "", channel: "", instruction: "" })) };
    setDesk((value) => ({
      ...value, clients: [...value.clients, newClient],
      incidents: value.incidents.map((item) => item.id === incident.id ? { ...item, client: newClient.id } : item),
    }));
    setClientName("");
  }

  function setRule(index: number, fieldName: keyof Rule, value: string) {
    setDesk((previous) => ({ ...previous, clients: previous.clients.map((item) =>
      item.id === client?.id ? { ...item, rules: item.rules.map((rule, i) => i === index ? { ...rule, [fieldName]: value } : rule) } : item,
    ) }));
  }

  function setFact(index: number, change: Partial<Fact>) {
    update({ facts: incident.facts.map((fact, i) => i === index ? { ...fact, ...change } : fact) });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold">초동 대응</h1>
      <p className="text-sm text-muted">상황을 입력하면 공통 대응안이 나옵니다. 외부 문안에는 출처를 적고 공개 가능으로 표시한 사실만 들어갑니다.</p>
      {saveFailed && <p role="alert">브라우저에 저장할 수 없습니다. 페이지를 닫기 전에 필요한 기록을 복사하세요.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex gap-2">
            <select aria-label="저장된 사건" className={field} value={incident.id} onChange={(event) => { setDesk({ ...desk, active: event.target.value }); setMessage(""); }}>
              {desk.incidents.map((item) => <option key={item.id} value={item.id}>{item.title || item.memo.trim().slice(0, 35) || "제목 없는 사건"}</option>)}
            </select>
            <button className="btn btn-outline shrink-0" onClick={() => {
              const next = emptyIncident();
              setDesk({ ...desk, incidents: [...desk.incidents, next], active: next.id });
              setMessage("");
            }}>새 사건</button>
          </div>
          <label className="block text-sm font-semibold">지금 어떤 일이 있었나요?<textarea className={field} rows={5} value={incident.memo} onChange={(event) => update({ memo: event.target.value })} placeholder="예: 일부 이용자가 로그인 오류를 신고했고 기자가 복구 시점을 물었습니다." /></label>
          <p className="text-sm text-muted">이 한 칸만 작성해도 내부 확인 요청과 기자 1차 회신을 바로 복사할 수 있습니다.</p>
          <button type="button" onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen} className="btn btn-outline">{detailsOpen ? "추가 설정 닫기" : "고객사·공개 사실 추가"}</button>
          {detailsOpen && <div className="space-y-3">
          <label className="block text-sm">사건명<input className={field} value={incident.title} onChange={(event) => update({ title: event.target.value })} /></label>
          <label className="block text-sm">기자 회신 마감<input type="datetime-local" className={field} value={incident.deadline} onChange={(event) => update({ deadline: event.target.value })} /></label>
          <label className="block text-sm">고객사<select className={field} value={incident.client} onChange={(event) => update({ client: event.target.value })}>
            <option value="">공통 대응</option>
            {desk.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <div className="flex gap-2">
            <input aria-label="새 고객사 이름" className={field} placeholder="새 고객사 이름" value={clientName} onChange={(event) => setClientName(event.target.value)} />
            <button className="btn btn-outline shrink-0" disabled={!clientName.trim() || desk.clients.some((item) => item.name === clientName.trim())} onClick={addClient}>고객사 추가</button>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">사실과 출처</h2>
            <button className="btn btn-outline" onClick={() => update({ facts: [...incident.facts, { text: "", source: "", status: "확인 중", external: false }] })}>사실 추가</button>
          </div>
          {incident.facts.map((fact, index) => (
            <fieldset key={index} className="space-y-2 rounded-lg border border-line p-2">
              <legend className="text-sm">사실 {index + 1}</legend>
              <textarea aria-label="사실 내용" className={field} value={fact.text} onChange={(event) => setFact(index, { text: event.target.value })} />
              <input aria-label="출처" placeholder="확인 담당자·시각 또는 원문 링크" className={field} value={fact.source} onChange={(event) => setFact(index, { source: event.target.value })} />
              <select aria-label="확인 상태" className={field} value={fact.status} onChange={(event) => setFact(index, { status: event.target.value })}>
                {["확인 중", "외부 주장", "확인됨"].map((status) => <option key={status}>{status}</option>)}
              </select>
              <div className="flex justify-between gap-2 text-sm">
                <label><input type="checkbox" checked={fact.external} onChange={(event) => setFact(index, { external: event.target.checked })} /> 외부 공개 가능</label>
                <button className="underline" onClick={() => update({ facts: incident.facts.filter((_, i) => i !== index) })}>삭제</button>
              </div>
            </fieldset>
          ))}
          </div>}
        </section>
        <section className="space-y-3">
          {sections.map((section, index) => {
            const draft = drafts[index];
            const latest = incident.log.find((entry) => entry.section === section);
            const rule = client?.rules[index];
            const context = JSON.stringify([client?.id, rule]);
            return <article key={section} className="space-y-2 rounded-xl border border-line bg-surface p-4">
              <h2 className="font-semibold">{section}</h2>
              {client && detailsOpen && <div className="grid gap-2 sm:grid-cols-2">
                <input aria-label={section + " 담당·승인"} className={field} placeholder="담당·승인 순서" value={rule?.owner ?? ""} onChange={(event) => setRule(index, "owner", event.target.value)} />
                <input aria-label={section + " 채널"} className={field} placeholder="사용 채널" value={rule?.channel ?? ""} onChange={(event) => setRule(index, "channel", event.target.value)} />
                <textarea aria-label={section + " 대응 지침"} className={field + " sm:col-span-2"} placeholder="고객사별 선행 조치·공유 범위" value={rule?.instruction ?? ""} onChange={(event) => setRule(index, "instruction", event.target.value)} />
              </div>}
              {client && <p className="text-sm text-muted">{[rule?.owner, rule?.channel, rule?.instruction].filter(Boolean).join(" · ")}</p>}
              {hasInput && draft ? <>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-paper p-3 font-sans text-sm">{draft}</pre>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-outline" onClick={async () => {
                    try { await navigator.clipboard.writeText(draft); setMessage(section + " 복사 완료"); }
                    catch { setMessage("복사할 수 없습니다. 문안을 선택해 복사하세요."); }
                  }}>복사</button>
                  {detailsOpen && ["승인 기록", "발신 기록"].map((state) => <button key={state} className="btn btn-outline" onClick={() =>
                    update({ log: [{ section, text: draft, state, context, at: new Date().toISOString() }, ...incident.log] })
                  }>{state}</button>)}
                  {latest && <span className="text-sm">{(latest.text !== draft || latest.context !== context) ? "이전 기록 이후 문안 변경 · 재검토 필요" : latest.state}</span>}
                </div>
              </> : <p className="text-sm text-muted">{hasInput ? "필요한 경우 ‘고객사·공개 사실 추가’에서 공개할 내용을 등록하세요." : "사건 정보를 입력하세요."}</p>}
            </article>;
          })}
          <p role="status" className="text-sm">{message}</p>
        </section>
      </div>
      <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold">참고 사례 검색</h2>
        <input aria-label="참고 사례 검색" className={field} placeholder="회사명, 쟁점 또는 대응 키워드" value={caseQuery} onChange={(event) => setCaseQuery(event.target.value)} />
        {terms.length > 0 && !cases.length && <p className="text-sm">일치하는 사례가 없습니다.</p>}
        {cases.map((item) => <details key={item.id} className="rounded-lg border border-line p-2 text-sm">
          <summary>{item.title} · {item.date}</summary>
          <p>{item.trigger}</p>
          <ul className="list-disc pl-5">{item.response.map((line) => <li key={line}>{line}</li>)}</ul>
          {item.sources.map((source) => <a key={source.url} href={source.url} rel="noreferrer" target="_blank" className="block underline">{source.label}</a>)}
        </details>)}
      </section>
      {incident.log.length > 0 && <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold">승인·발신 이력</h2>
        {incident.log.map((entry, index) => <details key={index} className="text-sm">
          <summary>{entry.section} · {entry.state} · {new Date(entry.at).toLocaleString("ko-KR")}</summary>
          <p className="whitespace-pre-wrap">{entry.text}</p>
        </details>)}
      </section>}
    </div>
  );
}
