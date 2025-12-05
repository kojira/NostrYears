import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
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
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    const loadPercentiles = async () => {
      const allStats = await fetchAllNostrYearsEvents();
      if (allStats.length > 0) {
        const myContent = createEventContent(stats);
        const calculated = calculateAllPercentiles(myContent, allStats);
        setPercentiles(calculated);
      }
    };
    
    loadPercentiles();
  }, [stats]);

  const handlePublish = async () => {
    setPublishing(true);
    const success = await publishNostrYearsStats(stats);
    setPublishing(false);
    
    if (success) {
      setPublished(true);
      setSnackbar({
        open: true,
        message: '結果をリレーに投稿しました！',
        severity: 'success',
      });
      
      // Reload percentiles after publishing
      const allStats = await fetchAllNostrYearsEvents();
      if (allStats.length > 0) {
        const myContent = createEventContent(stats);
        const calculated = calculateAllPercentiles(myContent, allStats);
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

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          NostrYears 2025
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 3 }}>
          あなたの2025年のNostr活動まとめ
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={onReset}
            sx={{
              borderColor: 'rgba(255,255,255,0.3)',
              color: 'text.secondary',
            }}
          >
            別のユーザーを検索
          </Button>
          
          {hasNip07() && !published && (
            <Button
              variant="contained"
              onClick={handlePublish}
              disabled={publishing}
              sx={{
                background: 'linear-gradient(45deg, #9c27b0, #ff4081)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #7b1fa2, #c60055)',
                },
              }}
            >
              {publishing ? '投稿中...' : '結果をリレーに投稿'}
            </Button>
          )}
          
          {published && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              投稿済み
            </Alert>
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
          />
        </Grid>

        {/* Friends Ranking */}
        <Grid size={{ xs: 12, md: 6 }}>
          <FriendsRanking friends={stats.friendsRanking} />
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

