import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import type { Blocker } from 'react-router-dom';

interface UnsavedChangesDialogProps {
  blocker: Blocker;
  onSave: () => boolean;
  onDiscard: () => void;
}

export function UnsavedChangesDialog({ blocker, onSave, onDiscard }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()}>
      <DialogTitle>有未保存的更改</DialogTitle>
      <DialogContent>
        <DialogContentText>离开前请选择保存或放弃。保存不会自动启动执行或改变既有执行的依据。</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => blocker.reset?.()}>取消</Button>
        <Button
          color="error"
          onClick={() => {
            onDiscard();
            blocker.proceed?.();
          }}>
          
          放弃
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            if (onSave()) blocker.proceed?.();else
            blocker.reset?.();
          }}>
          
          保存
        </Button>
      </DialogActions>
    </Dialog>);

}