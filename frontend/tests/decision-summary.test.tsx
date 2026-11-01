import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decisionSummary } from '../src/utils/decisionSummary';
import { DecisionMarkdown } from '../src/components/shared/DecisionMarkdown';
it('keeps a supplied list title independent of the full question and shortens historical questions', () => {
 const question = '【9.6.3 O1 待确认事实】完整问题\n\n## 已知条件\n' + '很长的背景'.repeat(100);
 expect(decisionSummary({summary:'核实例行 Type 4 任务',question})).toBe('核实例行 Type 4 任务');
 expect(decisionSummary({question})).toBe('9.6.3 O1 待确认事实');
 expect(Array.from(decisionSummary({question:'问'.repeat(1000)}))).toHaveLength(41);
 expect(question).toContain('## 已知条件');
});
it('renders full question structure without executing HTML or loading external images', () => {
 const html=renderToStaticMarkup(createElement(DecisionMarkdown,{children:'## 核对条件\n\n- **例行任务**\n- 资料待补\n\n<script>alert(1)</script>\n\n![说明](https://example.com/track.png)'}));
 expect(html).toContain('<h2>核对条件</h2>');expect(html).toContain('<strong>例行任务</strong>');expect(html).toContain('<ul>');
 expect(html).not.toContain('<script');expect(html).not.toContain('<img');expect(html).not.toContain('track.png');
});
