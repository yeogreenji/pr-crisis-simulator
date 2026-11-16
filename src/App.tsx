import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Download,
  FilePenLine,
  Gauge as GaugeIcon,
  History,
  Newspaper,
  MessagesSquare,
  Printer,
  ScanText,
  Sparkles,
  X,
} from "lucide-react";
import type { Analysis, ChannelId, IndustryId, IssueCategoryId, LlmConfig, Preset, RiskSpan, RunRecord } from "./types";
import { PRESETS } from "./lib/presets";
import { getIndustry } from "./lib/industries";
import { analyze } from "./lib/engine";
import { buildMarkdown, downloadText, slugForFile } from "./lib/report";
import { addRun, clearRuns, loadApiConfig, loadRuns, persistApiConfig, removeRun } from "./lib/storage";
import { checkAiServer, describeAiError, requestAiAnalysis } from "./lib/ai";
import { InputPanel } from "./components/InputPanel";
import { RiskRail } from "./components/RiskRail";
import { PressTab } from "./components/tabs/PressTab";
import { SentimentTab } from "./components/tabs/SentimentTab";
import { XrayTab } from "./components/tabs/XrayTab";
import { ResponseTab } from "./components/tabs/ResponseTab";
import { HistoryView } from "./components/HistoryView";
import { ApiModal } from "./components/ApiModal";
import { PrintReport } from "./components/PrintReport";
import { EmptyState } from "./components/EmptyState";
import { ModeBanner } from "./components/ModeBanner";
import { Sidebar, type AppView } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LibraryView } from "./components/LibraryView";
import { Card, ScoreBadge, cx } from "./components/ui";

type TabId = "press" | "sentiment" | "xray" | "response";
type MobilePanel = "input" | "analysis" | "risk";
type ToastTone = "ok" | "warn" | "err";

