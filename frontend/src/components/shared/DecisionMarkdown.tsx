import { Box, Link } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Agent text is untrusted: render Markdown without HTML or automatic remote image requests. */
export function DecisionMarkdown({ children }: { children: string }) {
  return <Box sx={{ typography: 'body2', lineHeight: 1.8, overflowWrap: 'anywhere', minWidth: 0,
    '& p': { my: 1, whiteSpace: 'pre-line' }, '& h1, & h2': { typography: 'subtitle1', fontWeight: 600, mt: 2, mb: 1 },
    '& h3, & h4, & h5, & h6': { typography: 'subtitle2', mt: 2, mb: 0.5 },
    '& ul, & ol': { pl: 3, my: 1 }, '& li': { mb: 0.5 },
    '& table': { display: 'block', overflowX: 'auto', borderCollapse: 'collapse', my: 1.5 },
    '& th, & td': { border: 1, borderColor: 'divider', p: 1, textAlign: 'left' },
    '& pre': { overflowX: 'auto', bgcolor: 'action.hover', p: 1.5, borderRadius: 1 },
    '& code': { fontFamily: 'monospace' }, '& blockquote': { borderLeft: 3, borderColor: 'divider', ml: 0, pl: 2, color: 'text.secondary' } }}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      a: ({ href, children }) => <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>,
      img: ({ alt }) => <span>{alt || '图片引用'}</span>,
    }}>{children}</ReactMarkdown>
  </Box>;
}
