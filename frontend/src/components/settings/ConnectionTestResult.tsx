import { Alert,AlertTitle } from '@mui/material';
import type { TestResult } from '../../types/platform';
import { formatTime } from '../../utils/time';

export function ConnectionTestResult({ result }: {result: TestResult | null;}) {
  if (!result) return null;
  return (
    <Alert severity={result.ok ? 'success' : 'error'}>
      <AlertTitle>{result.ok ? '测试通过' : `测试失败 · ${result.category}`}（{formatTime(result.at)}）</AlertTitle>
      {result.message} {!result.ok && '输入已保留，可修改后重测。'}
    </Alert>);

}
