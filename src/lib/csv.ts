/** Campo CSV (RFC-style): aspas se contiver vírgula, aspas ou quebras de linha. */

export function escapeCsvField(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(
  rows: string[][],
  lineEnding: "\n" | "\r\n" = "\r\n",
): string {
  return rows.map((r) => r.map(escapeCsvField).join(",")).join(lineEnding);
}
