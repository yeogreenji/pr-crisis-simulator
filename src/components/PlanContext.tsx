import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  loadPlanState,
  planAllows,
  switchPlan,
  type BillingCycle,
  type FeatureKey,
  type PlanId,
  type PlanState,
} from "../lib/plans";
import { PricingModal } from "./PricingModal";

interface PlanApi {
  plan: PlanState;
  allows: (feature: FeatureKey) => boolean;
  openPricing: (highlight?: FeatureKey) => void;
  choosePlan: (id: PlanId, cycle: BillingCycle) => void;
  closePricing: () => void;
  pricingOpen: boolean;
  highlight?: FeatureKey;
}

const PlanContext = createContext<PlanApi | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanState>(() => loadPlanState());
  const [pricing, setPricing] = useState<{ open: boolean; highlight?: FeatureKey }>({ open: false });

  const openPricing = useCallback((highlight?: FeatureKey) => setPricing({ open: true, highlight }), []);
  const closePricing = useCallback(() => setPricing((p) => ({ ...p, open: false })), []);
  const choosePlan = useCallback((id: PlanId, cycle: BillingCycle) => {
    setPlan(switchPlan(id, cycle));
  }, []);

  const allows = useCallback((feature: FeatureKey) => planAllows(plan.id, feature), [plan.id]);

  const api = useMemo<PlanApi>(
    () => ({ plan, allows, openPricing, choosePlan, closePricing, pricingOpen: pricing.open, highlight: pricing.highlight }),
    [plan, allows, openPricing, choosePlan, closePricing, pricing.open, pricing.highlight],
  );

  return (
    <PlanContext.Provider value={api}>
      {children}
      <PricingModal
        open={pricing.open}
        highlight={pricing.highlight}
        plan={plan}
        onClose={closePricing}
        onChoose={choosePlan}
      />
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanApi {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside PlanProvider");
  return ctx;
}
