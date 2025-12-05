import { ThemeProvider, CssBaseline, Box, Alert } from '@mui/material';
import { theme } from './theme';
import { InputForm } from './components/InputForm';
import { YearSummary } from './components/YearSummary';
import { useNostrStats } from './hooks/useNostrStats';

function App() {
  const { stats, isLoading, progress, error, fetchStats, reset } = useNostrStats();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
          py: 4,
        }}
      >
        {!stats ? (
          <Box sx={{ maxWidth: 600, mx: 'auto', px: 2 }}>
            <InputForm
              onSubmit={fetchStats}
              isLoading={isLoading}
              progress={progress}
            />
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        ) : (
          <YearSummary stats={stats} onReset={reset} />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
