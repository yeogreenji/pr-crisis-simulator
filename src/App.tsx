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
import { Composer, type ComposeValue } from "./components/Composer";
import { PackageSkeleton, PackageView } from "./components/PackageView";
import { ReviewView } from "./components/ReviewView";
import { ManualModal } from "./components/ManualModal";
import { SettingsModal } from "./components/SettingsModal";
import { cx } from "./components/ui";

type Stage = "compose" | "loading" | "package" | "reviewLoading" | "review";

const EMPTY_FORM: ComposeValue = {
  situation: "",
  brand: "",
  stance: "investigating",
  entities: ["general"],
};

export default function App() {
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const seq = useRef(0);

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

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

  const submit = useCallback(async () => {
    setError(null);
    const my = seq.current + 1;
    seq.current = my;
    const text = form.situation.replace(/\r\n/g, "\n");

    if (reviewMode) {
      if (text.trim().length < 20) {
        setError("검수할 입장문은 20자 이상 붙여넣어 주세요.");
        return;
      }
      const local = buildLocalReview(text, form.brand);
      setStage("reviewLoading");
      setStageNote("초안의 위험 표현을 짚는 중");
      if (!apiConfig.enabled) {
        setReview({ ...local, modeNote: "설정에서 실시간 AI를 꺼 두었습니다. 매뉴얼 엔진으로 검수했습니다." });
        setStage("review");
        return;
      }
      try {
        const result = await requestReview(text, form.brand, {
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

    if (text.trim().length < 8) {
      setError("위기 상황을 한 줄 이상 적어 주세요. 기사 URL만 넣어도 됩니다.");
      return;
    }

    const local = buildLocalPackage({
      situation: text,
      brand: form.brand,
      stance: form.stance,
      entities: form.entities as EntityId[],
    });

    setStage("loading");
    setStageNote("상황 유형과 입장을 정리하는 중");

    if (!apiConfig.enabled) {
      const fallback = { ...local, modeNote: "설정에서 실시간 AI를 꺼 두었습니다. 매뉴얼 엔진으로 만들었습니다." };
      setPkg(fallback);
      setRecent(savePackage(fallback));
      setStage("package");
      return;
    }

    try {
      const result = await requestPackage(local, { apiKey: apiConfig.apiKey, onStage: setStageNote });
      if (seq.current !== my) return;
      setPkg(result);
      setRecent(savePackage(result));
      setAiReady(true);
      setStage("package");
      notify("대응 패키지를 만들었습니다.");
    } catch (err) {
      if (seq.current !== my) return;
      if (err instanceof AiError && err.code === "fetch") {
        setError(err.message);
        setStage("compose");
        return;
      }
      const fallback = { ...local, modeNote: describeAiError(err) };
      setPkg(fallback);
      setRecent(savePackage(fallback));
      setStage("package");
    }
  }, [apiConfig, form, notify, reviewMode]);

  const openRecent = (item: ResponsePackage) => {
    seq.current += 1;
    setPkg(item);
    setForm({ situation: item.situation, brand: item.brand, stance: item.stance, entities: item.entities });
    setReviewMode(false);
    setStage("package");
  };

  const regenerate = () => {
    if (!pkg) return;
    setForm({ situation: pkg.situation, brand: pkg.brand, stance: pkg.stance, entities: pkg.entities });
    void submit();
  };

  const newSituation = () => {
    seq.current += 1;
    setForm({ ...EMPTY_FORM, brand: form.brand, entities: form.entities, stance: form.stance });
    setPkg(null);
    setReview(null);
    setError(null);
    setReviewMode(false);
    setStage("compose");
  };

  return (
    <div className="min-h-screen bg-paper">
      {stage === "compose" && (
        <Composer
          value={form}
          onChange={setForm}
          onSubmit={() => void submit()}
          onOpenManual={() => setManualOpen(true)}
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
          aiReady={aiReady}
          aiNote={aiNote}
        />
      )}

      {stage === "loading" && <PackageSkeleton stage={stageNote} note="입장·유형에 맞춰 문안과 체크리스트를 조합합니다." />}
      {stage === "reviewLoading" && <PackageSkeleton stage={stageNote} note="초안의 문장을 하나씩 검사합니다." />}

      {stage === "package" && pkg && (
        <PackageView
          pkg={pkg}
          onEdit={newSituation}
          onRegenerate={regenerate}
          onOpenManual={() => setManualOpen(true)}
          onNotice={notify}
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

      <ManualModal open={manualOpen} onClose={() => setManualOpen(false)} initialEntity={form.entities[0]} />
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

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="animate-rise pointer-events-auto flex items-center gap-2 rounded-xl border border-ink/10 bg-ink px-3.5 py-2.5 text-[11.5px] font-medium text-white shadow-[0_16px_40px_-20px_rgba(16,19,25,0.5)]">
            <CheckCircle2 size={13} className="opacity-70" />
            {toast.message}
          </div>
        </div>
      )}

      {error && stage !== "compose" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className={cx("pointer-events-auto flex items-center gap-2 rounded-xl border border-risk/25 bg-risk-soft px-3.5 py-2.5 text-[11.5px] text-risk")}>
            <AlertTriangle size={13} /> {error}
          </div>
        </div>
      )}
    </div>
  );
}
