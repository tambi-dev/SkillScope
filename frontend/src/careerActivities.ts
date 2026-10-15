export const salesRows = [
  { order: "A01", product: "Coffee", amount: 6 },
  { order: "A02", product: "Tea", amount: 2 },
  { order: "A03", product: "Coffee", amount: 3 },
  { order: "A04", product: "Tea", amount: 8 },
  { order: "A04", product: "Tea", amount: 8 },
  { order: "A05", product: "Coffee", amount: 6 },
];
export function checkSales(included: number[], coffee: string, tea: string) {
  const selected = salesRows.filter((_, index) => included.includes(index));
  const unique = new Set(selected.map((row) => row.order));
  return { clean: selected.length === 5 && unique.size === 5, totals: coffee.trim() !== "" && tea.trim() !== "" && Number(coffee) === 15 && Number(tea) === 10 };
}
export const starterHtml = `<h1>Workshop</h1>
<p>A free introduction to making websites.</p>
<button type="button">Click here</button>`;
export function previewDocument(code: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{font:16px/1.6 system-ui,sans-serif;background:#f6f6ee;color:#203b32;padding:20px;overflow-wrap:anywhere}h1{font-size:28px;line-height:1.25}button{font:inherit;padding:10px 16px;border:0;border-radius:4px;background:#173c31;color:white}</style></head><body>${code}</body></html>`;
}
