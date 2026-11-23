import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LlmConfig } from "./types";
import {
  buildLocalPackage,
  buildLocalReview,
  loadPackages,
  removePackage,
  savePackage,
  type EntityId,
  type ResponsePackage,
  type ReviewResult,
} from "./lib/package";
import { AiError, checkServer, describeAiError, requestPackage, requestReview } from "./lib/package-ai";
import { loadApiConfig, persistApiConfig } from "./lib/storage";
import { clearHistory, loadHistory, removeSnapshot, saveSnapshot, snapshotOf, type SimSnapshot } from "./lib/history";
import type { Stance } from "./lib/stances";
import type { SituationTagId } from "./lib/situations";
import { Composer, type ComposeValue } from "./components/Composer";
import { PackageSkeleton, PackageView } from "./components/PackageView";
import { ReviewView } from "./components/ReviewView";
import { ManualModal } from "./components/ManualModal";
import { CaseLibrary } from "./components/CaseLibrary";
import { CaseStudio } from "./components/CaseStudio";
import { SettingsModal } from "./components/SettingsModal";
import { CompareView } from "./components/CompareView";
import { HistoryModal } from "./components/HistoryModal";
import { cx } from "./components/ui";
import { PlanProvider, usePlan } from "./components/PlanContext";
import { BriefingView } from "./components/BriefingView";
import { decodeShare, readShareToken, type SharePayload } from "./lib/share";

type Stage = "compose" | "loading" | "package" | "reviewLoading" | "review";

const EMPTY_FORM: ComposeValue = {
  situation: "",
  brand: "",
  stance: "investigating",
  stanceCustom: "",
  situations: [],
  situationNote: "",
  entities: ["general"],
  industry: "auto",
  caseType: "auto",
  stage: "breaking",
  scale: "mid",
};

export default function App() {
  return (
    <PlanProvider>
      <AppShell />
    </PlanProvider>
  );
}

