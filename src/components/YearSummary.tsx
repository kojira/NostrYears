import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Alert,
  Snackbar,
  Avatar,
  Chip,
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import { StatsCard } from './StatsCard';
import { FriendsRanking } from './FriendsRanking';
import { TopPost } from './TopPost';
import type { NostrYearsStats, PercentileData } from '../types/nostr';
import { hasNip07, publishNostrYearsStats, fetchAllNostrYearsEvents, createEventContent } from '../services/nostrPublisher';
import { calculateAllPercentiles } from '../utils/percentile';

interface YearSummaryProps {
  stats: NostrYearsStats;
  onReset: () => void;
}

export function YearSummary({ stats, onReset }: YearSummaryProps) {
  const [percentiles, setPercentiles] = useState<PercentileData | null>(null);
  const [percentileCount, setPercentileCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    const loadPercentiles = async () => {
      // Use the same relays for percentile calculation
      const allStats = await fetchAllNostrYearsEvents(stats.relays);
      
      // Filter to only include stats from the same relays
      const sameRelayStats = allStats.filter(s => 
        s.relays && 
        s.relays.length === stats.relays.length &&
        s.relays.every(r => stats.relays.includes(r))
      );
      
      setPercentileCount(sameRelayStats.length);
      
      if (sameRelayStats.length > 0) {
        const myContent = createEventContent(stats);
        const calculated = calculateAllPercentiles(myContent, sameRelayStats);
        setPercentiles(calculated);
      }
    };
    
    loadPercentiles();
  }, [stats]);

  const handlePublish = async () => {
    setPublishing(true);
    const success = await publishNostrYearsStats(stats, stats.relays);
    setPublishing(false);
    
    if (success) {
      setPublished(true);
      setSnackbar({
        open: true,
        message: '結果をリレーに投稿しました！',
        severity: 'success',
      });
      
      // Reload percentiles after publishing
      const allStats = await fetchAllNostrYearsEvents(stats.relays);
      const sameRelayStats = allStats.filter(s => 
        s.relays && 
        s.relays.length === stats.relays.length &&
        s.relays.every(r => stats.relays.includes(r))
      );
      setPercentileCount(sameRelayStats.length);
      
      if (sameRelayStats.length > 0) {
        const myContent = createEventContent(stats);
        const calculated = calculateAllPercentiles(myContent, sameRelayStats);
        setPercentiles(calculated);
      }
    } else {
      setSnackbar({
        open: true,
        message: 'リレーへの投稿に失敗しました',
        severity: 'error',
      });
    }
  };

  const getDisplayName = (): string => {
    if (stats.profile?.display_name) return stats.profile.display_name;
    if (stats.profile?.name) return stats.profile.name;
    try {
      const npub = nip19.npubEncode(stats.pubkey);
      return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
    } catch {
      return `${stats.pubkey.slice(0, 8)}...`;
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto', position: 'relative' }}>
      {/* Top right controls */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Button
          variant="text"
          size="small"
          onClick={onReset}
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          ← 別のユーザー
        </Button>
      </Box>

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h1" sx={{ mb: 3 }}>
          NostrYears 2025
        </Typography>
        
        {/* User Profile Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            mb: 4,
          }}
        >
          <Avatar
            src={stats.profile?.picture}
            sx={{
              width: 100,
              height: 100,
              border: '4px solid',
              borderColor: 'primary.main',
              boxShadow: '0 4px 20px rgba(156, 39, 176, 0.4)',
            }}
          >
            {getDisplayName().charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 600, mt: 1 }}>
            {getDisplayName()}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            の2025年のNostr活動まとめ
          </Typography>
          
          {/* Publish button */}
          {hasNip07() && !published && (
            <Button
              variant="contained"
              size="small"
              onClick={handlePublish}
              disabled={publishing}
              sx={{
                mt: 2,
                background: 'linear-gradient(45deg, #9c27b0, #ff4081)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #7b1fa2, #c60055)',
                },
              }}
            >
              {publishing ? '投稿中...' : '📤 結果をリレーに投稿'}
            </Button>
          )}
          
          {published && (
            <Chip
              label="✓ 投稿済み"
              size="small"
              sx={{ mt: 2, backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' }}
            />
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Kind 1 Stats */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="投稿数 (kind 1)"
            value={stats.kind1Count}
            unit="件"
            percentile={percentiles?.kind1Count}
            icon="📝"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="投稿文字数 (URL除く)"
            value={stats.kind1Chars}
            unit="文字"
            percentile={percentiles?.kind1Chars}
            icon="✍️"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="投稿画像数"
            value={stats.imageCount}
            unit="枚"
            percentile={percentiles?.imageCount}
            icon="🖼️"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="長文記事 (kind 30023)"
            value={stats.kind30023Count}
            unit="件"
            percentile={percentiles?.kind30023Count}
            icon="📄"
          />
        </Grid>

        {/* Interaction Stats */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatsCard
            title="リポスト (kind 6)"
            value={stats.kind6Count}
            unit="件"
            percentile={percentiles?.kind6Count}
            icon="🔄"
            color="#2196f3"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatsCard
            title="リアクション (kind 7)"
            value={stats.kind7Count}
            unit="件"
            percentile={percentiles?.kind7Count}
            icon="❤️"
            color="#e91e63"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatsCard
            title="チャット (kind 42)"
            value={stats.kind42Count}
            unit="件"
            percentile={percentiles?.kind42Count}
            icon="💬"
            color="#4caf50"
          />
        </Grid>

        {/* Top Post */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TopPost
            eventId={stats.topPostId}
            reactionCount={stats.topPostReactionCount}
            relays={stats.relays}
          />
        </Grid>

        {/* Friends Ranking */}
        <Grid size={{ xs: 12, md: 6 }}>
          <FriendsRanking friends={stats.friendsRanking} relays={stats.relays} />
        </Grid>

        {/* Long article stats */}
        {stats.kind30023Count > 0 && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatsCard
              title="長文記事の総文字数"
              value={stats.kind30023Chars}
              unit="文字"
              icon="📚"
              color="#ff9800"
            />
          </Grid>
        )}
      </Grid>

      {/* Footer with relay info */}
      <Box
        sx={{
          mt: 6,
          pt: 3,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          使用リレー
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', mb: 1 }}>
          {stats.relays.map((relay) => (
            <Chip
              key={relay}
              label={relay.replace('wss://', '')}
              size="small"
              variant="outlined"
              sx={{ 
                fontSize: '0.7rem',
                height: 24,
                borderColor: 'rgba(255,255,255,0.2)',
                color: 'text.secondary',
              }}
            />
          ))}
        </Box>
        {percentileCount > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {percentileCount} 人のユーザーと比較
          </Typography>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