const MAX_AI_CHARS = 8_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [view, setView] = useState<AppView>("simulator");
  const [draft, setDraft] = useState("");
  const [brand, setBrand] = useState("");
  const [issue, setIssue] = useState<IssueCategoryId>(PRESETS[0].issue);
  const [industry, setIndustry] = useState<IndustryId>(PRESETS[0].industry);
  const [channels, setChannels] = useState<ChannelId[]>(PRESETS[0].channels);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [baseline, setBaseline] = useState<RunRecord | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [aiPending, setAiPending] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [tab, setTab] = useState<TabId>("press");
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunRecord[]>(() => loadRuns());
  const [picked, setPicked] = useState<string[]>([]);
  const [apiConfig, setApiConfig] = useState<LlmConfig>(() => loadApiConfig());
  const [apiOpen, setApiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("input");
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);

  const runSeq = useRef(0);
  const aiCache = useRef(new Map<string, Analysis>());

  const notify = useCallback((message: string, tone: ToastTone = "ok") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const refreshAiStatus = useCallback(async () => {
    const status = await checkAiServer();
    setAiReady(status.ok);
    return status;
  }, []);

  useEffect(() => {
    void refreshAiStatus();
  }, [refreshAiStatus]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mobilePanel, view]);

  const stale =
    analysis !== null &&
    (draft.replace(/\r\n/g, "\n") !== analysis.text ||
      analysis.industry !== industry ||
      analysis.issue !== issue);

  /** 로컬 결과를 화면에 올린 뒤 실시간 AI로 다시 씁니다. 실패하면 로컬 결과를 그대로 둡니다. */
  const runAiPass = useCallback(
    async (base: Analysis, seq: number) => {
      const cacheKey = [base.text, base.brand, base.issue, base.industry, base.channels.join(",")].join("|");

      if (base.text.length > MAX_AI_CHARS) {
        setAnalysis({ ...base, modeNote: "초안이 8,000자를 넘어 실시간 AI는 건너뛰었습니다." });
        return;
      }

      setAiPending(true);
      try {
        const cached = aiCache.current.get(cacheKey);
        let merged: Analysis;
        if (cached) {
          merged = { ...cached, id: base.id, createdAt: base.createdAt };
        } else {
          const result = await requestAiAnalysis(base, { apiKey: apiConfig.apiKey });
          merged = { ...result.analysis, id: base.id, createdAt: base.createdAt };
          aiCache.current.set(cacheKey, merged);
        }
        if (runSeq.current !== seq) return;
        setAnalysis(merged);
        setRuns((prev) => addRun(prev, merged));
        setAiReady(true);
        const took = merged.ai?.latencyMs
          ? merged.ai.latencyMs >= 1000
            ? `${(merged.ai.latencyMs / 1000).toFixed(1)}초`
            : `${merged.ai.latencyMs}ms`
          : "완료";
        notify(`실시간 AI 분석 반영 · ${took}`);
      } catch (error) {
        if (runSeq.current !== seq) return;
        const note = describeAiError(error);
        setAnalysis((prev) => (prev ? { ...prev, modeNote: note } : prev));
        setRuns((prev) => addRun(prev, { ...base, mode: "local", modeNote: note }));
        if (error instanceof Error && error.message.includes("연결하지 못했습니다")) setAiReady(false);
        notify(note, "warn");
      } finally {
        if (runSeq.current === seq) setAiPending(false);
      }
    },
    [apiConfig.apiKey, notify],
  );

  const runAnalysis = useCallback(
    async (override?: {
      text?: string;
      brand?: string;
      issue?: IssueCategoryId;
      industry?: IndustryId;
      channels?: ChannelId[];
      tab?: TabId;
    }) => {
      const text = (override?.text ?? draft).replace(/\r\n/g, "\n");
      if (text.trim().length < 20) {
        notify("초안이 너무 짧습니다. 최소 20자 이상 입력하세요.", "warn");
        return;
      }
      const cfgBrand = (override?.brand ?? brand).trim() || "당사";
      const cfgIssue = override?.issue ?? issue;
      const cfgIndustry = override?.industry ?? industry;
      const cfgChannels = override?.channels ?? channels;

      const seq = runSeq.current + 1;
      runSeq.current = seq;
      setAiPending(false);
      setRunning(true);
      setStep(0);
      setMobilePanel("analysis");
      for (let i = 0; i < 4; i += 1) {
        setStep(i);
        await sleep(i === 0 ? 180 : 200);
      }

      const result = analyze({
        text,
        brand: cfgBrand,
        issue: cfgIssue,
        industry: cfgIndustry,
        channels: cfgChannels,
      });

      const previous = runs.find((r) => r.brand === result.brand) ?? null;
      setBaseline(previous);
      setAnalysis(result);
      setRuns((prev) => addRun(prev, result));
      setSelectedSpanId(null);
      setTab(override?.tab ?? "press");
      setActivePreset(null);
      setRunning(false);

      if (!apiConfig.enabled) {
        const note = "설정에서 실시간 AI 분석을 꺼 두었습니다. 내장 규칙으로 분석했습니다.";
        setAnalysis((prev) => (prev ? { ...prev, modeNote: note } : prev));
        setRuns((prev) => addRun(prev, { ...result, modeNote: note }));
        return;
      }

      await runAiPass(result, seq);
    },
    [apiConfig.enabled, brand, channels, draft, industry, issue, notify, runAiPass, runs],
  );

  const retryAi = useCallback(() => {
    if (!analysis) return;
    if (!apiConfig.enabled) {
      setApiOpen(true);
      return;
    }
    const seq = runSeq.current + 1;
    runSeq.current = seq;
    void runAiPass(analysis, seq);
  }, [analysis, apiConfig.enabled, runAiPass]);

  const handlePreset = (preset: Preset) => {
    setBrand(preset.brand);
    setIssue(preset.issue);
    setIndustry(preset.industry);
    setChannels(preset.channels);
    setDraft(preset.draft);
    setActivePreset(preset.id);
    void runAnalysis({
      text: preset.draft,
      brand: preset.brand,
      issue: preset.issue,
      industry: preset.industry,
      channels: preset.channels,
    });
  };

  const simulateIndustry = (id: IndustryId) => {
    const preset = PRESETS.find((p) => p.industry === id) ?? PRESETS[0];
    setView("simulator");
    setMobilePanel("analysis");
    handlePreset(preset);
  };

  const toggleChannel = (id: ChannelId) => {
    setChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const resetDraft = () => {
    runSeq.current += 1;
    setDraft("");
    setBrand("");
    setActivePreset(null);
    setAnalysis(null);
    setBaseline(null);
    setSelectedSpanId(null);
    setAiPending(false);
    setMobilePanel("input");
    notify("새 글을 시작합니다. 초안을 붙여넣거나 파일을 불러오세요.");
  };

  const applySpan = (span: RiskSpan) => {
    if (!analysis) return;
    if (stale) {
      notify("초안이 수정되었습니다. 먼저 다시 분석하세요.", "warn");
      return;
    }
    const next = analysis.text.slice(0, span.start) + span.replacement + analysis.text.slice(span.end);
    setDraft(next);
    setMobilePanel("analysis");
    notify(`교체 적용 · 예상 -${span.delta}점`, "ok");
    void runAnalysis({ text: next, tab: "xray" });
  };

  const applyAll = () => {
    if (!analysis) return;
    setDraft(analysis.revisedDraft);
    notify(`전체 교체안 적용 · 예상 ${analysis.stats.projectedScore}점`);
    void runAnalysis({ text: analysis.revisedDraft, tab: "xray" });
  };

  const loadTextToEditor = (text: string) => {
    setDraft(text);
    setActivePreset(null);
    setMobilePanel("input");
    notify("수정안을 에디터에 넣었습니다. [확인 필요] 값을 채운 뒤 다시 분석하세요.", "ok");
  };

  const exportMarkdown = () => {
    if (!analysis) return;
    const md = buildMarkdown(analysis, baseline ? { score: baseline.score, createdAt: baseline.createdAt } : null);
    downloadText(slugForFile(analysis.brand, analysis.createdAt), md);
    notify("Markdown 리포트를 내려받았습니다.");
  };

  const handleSelectRun = (run: RunRecord) => {
    setView("simulator");
    setBrand(run.brand);
    setIssue(run.issue);
    const runIndustry = run.industry ?? "tech";
    setIndustry(runIndustry);
    setChannels(run.channels);
    setDraft(run.text);
    setActivePreset(null);
    void runAnalysis({
      text: run.text,
      brand: run.brand,
      issue: run.issue,
      industry: runIndustry,
      channels: run.channels,
    });
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleDelete = (id: string) => {
    setRuns((prev) => removeRun(prev, id));
    setPicked((prev) => prev.filter((p) => p !== id));
    notify("기록을 삭제했습니다.", "warn");
  };

  const handleClear = () => {
    setRuns(clearRuns());
    setPicked([]);
    notify("히스토리를 모두 비웠습니다.", "warn");
  };

  const saveApi = (config: LlmConfig) => {
    setApiConfig(config);
    persistApiConfig(config);
    void refreshAiStatus();
    notify(config.enabled ? "실시간 AI 설정을 저장했습니다." : "실시간 AI를 꺼 두었습니다. 로컬 규칙으로 분석합니다.", "ok");
  };

  const tabs = useMemoTabs(analysis);

  const panelVisible = (panel: MobilePanel) => (mobilePanel === panel ? "block" : "hidden");

  const railNode = (
    <RiskRail
      analysis={analysis}
      baseline={baseline}
      runs={runs}
      onOpenHistory={() => setView("history")}
      onSelectRun={handleSelectRun}
    />
  );

  return (
    <>
      <div className="min-h-screen bg-paper print:hidden">
        <Sidebar
          view={view}
          onChangeView={(v) => {
            setView(v);
            setMobilePanel(v === "history" ? "analysis" : "input");
          }}
          onOpenApi={() => setApiOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <TopBar
          view={view}
          apiEnabled={apiConfig.enabled}
          aiReady={aiReady}
          aiPending={aiPending}
          mode={analysis?.mode ?? null}
          aiModel={analysis?.ai?.model}
          onOpenApi={() => setApiOpen(true)}
          onChangeView={(v) => {
            setView(v);
            if (v !== "simulator") setMobilePanel("analysis");
          }}
        />

        <main className="lg:pl-[68px]">
          <div className="mx-auto w-full max-w-[1600px] px-3 pb-24 pt-3 sm:px-5 sm:pt-4 xl:pb-6">
            {view === "library" ? (
              <LibraryView industry={industry} onIndustry={setIndustry} onSimulate={simulateIndustry} />
            ) : view === "history" ? (
              <HistoryView
                runs={runs}
                picked={picked}
                onPick={togglePick}
                onSelectRun={handleSelectRun}
                onDelete={handleDelete}
                onClear={handleClear}
                onBack={() => setView("simulator")}
              />
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[352px_minmax(0,1fr)_304px]">
                  <div className={cx(panelVisible("input"), "lg:block")}>
                    <div className="xl:sticky xl:top-[70px] xl:h-[calc(100vh-84px)]">
                      <div className="h-full">
                        <InputPanel
                          draft={draft}
                          onDraft={(v) => {
                            setDraft(v);
                            setActivePreset(null);
                          }}
                          brand={brand}
                          onBrand={setBrand}
                          issue={issue}
                          onIssue={setIssue}
                          industry={industry}
                          onIndustry={setIndustry}
                          channels={channels}
                          onToggleChannel={toggleChannel}
                          onPreset={handlePreset}
                          running={running}
                          aiPending={aiPending}
                          step={step}
                          onRun={() => void runAnalysis()}
                          stale={stale}
                          apiEnabled={apiConfig.enabled}
                          onOpenApi={() => setApiOpen(true)}
                          activePresetId={activePreset}
                          onOpenPlaybook={(id) => {
                            setIndustry(id);
                            setView("library");
                          }}
                          onReset={resetDraft}
                          onNotice={(message, tone) => notify(message, tone ?? "ok")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={cx(panelVisible("analysis"), "min-w-0 lg:block")}>
                    {!analysis ? (
                      <EmptyState onPreset={handlePreset} />
                    ) : (
                      <div className="space-y-2.5">
                        <ModeBanner
                          analysis={analysis}
                          pending={aiPending}
                          aiEnabled={apiConfig.enabled}
                          onRetry={retryAi}
                          onOpenSettings={() => setApiOpen(true)}
                        />

                        <Card className="overflow-hidden">
                          <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h1 className="truncate text-[15px] font-semibold tracking-[-0.025em]">{analysis.brand}</h1>
                                <span
                                  className="chip"
                                  style={{
                                    background: `${getIndustry(analysis.industry).accent}12`,
                                    color: getIndustry(analysis.industry).accent,
                                    border: `1px solid ${getIndustry(analysis.industry).accent}26`,
                                  }}
                                >
                                  {analysis.industryLabel}
                                </span>
                                <span className="chip border border-line bg-surface text-ink-2">{analysis.issueLabel}</span>
                                <span
                                  className={cx(
                                    "chip",
                                    analysis.mode === "ai" ? "bg-ok-soft text-ok" : "bg-paper-deep text-muted",
                                  )}
                                >
                                  {analysis.mode === "ai" ? "실시간 AI 분석" : "로컬 규칙 모드"}
                                </span>
                                {baseline && <span className="chip bg-ok-soft text-ok">2차</span>}
                              </div>
                              <p className="mt-1 truncate text-[10.5px] text-muted">
                                {analysis.summaryLine} ·{" "}
                                {new Date(analysis.createdAt).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                생성
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={exportMarkdown} className="btn btn-outline h-8 px-2.5 text-[11px]">
                                <Download size={12} />
                                <span className="hidden sm:inline">리포트</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="btn btn-outline h-8 px-2.5 text-[11px]"
                                title="인쇄용 리포트"
                              >
                                <Printer size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 overflow-x-auto border-t border-line px-2 py-1.5">
                            {tabs.map((t) => {
                              const active = tab === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setTab(t.id)}
                                  className={cx(
                                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-2.5 sm:text-[11.5px]",
                                    active ? "bg-ink text-white" : "text-muted hover:bg-paper-deep hover:text-ink",
                                  )}
                                >
                                  <t.icon size={13} />
                                  {t.label}
                                  <span className={cx("num hidden text-[9.5px] sm:inline", active ? "text-white/60" : "text-faint")}>
                                    {t.count}
                                  </span>
                                </button>
                              );
                            })}
                            <div className="ml-auto hidden items-center gap-1.5 pr-1 sm:flex">
                              <ScoreBadge score={analysis.score} size="sm" />
                              <span className="text-[9.5px] text-faint">/100</span>
                            </div>
                          </div>
                        </Card>

                        {stale && (
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5">
                            <span className="text-[11px] font-medium text-warn">
                              초안·업종·이슈 유형이 변경되었습니다. 결과는 마지막 분석 기준입니다.
                            </span>
                            <button
                              type="button"
                              onClick={() => void runAnalysis()}
                              className="btn btn-outline ml-auto h-7 border-warn/30 bg-white/70 px-2.5 text-[10.5px] text-warn"
                            >
                              <Sparkles size={11} /> 다시 분석
                            </button>
                          </div>
                        )}

                        <div className="animate-rise">
                          {tab === "press" && <PressTab analysis={analysis} />}
                          {tab === "sentiment" && <SentimentTab analysis={analysis} />}
                          {tab === "xray" && (
                            <XrayTab
                              analysis={analysis}
                              selectedId={selectedSpanId}
                              onSelect={setSelectedSpanId}
                              onApply={applySpan}
                              onApplyAll={applyAll}
                              stale={stale}
                            />
                          )}
                          {tab === "response" && (
                            <ResponseTab
                              analysis={analysis}
                              onLoadToEditor={loadTextToEditor}
                              onLoadRevised={() => loadTextToEditor(analysis.revisedDraft)}
                              onExport={exportMarkdown}
                              onPrint={() => window.print()}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={cx(panelVisible("risk"), "min-w-0 xl:block")}>
                    <div className="xl:sticky xl:top-[70px]">{railNode}</div>
                  </div>
                </div>

                <div className={cx("mt-3 lg:hidden", mobilePanel === "risk" ? "block" : "hidden")}>
                  <div className="grid gap-3 sm:grid-cols-2">{railNode}</div>
                </div>

                <div className="mt-3 hidden lg:block xl:hidden">
                  <div className="grid gap-3 sm:grid-cols-2">{railNode}</div>
                </div>
              </>
            )}
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          <div className="grid grid-cols-4">
            {[
              { id: "input" as MobilePanel, label: "초안", icon: FilePenLine },
              { id: "analysis" as MobilePanel, label: "분석", icon: Newspaper },
              { id: "risk" as MobilePanel, label: "리스크", icon: GaugeIcon },
              { id: "library" as const, label: "사례", icon: BookOpen },
            ].map((item) => {
              const isLibrary = item.id === "library";
              const active = isLibrary ? view === "library" : mobilePanel === item.id && view === "simulator";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (isLibrary) {
                      setView("library");
                      return;
                    }
                    setView("simulator");
                    setMobilePanel(item.id as MobilePanel);
                  }}
                  className={cx("flex flex-col items-center gap-1 py-2.5", active ? "text-ink" : "text-faint")}
                >
                  <span className="relative">
                    <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                    {item.id === "risk" && analysis && (
                      <span className="num absolute -right-3.5 -top-1.5 rounded-full bg-ink px-1 py-[1px] text-[8px] leading-tight text-white">
                        {analysis.score}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <ApiModal open={apiOpen} config={apiConfig} onClose={() => setApiOpen(false)} onSave={saveApi} />

        {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={() => setHelpOpen(false)} aria-hidden />
            <div className="animate-rise relative z-10 w-full max-w-[460px] rounded-2xl border border-line bg-surface p-5 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="eyebrow">Guide</div>
                  <h2 className="mt-1 text-[15px] font-semibold">이렇게 사용합니다</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="rounded-md p-1 text-muted hover:bg-paper-deep"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5">
                {[
                  "‘새 글 작성’으로 에디터를 비우고, 내 보도자료·입장문을 붙여넣거나 .txt/.md 파일로 불러옵니다.",
                  "업종과 이슈 유형, 타깃 채널을 고르고 ‘내 초안 분석하기’를 누릅니다. 예시는 ‘예시로 테스트하기’에 있습니다.",
                  "상단 배지로 실시간 AI 분석인지 로컬 규칙 모드인지 확인합니다. AI가 연결되지 않아도 모든 탭이 채워집니다.",
                  "응답 팩에서 수정 초안 2버전(공감형·팩트형)을 복사해 쓰고, 기자 질문·금기 표현·골든타임 체크리스트로 대응합니다.",
                  "문장 X-ray에서 위험 구절을 교체하고, 사례·매뉴얼에서 실제 위기 사례와 업종 타임라인을 확인합니다.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="num mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-md bg-paper-deep text-[9.5px] font-semibold text-muted">
                      {i + 1}
                    </span>
                    <span className="text-[11.5px] leading-relaxed text-ink-2">{t}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg border border-line bg-[#fcfcfa] p-3 text-[10.5px] leading-relaxed text-muted">
                모든 기록은 이 브라우저의 로컬 저장소에만 보관됩니다. 샘플 기업·인물은 가상이며, 실제 인물 정보는
                사용하지 않습니다. 초안은 분석 요청에만 쓰이고 서버에 저장하지 않습니다.
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} className="btn btn-primary mt-4 h-9 w-full text-[12px]">
                확인
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[74px] z-50 flex justify-center px-4 xl:bottom-6">
            <div
              className={cx(
                "animate-rise pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11.5px] font-medium shadow-[0_16px_40px_-20px_rgba(16,19,25,0.5)]",
                toast.tone === "ok" && "border-ink/10 bg-ink text-white",
                toast.tone === "warn" && "border-warn/25 bg-warn-soft text-warn",
                toast.tone === "err" && "border-risk/25 bg-risk-soft text-risk",
              )}
            >
              {toast.tone === "ok" && <History size={13} className="opacity-70" />}
              {toast.message}
            </div>
          </div>
        )}
      </div>

      {analysis && view !== "library" && <PrintReport analysis={analysis} />}
    </>
  );
}

function useMemoTabs(analysis: Analysis | null) {
  const tabs: { id: TabId; label: string; icon: typeof Newspaper; count: number }[] = [];
  if (!analysis) return tabs;
  tabs.push({ id: "press", label: "기자 시각", icon: Newspaper, count: analysis.factChecks.length });
  tabs.push({ id: "sentiment", label: "여론", icon: MessagesSquare, count: analysis.channelForecasts.length });
  tabs.push({ id: "xray", label: "문장 X-ray", icon: ScanText, count: analysis.spans.length });
  tabs.push({ id: "response", label: "응답 팩", icon: ClipboardCheck, count: analysis.pressQa.length });
  return tabs;
}
