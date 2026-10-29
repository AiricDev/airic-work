import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    background: { default: '#f5f6f8' }
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"Roboto", "Noto Sans SC", "Helvetica", "Arial", sans-serif',
    fontSize: 13,
    button: { textTransform: 'none', fontWeight: 500 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: '0.06em', lineHeight: 1.8 }
  },
  components: {
    MuiButton: { defaultProps: { size: 'small', disableElevation: true } },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiChip: { defaultProps: { size: 'small' } },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiAlert: { styleOverrides: { root: { alignItems: 'flex-start' } } },
    MuiTooltip: { defaultProps: { arrow: true } }
  }
});