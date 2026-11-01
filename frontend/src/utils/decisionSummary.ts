/** Historical requests keep their question; this title is only a display projection. */
export function decisionSummary(request: { summary?: string; question: string }): string {
  if (request.summary?.trim()) return request.summary.trim();
  const first = request.question.split(/\r?\n/).find(line => line.trim())?.trim() ?? '';
  const label = first.match(/^【([^】]+)】/);
  const plain = (label?.[1] ?? first).replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^\s{0,3}#{1,6}\s+|[*_`~]/g, '').replace(/\s+/g, ' ').trim();
  const characters = Array.from(plain);
  return characters.length > 40 ? characters.slice(0, 40).join('') + '…' : plain || '待回应的问题';
}
