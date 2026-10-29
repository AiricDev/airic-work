import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Tooltip } from '@mui/material';
import { omFileLink, resolveRelative } from '../../utils/omRepository';

interface MarkdownViewProps {
  content: string;
  path: string;
  sha: string;
  highlight?: string;
}

/** Wrap occurrences of `q` in plain-string children with <mark>. */
function highlightChildren(children: React.ReactNode, q: string): React.ReactNode {
  if (!q) return children;
  const lower = q.toLowerCase();
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    const parts: React.ReactNode[] = [];
    let rest = child;
    let idx = rest.toLowerCase().indexOf(lower);
    let key = 0;
    while (idx >= 0) {
      if (idx > 0) parts.push(rest.slice(0, idx));
      parts.push(
        <Box component="mark" key={key++} sx={{ bgcolor: 'warning.light', color: 'inherit', px: 0.25, borderRadius: 0.5 }}>
          {rest.slice(idx, idx + q.length)}
        </Box>
      );
      rest = rest.slice(idx + q.length);
      idx = rest.toLowerCase().indexOf(lower);
    }
    parts.push(rest);
    return parts;
  });
}

export function MarkdownView({ content, path, sha, highlight = '' }: MarkdownViewProps) {
  const hl = (Tag: keyof JSX.IntrinsicElements) =>
  function Highlighted({ children }: {children?: React.ReactNode;}) {
    return React.createElement(Tag, null, highlightChildren(children, highlight));
  };

  return (
    <Box
      sx={{
        typography: 'body2',
        lineHeight: 1.75,
        '& h1': { typography: 'h6', mt: 0, mb: 1.5 },
        '& h2': { typography: 'subtitle1', fontWeight: 600, mt: 2.5, mb: 1 },
        '& h3': { typography: 'subtitle2', mt: 2, mb: 0.5 },
        '& p': { my: 1 },
        '& ul, & ol': { pl: 3, my: 1 },
        '& table': { borderCollapse: 'collapse', my: 1.5, width: '100%', display: 'block', overflowX: 'auto' },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1.25, py: 0.75, textAlign: 'left', verticalAlign: 'top' },
        '& th': { bgcolor: 'grey.50', fontWeight: 600 },
        '& code': { fontFamily: 'monospace', fontSize: 12, bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 },
        '& pre': { bgcolor: 'grey.50', border: 1, borderColor: 'divider', p: 1.5, borderRadius: 1, overflowX: 'auto' },
        '& pre code': { bgcolor: 'transparent', p: 0 }
      }}>
      
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          p: hl('p'),
          li: hl('li'),
          td: hl('td'),
          th: hl('th'),
          h1: hl('h1'),
          h2: hl('h2'),
          h3: hl('h3'),
          strong: hl('strong'),
          code: hl('code'),
          a: ({ href, children }) => {
            const target = href ? resolveRelative(path, href) : null;
            if (target) {
              return (
                <Link component={RouterLink} to={omFileLink(sha, target)}>
                  {children}
                </Link>);

            }
            return (
              <Tooltip title="外部或越出仓库的链接在原型中不打开">
                <Box component="span" sx={{ textDecoration: 'underline dotted', color: 'text.secondary' }}>
                  {children}
                </Box>
              </Tooltip>);

          },
          img: ({ alt }) =>
          <Box component="span" sx={{ color: 'text.secondary' }}>
              [图片：{alt || '未命名'}，原型不预览]
            </Box>

        }}>
        
        {content}
      </ReactMarkdown>
    </Box>);

}