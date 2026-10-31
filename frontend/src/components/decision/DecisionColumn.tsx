import { Alert,Box } from '@mui/material';
import type { DecisionRequest,Execution } from '../../types/workbench';
import { DecisionPanel } from './DecisionPanel';
import { DecisionQueue } from './DecisionQueue';

interface DecisionColumnProps {
  execution: Execution;
  requests: DecisionRequest[];
  activeRequest: DecisionRequest | null;
  missingRequest: boolean;
  onSelect: (id: string) => void;
  onOpenEvidence: (id: string) => void;
}

export function DecisionColumn({ execution, requests, activeRequest, missingRequest, onSelect, onOpenEvidence }: DecisionColumnProps) {
  return (
    <Box>
      <DecisionQueue requests={requests} activeId={activeRequest?.id ?? null} onSelect={onSelect} />
      {missingRequest &&
      <Alert severity="warning" sx={{ m: 2, mb: 0 }}>
          指定的请求不存在或你无权查看。
        </Alert>
      }
      {activeRequest ?
      <DecisionPanel key={activeRequest.id} request={activeRequest} execution={execution} onOpenEvidence={onOpenEvidence} /> :

      <Alert severity="success" sx={{ m: 2 }}>
          当前无须人工处理。后台工作不依赖本页面保持打开。
        </Alert>
      }
    </Box>);

}