function AppShell() {
  const [stage, setStage] = useState<Stage>("compose");
  const [form, setForm] = useState<ComposeValue>(EMPTY_FORM);
  const [reviewMode, setReviewMode] = useState(false);
  const [pkg, setPkg] = useState<ResponsePackage | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageNote, setStageNote] = useState("상황을 정리하는 중");
  const [recent, setRecent] = useState<ResponsePackage[]>(() => loadPackages());
  const [apiConfig, setApiConfig] = useState<LlmConfig>(() => loadApiConfig());
  const [aiReady, setAiReady] = useState(false);
  const [aiNote, setAiNote] = useState("AI 연결 확인 중");
  const [manualOpen, setManualOpen] = useState(false);
  const [library, setLibrary] = useState<{ open: boolean; caseId?: string }>({ open: false });
  const [studioOpen, setStudioOpen] = useState(false);
  const [caseRev, setCaseRev] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SimSnapshot[]>(() => loadHistory());
  const [compare, setCompare] = useState<{ a: SimSnapshot; b: SimSnapshot; pkgs?: Record<string, ResponsePackage> } | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const seq = useRef(0);
  const localRef = useRef<ResponsePackage | null>(null);
  const [fallbackOffer, setFallbackOffer] = useState<ComposeValue | null>(null);
  const { allows, openPricing } = usePlan();
  const [briefing, setBriefing] = useState<{ ready: boolean; payload: SharePayload | null; error?: string }>({
    ready: false,
    payload: null,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const token = readShareToken();
      if (!token) {
        if (alive) setBriefing({ ready: false, payload: null });
        return;
      }
      const payload = await decodeShare(token);
      if (!alive) return;
      window.scrollTo({ top: 0, behavior: "auto" });
      setBriefing({
        ready: true,
        payload,
        error: payload ? undefined : "링크가 손상되었거나 지원하지 않는 형식입니다. 보낸 사람에게 링크를 다시 요청하세요.",
      });
    };
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", load);
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  /** 패키지가 만들어질 때마다 비교용 요약을 이 브라우저에 남깁니다. */
  const remember = useCallback((pkg: ResponsePackage) => {
    setHistory(saveSnapshot(pkg));
  }, []);

  /** 같은 입력에 다른 입장을 적용해 즉시 비교합니다. AI 없이 규칙 엔진으로 만들어 즉시 돌아옵니다. */
  const compareStance = useCallback(
    (stance: Stance) => {
      if (!pkg) return;
      if (!allows("compare")) {
        openPricing("compare");
        return;
      }
      const alt = buildLocalPackage({
        situation: pkg.situation,
        brand: pkg.brand,
        stance,
        stanceCustom: stance === "custom" ? pkg.stanceCustom : undefined,
        situations: pkg.situations ?? [],
        situationNote: pkg.situationNote ?? "",
        entities: pkg.entities,
        industry: pkg.industry,
        caseType: pkg.caseType ?? "auto",
        stage: pkg.stage ?? "breaking",
        scale: pkg.scale ?? "mid",
      });
      setCompare({ a: snapshotOf(pkg), b: snapshotOf(alt), pkgs: { [pkg.id]: pkg, [alt.id]: alt } });
      setHistory(saveSnapshot(alt));
    },
    [pkg, allows, openPricing],
  );

  const openSnapshot = useCallback(
    (snap: SimSnapshot) => {
      const rebuilt = buildLocalPackage({
        situation: snap.situation,
        brand: snap.brand,
        stance: snap.stance as Stance,
        stanceCustom: snap.stanceCustom,
        situations: (snap.situations ?? []) as SituationTagId[],
        entities: (snap.entities ?? ["general"]) as EntityId[],
        industry: snap.industry ?? "auto",
        caseType: snap.caseType ?? "auto",
        stage: (snap.stage ?? "breaking") as ComposeValue["stage"],
        scale: (snap.scale ?? "mid") as ComposeValue["scale"],
      });
      setPkg(rebuilt);
      setHistoryOpen(false);
      setCompare(null);
      setStage("package");
    },
    [],
  );

  const openById = useCallback(
    (id: string) => {
      const fromCompare = compare?.pkgs?.[id];
      if (fromCompare) {
        setPkg(fromCompare);
        setCompare(null);
        setStage("package");
        return;
      }
      const snap = compare?.a.id === id ? compare.a : compare?.b.id === id ? compare.b : history.find((h) => h.id === id);
      if (snap) openSnapshot(snap);
    },
    [compare, history, openSnapshot],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void checkServer().then((s) => {
      setAiReady(Boolean(s.ok && (s.serverKey || apiConfig.apiKey)));
      setAiNote(
        !apiConfig.enabled
          ? "실시간 AI 꺼짐 · 매뉴얼 엔진"
          : s.ok
            ? s.serverKey
              ? `실시간 AI · ${s.model}`
              : apiConfig.apiKey
                ? "개인 키 사용"
                : "서버 키 없음 · 매뉴얼 엔진"
            : "AI 없이 매뉴얼 엔진으로도 생성됩니다",
      );
    });
  }, [apiConfig.apiKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  const submit = useCallback(async (override?: ComposeValue) => {
    setError(null);
    const my = seq.current + 1;
    seq.current = my;
    const current = override ?? form;
    const text = current.situation.replace(/\r\n/g, "\n");

    if (reviewMode) {
      if (text.trim().length < 20) {
        setError("검수할 입장문은 20자 이상 붙여넣어 주세요.");
        return;
      }
      const local = buildLocalReview(text, current.brand);
      setStage("reviewLoading");
      setStageNote("초안의 위험 표현을 짚는 중");
      if (!apiConfig.enabled) {
        setReview({ ...local, modeNote: "설정에서 실시간 AI를 꺼 두었습니다. 매뉴얼 엔진으로 검수했습니다." });
        setStage("review");
        return;
      }
      try {
        const result = await requestReview(text, current.brand, {
          apiKey: apiConfig.apiKey,
          onStage: setStageNote,
        });
        if (seq.current !== my) return;
        setReview(result);
        setStage("review");
      } catch (err) {
        if (seq.current !== my) return;
        setReview({ ...local, modeNote: describeAiError(err) });
        setStage("review");
      }
      return;
    }

    if (text.trim().length < 4) {
      setError("위기 상황을 한 줄 이상 적어 주세요. ‘가격 인상’처럼 짧은 키워드도 됩니다.");
      return;
    }

    const local = buildLocalPackage({
      situation: text,
      brand: current.brand,
      stance: current.stance,
      stanceCustom: current.stanceCustom,
      situations: current.situations,
      situationNote: current.situationNote,
      entities: current.entities as EntityId[],
      industry: current.industry,
      caseType: current.caseType,
      stage: current.stage,
      scale: current.scale,
    });

    setStage("loading");
    setStageNote("상황 유형과 입장을 정리하는 중");

    if (!apiConfig.enabled) {
      const fallback = { ...local, modeNote: "설정에서 실시간 AI를 꺼 두었습니다. 매뉴얼 엔진으로 만들었습니다." };
      setPkg(fallback);
      setRecent(savePackage(fallback));
      remember(fallback);
      setStage("package");
      return;
    }

    localRef.current = local;
    try {
      const result = await requestPackage(local, { apiKey: apiConfig.apiKey, onStage: setStageNote });
      if (seq.current !== my) return;
      setPkg(result);
      setRecent(savePackage(result));
      remember(result);
      setAiReady(true);
      setStage("package");
      notify("대응 패키지를 만들었습니다.");
    } catch (err) {
      if (seq.current !== my) return;
      if (err instanceof AiError && err.code === "fetch") {
        setError(err.message);
        setFallbackOffer(current);
        setStage("compose");
        return;
      }
      const fallback = { ...local, modeNote: describeAiError(err) };
      setPkg(fallback);
      setRecent(savePackage(fallback));
      remember(fallback);
      setStage("package");
    }
  }, [apiConfig, form, notify, remember, reviewMode]);

  /** 기사 본문을 읽지 못해 422로 돌아온 경우, 같은 입력을 URL만으로 다시 만들 수 있게 합니다. */
  const submitWithoutArticle = useCallback(() => {
    const offer = fallbackOffer;
    if (!offer) return;
    const bare = { ...offer, situation: offer.situation.replace(/https?:\/\/[^\s<>"'）)\]]+/i, " ").trim() };
    setFallbackOffer(null);
    setError(null);
    setForm(bare);
    if (!bare.situation || bare.situation.length < 4) {
      notify("기사 요지만 적어 주시면 그 내용으로 만듭니다.");
      return;
    }
    void submit(bare);
  }, [fallbackOffer, notify, submit]);


  const openRecent = (item: ResponsePackage) => {
    seq.current += 1;
    setPkg(item);
    setForm({
      situation: item.situation,
      brand: item.brand,
      stance: item.stance,
      stanceCustom: item.stanceCustom ?? "",
      situations: item.situations ?? [],
      situationNote: item.situationNote ?? "",
      entities: item.entities,
      industry: item.industrySource === "manual" ? item.industry : "auto",
      caseType: item.caseTypeSource === "manual" && item.caseType ? item.caseType : "auto",
      stage: item.stage ?? "breaking",
      scale: item.scale ?? "mid",
    });
    setReviewMode(false);
    setStage("package");
  };

  const regenerate = () => {
    if (!pkg) return;
    const next: ComposeValue = {
      situation: pkg.situation,
      brand: pkg.brand,
      stance: pkg.stance,
      stanceCustom: pkg.stanceCustom ?? "",
      situations: pkg.situations ?? [],
      situationNote: pkg.situationNote ?? "",
      entities: pkg.entities,
      industry: pkg.industrySource === "manual" ? pkg.industry : "auto",
      caseType: pkg.caseTypeSource === "manual" && pkg.caseType ? pkg.caseType : "auto",
      stage: pkg.stage ?? "breaking",
      scale: pkg.scale ?? "mid",
    };
    setForm(next);
    void submit(next);
  };

  const newSituation = () => {
    seq.current += 1;
    setForm({
      ...EMPTY_FORM,
      brand: form.brand,
      entities: form.entities,
      stance: form.stance,
      stanceCustom: form.stanceCustom,
      situations: form.situations,
      situationNote: form.situationNote,
      industry: form.industry,
      caseType: form.caseType,
      stage: form.stage,
      scale: form.scale,
    });
    setPkg(null);
    setReview(null);
    setError(null);
    setReviewMode(false);
    setStage("compose");
  };

  if (briefing.ready) {
    return <BriefingView brief={briefing.payload} error={briefing.error} />;
  }

  if (studioOpen) {
    return (
      <div className="min-h-screen bg-paper">
        <CaseStudio
          onBack={() => setStudioOpen(false)}
          aiReady={aiReady}
          apiKey={apiConfig.apiKey}
          notify={notify}
          onChanged={() => setCaseRev((n) => n + 1)}
        />
        {toast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg" role="status">
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  if (library.open) {
    return (
      <div className="min-h-screen bg-paper">
        <CaseLibrary
          key={caseRev}
          onOpenStudio={() => setStudioOpen(true)}
          initialCaseId={library.caseId}
          onBack={() => {
            setLibrary({ open: false });
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {stage === "compose" && (
        <Composer
          value={form}
          onChange={setForm}
          onSubmit={() => void submit()}
          onOpenManual={() => setManualOpen(true)}
          onOpenLibrary={() => setLibrary({ open: true })}
          onOpenSettings={() => setSettingsOpen(true)}
          reviewMode={reviewMode}
          onReviewMode={(v) => {
            setReviewMode(v);
            setError(null);
          }}
          recent={recent}
          onOpenRecent={openRecent}
          onRemoveRecent={(id) => setRecent(removePackage(id))}
          error={error}
          fallbackOffer={Boolean(fallbackOffer)}
          onFallbackOffer={submitWithoutArticle}
          historyCount={history.length}
          onOpenHistory={() => setHistoryOpen(true)}
          aiReady={aiReady}
          aiNote={aiNote}
        />
      )}

      {stage === "loading" && (
        <PackageSkeleton
          stage={stageNote}
          note="입장·유형에 맞춰 문안과 체크리스트를 조합합니다."
          onSkip={localRef.current ? () => {
            const local = localRef.current;
            if (!local) return;
            seq.current += 1;
            const fallback = { ...local, modeNote: "AI 응답을 기다리지 않고 매뉴얼 엔진 결과를 먼저 열었습니다. 필요하면 ‘다시 만들기’로 AI 결과를 받으세요." };
            setPkg(fallback);
            setRecent(savePackage(fallback));
            remember(fallback);
            setStage("package");
          } : undefined}
        />
      )}
      {stage === "reviewLoading" && <PackageSkeleton stage={stageNote} note="초안의 문장을 하나씩 검사합니다." />}

      {stage === "package" && pkg && (
        <PackageView
          pkg={pkg}
          onEdit={newSituation}
          onRegenerate={regenerate}
          onOpenManual={() => setManualOpen(true)}
          onOpenCase={(id) => setLibrary({ open: true, caseId: id })}
          onNotice={notify}
          onCompareStance={compareStance}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      )}

      {stage === "review" && review && (
        <ReviewView
          review={review}
          onEdit={newSituation}
          onRetry={() => void submit()}
          onNotice={notify}
        />
      )}

      <ManualModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        initialEntity={form.entities[0]}
        onOpenLibrary={() => setLibrary({ open: true })}
      />
      <SettingsModal
        open={settingsOpen}
        config={apiConfig}
        onClose={() => setSettingsOpen(false)}
        onSave={(c) => {
          setApiConfig(c);
          persistApiConfig(c);
          notify(c.enabled ? "AI 설정을 저장했습니다." : "실시간 AI를 꺼 두었습니다.");
        }}
      />

      <HistoryModal
        open={historyOpen}
        items={history}
        onClose={() => setHistoryOpen(false)}
        onCompare={(a, b) => {
          if (!allows("compare")) {
            openPricing("compare");
            return;
          }
          setHistoryOpen(false);
          setCompare({ a, b });
        }}
        onRemove={(id) => setHistory(removeSnapshot(id))}
        onClear={() => setHistory(clearHistory())}
        onOpenItem={openSnapshot}
      />

      {compare && (
        <CompareView
          a={compare.a}
          b={compare.b}
          onClose={() => setCompare(null)}
          onOpen={compare.pkgs ? openById : undefined}
          onNotice={notify}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 print:hidden">
          <div className="animate-rise pointer-events-auto flex items-center gap-2 rounded-xl border border-ink/10 bg-ink px-3.5 py-2.5 text-[11.5px] font-medium text-white shadow-[0_16px_40px_-20px_rgba(16,19,25,0.5)]">
            <CheckCircle2 size={13} className="opacity-70" />
            {toast.message}
          </div>
        </div>
      )}

      {error && stage !== "compose" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 print:hidden">
          <div className={cx("pointer-events-auto flex items-center gap-2 rounded-xl border border-risk/25 bg-risk-soft px-3.5 py-2.5 text-[11.5px] text-risk")}>
            <AlertTriangle size={13} /> {error}
          </div>
        </div>
      )}
    </div>
  );
}
