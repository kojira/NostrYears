import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Stack,
  Avatar,
  Collapse,
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import { hasNip07, getPubkeyFromNip07 } from '../services/nostrPublisher';
import { DEFAULT_RELAYS, fetchProfile, fetchRelayList } from '../services/nostrFetcher';
import { RelaySettings } from './RelaySettings';
import { RecentResults } from './RecentResults';
import type { FetchProgress, NostrProfile, NostrYearsEventContent } from '../types/nostr';

interface InputFormProps {
  onSubmit: (pubkey: string, relays: string[], periodSince: number, periodUntil: number) => void;
  onLoadCachedResult: (pubkey: string, content: NostrYearsEventContent, profile: NostrProfile | null) => void;
  isLoading: boolean;
  progress: FetchProgress | null;
}

// Default period: 2025/1/1 0:00:00 JST to 2025/12/1 0:00:00 JST
const DEFAULT_SINCE = '2025-01-01';
const DEFAULT_UNTIL = '2025-12-01';

export function InputForm({ onSubmit, onLoadCachedResult, isLoading, progress }: InputFormProps) {
  const [npubInput, setNpubInput] = useState('');
  const [relays, setRelays] = useState<string[]>([...DEFAULT_RELAYS]);
  const [error, setError] = useState<string | null>(null);
  const [hasExtension, setHasExtension] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<NostrProfile | null>(null);
  const [previewPubkey, setPreviewPubkey] = useState<string | null>(null);
  const [showPeriodSettings, setShowPeriodSettings] = useState(false);
  const [sinceDateInput, setSinceDateInput] = useState(DEFAULT_SINCE);
  const [untilDateInput, setUntilDateInput] = useState(DEFAULT_UNTIL);
  const [isFetchingRelays, setIsFetchingRelays] = useState(false);

  useEffect(() => {
    // Check for NIP-07 extension after a short delay
    const timer = setTimeout(() => {
      setHasExtension(hasNip07());
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const parsePubkey = (pubkeyOrNpub: string): string | null => {
    let pubkey = pubkeyOrNpub;
    
    if (pubkeyOrNpub.startsWith('npub')) {
      try {
        const decoded = nip19.decode(pubkeyOrNpub);
        if (decoded.type !== 'npub') {
          return null;
        }
        pubkey = decoded.data as string;
      } catch {
        return null;
      }
    }
    
    if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
      return null;
    }
    
    return pubkey.toLowerCase();
  };

  const getUnixTimestamp = (dateStr: string, isEndOfDay: boolean): number => {
    // Parse as JST (UTC+9)
    const date = new Date(dateStr + 'T00:00:00+09:00');
    if (isEndOfDay) {
      date.setHours(23, 59, 59, 999);
    }
    return Math.floor(date.getTime() / 1000);
  };

  const validateAndSubmit = (pubkeyOrNpub: string) => {
    setError(null);
    
    if (relays.length === 0) {
      setError('Please select at least one relay');
      return;
    }
    
    const pubkey = parsePubkey(pubkeyOrNpub);
    if (!pubkey) {
      setError('Invalid public key');
      return;
    }

    const periodSince = getUnixTimestamp(sinceDateInput, false);
    const periodUntil = getUnixTimestamp(untilDateInput, true);

    if (periodSince >= periodUntil) {
      setError('Start date must be before end date');
      return;
    }
    
    onSubmit(pubkey, relays, periodSince, periodUntil);
  };

  const handleNpubSubmit = () => {
    if (!npubInput.trim()) {
      setError('Please enter npub');
      return;
    }
    validateAndSubmit(npubInput.trim());
  };

  const handleNip07 = async () => {
    setError(null);
    const pubkey = await getPubkeyFromNip07();
    if (pubkey) {
      try {
        const npub = nip19.npubEncode(pubkey);
        setNpubInput(npub);
        
        setPreviewPubkey(pubkey);
        const profile = await fetchProfile(pubkey, relays);
        setPreviewProfile(profile);
      } catch {
        setNpubInput(pubkey);
      }
    } else {
      setError('Failed to get public key from NIP-07 extension');
    }
  };

  const handleFetchRelays = async () => {
    setError(null);
    const input = npubInput.trim();
    if (!input) {
      setError('Please enter npub first');
      return;
    }

    const pubkey = parsePubkey(input);
    if (!pubkey) {
      setError('Invalid public key');
      return;
    }

    setIsFetchingRelays(true);
    try {
      // Fetch relay list from multiple sources
      const relayList = await fetchRelayList(pubkey, [...DEFAULT_RELAYS, ...relays]);
      if (relayList.length > 0) {
        // Merge with existing relays, removing duplicates
        const uniqueRelays = Array.from(new Set([...relayList, ...relays]));
        setRelays(uniqueRelays);
      } else {
        setError('No relay list found for this user (NIP-65)');
      }
    } catch {
      setError('Failed to fetch relay list');
    } finally {
      setIsFetchingRelays(false);
    }
  };

  useEffect(() => {
    const fetchPreview = async () => {
      const input = npubInput.trim();
      if (!input) {
        setPreviewProfile(null);
        setPreviewPubkey(null);
        return;
      }

      const pubkey = parsePubkey(input);
      if (pubkey && pubkey !== previewPubkey) {
        setPreviewPubkey(pubkey);
        const profile = await fetchProfile(pubkey, relays);
        setPreviewProfile(profile);
      }
    };

    const debounce = setTimeout(fetchPreview, 500);
    return () => clearTimeout(debounce);
  }, [npubInput, relays, previewPubkey]);

  const getDisplayName = (): string => {
    if (previewProfile?.display_name) return previewProfile.display_name;
    if (previewProfile?.name) return previewProfile.name;
    if (previewPubkey) {
      try {
        const npub = nip19.npubEncode(previewPubkey);
        return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
      } catch {
        return `${previewPubkey.slice(0, 8)}...`;
      }
    }
    return '';
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        p: 4,
      }}
    >
      <Typography
        variant="h1"
        sx={{
          textAlign: 'center',
          mb: 2,
        }}
      >
        NostrYears
      </Typography>
      
      <Typography
        variant="h6"
        sx={{
          color: 'text.secondary',
          textAlign: 'center',
          mb: 2,
        }}
      >
        Review Your Nostr Activity
      </Typography>

      <Stack spacing={2} sx={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
        <TextField
          fullWidth
          label="npub or Public Key (hex)"
          placeholder="npub1..."
          value={npubInput}
          onChange={(e) => setNpubInput(e.target.value)}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleNpubSubmit();
            }
          }}
        />

        {/* Profile preview */}
        {previewProfile && previewPubkey && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              width: '100%',
              borderRadius: 2,
              backgroundColor: 'rgba(156, 39, 176, 0.1)',
              border: '1px solid rgba(156, 39, 176, 0.2)',
            }}
          >
            <Avatar
              src={previewProfile.picture}
              sx={{
                width: 48,
                height: 48,
                border: '2px solid',
                borderColor: 'primary.main',
              }}
            >
              {getDisplayName().charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {getDisplayName()}
              </Typography>
              {previewProfile.nip05 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {previewProfile.nip05}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Period Settings */}
        <Button
          variant="text"
          size="small"
          onClick={() => setShowPeriodSettings(!showPeriodSettings)}
          sx={{ color: 'text.secondary' }}
          disabled={isLoading}
        >
          📅 Period Settings {showPeriodSettings ? '▲' : '▼'}
        </Button>
        
        <Collapse in={showPeriodSettings} sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <TextField
              fullWidth
              type="date"
              label="From"
              value={sinceDateInput}
              onChange={(e) => setSinceDateInput(e.target.value)}
              disabled={isLoading}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              fullWidth
              type="date"
              label="To"
              value={untilDateInput}
              onChange={(e) => setUntilDateInput(e.target.value)}
              disabled={isLoading}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Box>
        </Collapse>
        
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <RelaySettings
            relays={relays}
            onRelaysChange={setRelays}
            disabled={isLoading}
          />
          <Button
            size="small"
            variant="text"
            onClick={handleFetchRelays}
            disabled={isLoading || isFetchingRelays || !npubInput.trim()}
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            {isFetchingRelays ? '📡 Fetching...' : '📡 Fetch relays for this npub (NIP-65)'}
          </Button>
        </Box>
        
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleNpubSubmit}
          disabled={isLoading || !npubInput.trim() || relays.length === 0}
          sx={{
            background: 'linear-gradient(45deg, #9c27b0, #ff4081)',
            '&:hover': {
              background: 'linear-gradient(45deg, #7b1fa2, #c60055)',
            },
          }}
        >
          Start Analysis
        </Button>

        {hasExtension && (
          <>
            <Typography
              variant="body2"
              sx={{ textAlign: 'center', color: 'text.secondary' }}
            >
              or
            </Typography>
            
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleNip07}
              disabled={isLoading || relays.length === 0}
              sx={{
                borderColor: '#9c27b0',
                color: '#ba68c8',
                '&:hover': {
                  borderColor: '#ba68c8',
                  backgroundColor: 'rgba(156, 39, 176, 0.1)',
                },
              }}
            >
              🔑 Get from NIP-07 Extension
            </Button>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
            {error}
          </Alert>
        )}

        {isLoading && progress && (
          <Box sx={{ mt: 3, width: '100%' }}>
            {previewProfile && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(156, 39, 176, 0.1)',
                  border: '1px solid rgba(156, 39, 176, 0.2)',
                }}
              >
                <Avatar
                  src={previewProfile.picture}
                  sx={{
                    width: 56,
                    height: 56,
                    border: '3px solid',
                    borderColor: 'primary.main',
                    boxShadow: '0 2px 10px rgba(156, 39, 176, 0.3)',
                  }}
                >
                  {getDisplayName().charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {getDisplayName()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Analyzing...
                  </Typography>
                </Box>
              </Box>
            )}
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              {progress.message}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress.progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(45deg, #9c27b0, #ff4081)',
                  borderRadius: 4,
                },
              }}
            />
          </Box>
        )}
      </Stack>

      {!hasExtension && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            mt: 2,
            maxWidth: 400,
          }}
        >
          💡 Install a NIP-07 extension (nos2x, Alby, etc.) to post your results to relays and compare with other users
        </Typography>
      )}

      {/* Recent Results */}
      {!isLoading && (
        <Box sx={{ width: '100%', maxWidth: 600 }}>
          <RecentResults
            relays={relays}
            onLoadCachedResult={onLoadCachedResult}
          />
        </Box>
      )}
    </Box>
  );
}
