import React, { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField } from
'@mui/material';
import type { ActionResult } from '../../types/platform';
import { usePlatform } from '../../contexts/PlatformContext';

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (r: ActionResult) => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const { createUser } = usePlatform();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setRole('member');
    setStatus('active');
    setShowErrors(false);
    setError(null);
  };

  const submit = () => {
    setShowErrors(true);
    if (!name.trim() || !EMAIL.test(email.trim())) return;
    const r = createUser({ name, email, systemRole: role, status });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    onCreated(r);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="create-user-title">
      <DialogTitle id="create-user-title">新增用户</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="显示名" required value={name} onChange={(e) => setName(e.target.value)} error={showErrors && !name.trim()} helperText={showErrors && !name.trim() ? '请填写显示名' : ' '} />
          <TextField
            label="登录标识 / 邮箱"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={showErrors && !EMAIL.test(email.trim()) || Boolean(error)}
            helperText={showErrors && !EMAIL.test(email.trim()) ? '请填写有效的邮箱格式' : error ?? '需唯一'} />
          
          <FormControl>
            <FormLabel id="cu-role">角色</FormLabel>
            <RadioGroup row aria-labelledby="cu-role" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
              <FormControlLabel value="member" control={<Radio size="small" />} label="成员" />
              <FormControlLabel value="admin" control={<Radio size="small" />} label="管理员" />
            </RadioGroup>
          </FormControl>
          <FormControl>
            <FormLabel id="cu-status">初始状态</FormLabel>
            <RadioGroup row aria-labelledby="cu-status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}>
              <FormControlLabel value="active" control={<Radio size="small" />} label="有效" />
              <FormControlLabel value="disabled" control={<Radio size="small" />} label="已停用" />
            </RadioGroup>
          </FormControl>
          <Alert severity="info">
            创建后立即生效，无需接受邀请。账户已创建不等于业务身份已关联或业务授权已完成；凭据初始化与 SSO 机制 TBD，不设置默认密码，也不发送任何链接。
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={submit}>创建用户</Button>
      </DialogActions>
    </Dialog>);

}