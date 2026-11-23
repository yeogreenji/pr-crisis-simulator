import type { ResponsePackage } from "./package";
import type { ChannelKit } from "./channels";
import { planAllows, type PlanId } from "./plans";

export type ChannelSlot = "official" | "qa" | "internal" | "social";

export interface ChannelState {
  id: ChannelSlot;
  n: string;
  label: string;
  short: string;
  ready: boolean;
  /** 이 플랜에서 열람할 수 있는 채널인지 */
  unlocked: boolean;
  detail: string;
}

/**
 * 4채널 준비 상태. 문안이 실제로 채워졌는지(ready)와 현재 플랜에서 열리는지(unlocked)를 나눠서 봅니다.
 * 임원 요약 바의 "채널 준비 4/4"는 이 플랜에서 쓸 수 있는 채널만 셉니다.
 */
export function channelStates(pkg: ResponsePackage, kit: ChannelKit, plan: PlanId): ChannelState[] {
  const channelsUnlocked = planAllows(plan, "channels");
  return [
    {
      id: "official",
      n: "①",
      label: "공식 입장문·보도자료",
      short: "대외 문안",
      ready: pkg.statements.length >= 2 && pkg.statements.every((s) => s.body.trim().length > 80),
      unlocked: true,
      detail: `${pkg.statements.length}종`,
    },
    {
      id: "qa",
      n: "②",
      label: "기자 Q&A·방어 논리",
      short: "질문 대응",
      ready: pkg.qa.length >= 3 && Boolean(kit.defense?.length),
      unlocked: true,
      detail: `${pkg.qa.length}문항`,
    },
    {
      id: "internal",
      n: "③",
      label: "사내 임직원 공지문",
      short: "내부 커뮤니케이션",
      ready: kit.internal.body.trim().length > 40 && kit.internal.dos.length > 0,
      unlocked: channelsUnlocked,
      detail: kit.internal.dos.length ? `${kit.internal.dos.length}개 지침` : "준비 중",
    },
    {
      id: "social",
      n: "④",
      label: "SNS 공지·댓글 대응",
      short: "인스타·X",
      ready: kit.social.short.trim().length > 20 && kit.social.commentGuide.length > 0,
      unlocked: channelsUnlocked,
      detail: `${kit.social.commentGuide.length}유형`,
    },
  ];
}

export function readinessSummary(states: ChannelState[]): { usable: number; total: number; allReady: boolean } {
  const usable = states.filter((s) => s.unlocked);
  return {
    usable: usable.filter((s) => s.ready).length,
    total: usable.length,
    allReady: usable.every((s) => s.ready),
  };
}
