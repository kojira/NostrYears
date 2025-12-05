import { useState, useCallback } from 'react';
import { ThemeProvider, CssBaseline, Box, Alert } from '@mui/material';
import { theme } from './theme';
import { InputForm } from './components/InputForm';
import { YearSummary } from './components/YearSummary';
import { useNostrStats } from './hooks/useNostrStats';

function App() {
  const { stats, isLoading, progress, error, isFromCache, fetchStats, reset } = useNostrStats();
  const [lastPubkey, setLastPubkey] = useState<string | null>(null);
  const [lastRelays, setLastRelays] = useState<string[]>([]);
  const [lastPeriod, setLastPeriod] = useState<{ since: number; until: number } | null>(null);

  const handleSubmit = useCallback((pubkey: string, relays: string[], periodSince: number, periodUntil: number) => {
    setLastPubkey(pubkey);
    setLastRelays(relays);
    setLastPeriod({ since: periodSince, until: periodUntil });
    fetchStats(pubkey, relays, periodSince, periodUntil);
  }, [fetchStats]);

  const handleRefresh = useCallback(() => {
    if (lastPubkey && lastRelays.length > 0 && lastPeriod) {
      reset();
      setTimeout(() => {
        fetchStats(lastPubkey, lastRelays, lastPeriod.since, lastPeriod.until);
      }, 100);
    }
  }, [lastPubkey, lastRelays, lastPeriod, reset, fetchStats]);

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
              onSubmit={handleSubmit}
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
          <YearSummary 
            stats={stats} 
            onReset={reset} 
            isFromCache={isFromCache}
            onRefresh={handleRefresh}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
