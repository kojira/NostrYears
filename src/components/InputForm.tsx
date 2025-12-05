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
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import { hasNip07, getPubkeyFromNip07 } from '../services/nostrPublisher';
import { DEFAULT_RELAYS, fetchProfile } from '../services/nostrFetcher';
import { RelaySettings } from './RelaySettings';
import type { FetchProgress, NostrProfile } from '../types/nostr';

interface InputFormProps {
  onSubmit: (pubkey: string, relays: string[]) => void;
  isLoading: boolean;
  progress: FetchProgress | null;
}

export function InputForm({ onSubmit, isLoading, progress }: InputFormProps) {
  const [npubInput, setNpubInput] = useState('');
  const [relays, setRelays] = useState<string[]>([...DEFAULT_RELAYS]);
  const [error, setError] = useState<string | null>(null);
  const [hasExtension, setHasExtension] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<NostrProfile | null>(null);
  const [previewPubkey, setPreviewPubkey] = useState<string | null>(null);

  useEffect(() => {
    // Check for NIP-07 extension after a short delay (extensions may load after page)
    const timer = setTimeout(() => {
      setHasExtension(hasNip07());
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const parsePubkey = (pubkeyOrNpub: string): string | null => {
    let pubkey = pubkeyOrNpub;
    
    // If it starts with npub, decode it
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
    
    // Validate hex pubkey
    if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
      return null;
    }
    
    return pubkey.toLowerCase();
  };

  const validateAndSubmit = (pubkeyOrNpub: string) => {
    setError(null);
    
    if (relays.length === 0) {
      setError('少なくとも1つのリレーを選択してください');
      return;
    }
    
    const pubkey = parsePubkey(pubkeyOrNpub);
    if (!pubkey) {
      setError('無効な公開鍵です');
      return;
    }
    
    onSubmit(pubkey, relays);
  };

  const handleNpubSubmit = () => {
    if (!npubInput.trim()) {
      setError('npubを入力してください');
      return;
    }
    validateAndSubmit(npubInput.trim());
  };

  const handleNip07 = async () => {
    setError(null);
    const pubkey = await getPubkeyFromNip07();
    if (pubkey) {
      // Convert to npub and set in input field
      try {
        const npub = nip19.npubEncode(pubkey);
        setNpubInput(npub);
        
        // Fetch and show profile preview
        setPreviewPubkey(pubkey);
        const profile = await fetchProfile(pubkey, relays);
        setPreviewProfile(profile);
      } catch {
        setNpubInput(pubkey);
      }
    } else {
      setError('NIP-07拡張から公開鍵を取得できませんでした');
    }
  };

  // Fetch profile preview when input changes
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
        2025年のNostr活動を振り返ろう
      </Typography>

      <Stack spacing={2} sx={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
        <TextField
          fullWidth
          label="npub または 公開鍵 (hex)"
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
        
        <RelaySettings
          relays={relays}
          onRelaysChange={setRelays}
          disabled={isLoading}
        />
        
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
          集計開始
        </Button>

        {hasExtension && (
          <>
            <Typography
              variant="body2"
              sx={{ textAlign: 'center', color: 'text.secondary' }}
            >
              または
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
              🔑 NIP-07拡張から取得
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
            {/* Show profile during loading */}
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
                    の2025年を集計中...
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
          💡 NIP-07対応の拡張機能（nos2x, Albyなど）をインストールすると、
          結果をリレーに投稿して他のユーザーと比較できます
        </Typography>
      )}
    </Box>
  );
}
