const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 마지막 글자에 받침이 있는지 (한글 음절 기준) */
export function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return false;
  return (code - HANGUL_START) % 28 !== 0;
}

const batchimIndex = (word: string): number => {
  const last = word.trim().slice(-1);
  if (!last) return -1;
  const code = last.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return -1;
  return (code - HANGUL_START) % 28;
};

export const josaEun = (w: string) => (hasBatchim(w) ? "은" : "는");
export const josaI = (w: string) => (hasBatchim(w) ? "이" : "가");
export const josaEul = (w: string) => (hasBatchim(w) ? "을" : "를");
export const josaGwa = (w: string) => (hasBatchim(w) ? "과" : "와");
export const josaRo = (w: string) => {
  const b = batchimIndex(w);
  return b === -1 || b === 0 || b === 8 ? "로" : "으로";
};
