// Read only the outlet column from standard, unencrypted .xlsx workbooks.
export async function readOutlets(file: File): Promise<string[]> {
  if (file.size > 10_000_000) throw new Error("10MB 이하의 엑셀 파일을 선택하세요.");
  const bytes = await file.arrayBuffer();
  const zip = new DataView(bytes);
  let end = bytes.byteLength - 22;
  while (end >= Math.max(0, bytes.byteLength - 65557) && zip.getUint32(end, true) !== 0x06054b50) end--;
  if (end < Math.max(0, bytes.byteLength - 65557)) throw new Error("올바른 .xlsx 파일을 선택하세요.");
  const decoder = new TextDecoder();
  const entries = new Map<string, number>();
  let cursor = zip.getUint32(end + 16, true);
  for (let index = 0; index < zip.getUint16(end + 10, true); index++) {
    if (zip.getUint32(cursor, true) !== 0x02014b50) throw new Error("엑셀 압축 구조를 읽을 수 없습니다.");
    const length = zip.getUint16(cursor + 28, true);
    entries.set(decoder.decode(bytes.slice(cursor + 46, cursor + 46 + length)), cursor);
    cursor += 46 + length + zip.getUint16(cursor + 30, true) + zip.getUint16(cursor + 32, true);
  }

  async function xml(entry: number) {
    const size = zip.getUint32(entry + 20, true);
    const expandedSize = zip.getUint32(entry + 24, true);
    const start = zip.getUint32(entry + 42, true);
    const offset = start + 30 + zip.getUint16(start + 26, true) + zip.getUint16(start + 28, true);
    const method = zip.getUint16(entry + 10, true);
    if (expandedSize > 12_000_000 || ![0, 8].includes(method)) throw new Error("지원하지 않는 엑셀 압축 형식입니다.");
    const data = bytes.slice(offset, offset + size);
    const body = method === 0 ? data : await new Response(new Blob([data]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    const doc = new DOMParser().parseFromString(decoder.decode(body), "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("엑셀 시트를 읽을 수 없습니다.");
    return doc;
  }

  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const shared = sharedEntry === undefined ? [] : [...(await xml(sharedEntry)).querySelectorAll("si")]
    .map((item) => [...item.querySelectorAll("t")].map((part) => part.textContent).join(""));
  const names = new Set<string>();
  for (const [path, entry] of entries) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue;
    let outletColumn = "";
    for (const row of (await xml(entry)).querySelectorAll("sheetData row")) {
      for (const cell of row.querySelectorAll("c")) {
        const column = cell.getAttribute("r")?.match(/^[A-Z]+/)?.[0] ?? "";
        if (outletColumn && outletColumn !== column) continue;
        const raw = cell.querySelector("v")?.textContent ?? "";
        const value = (cell.getAttribute("t") === "s" ? shared[Number(raw)] :
          cell.getAttribute("t") === "inlineStr" ? cell.querySelector("is")?.textContent : raw)?.trim() ?? "";
        if (["매체", "매체명", "언론사", "언론사명"].includes(value)) {
          outletColumn = column;
          break;
        }
        if (outletColumn && value && value.length <= 100 && /[\p{L}]/u.test(value) && !/[@\r\n]/.test(value)) names.add(value);
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ko"));
}
