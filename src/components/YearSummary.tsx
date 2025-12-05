import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Alert,
  Snackbar,
  Avatar,
  Chip,
  Card,
  CardContent,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { nip19 } from 'nostr-tools';
import { StatsCard } from './StatsCard';
import { FriendsRanking } from './FriendsRanking';
import { TopPosts } from './TopPosts';
import type { NostrYearsStats, PercentileData } from '../types/nostr';
import { hasNip07, publishNostrYearsStats, fetchAllNostrYearsEvents, createEventContent } from '../services/nostrPublisher';
import { calculateAllPercentiles } from '../utils/percentile';

interface YearSummaryProps {
  stats: NostrYearsStats;
  onReset: () => void;
  isFromCache?: boolean;
  onRefresh?: () => void;
}

export function YearSummary({ stats, onReset, isFromCache, onRefresh }: YearSummaryProps) {
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
        message: 'Posted to relays!',
        severity: 'success',
      });
      
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
        message: 'Failed to post to relays',
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

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const periodString = `${formatDate(stats.period.since)} - ${formatDate(stats.period.until)}`;

  // Generate summary text for sharing
  const summaryText = useMemo(() => {
    const lines = [
      `📊 My #NostrYears Summary`,
      `📅 Period: ${periodString}`,
      ``,
      `📝 Posts: ${stats.kind1Count.toLocaleString()}`,
      `✍️ Characters: ${stats.kind1Chars.toLocaleString()}`,
      `🖼️ Images: ${stats.imageCount.toLocaleString()}`,
      `📄 Long-form articles: ${stats.kind30023Count.toLocaleString()}`,
      `🔄 Reposts: ${stats.kind6Count.toLocaleString()}`,
      `❤️ Reactions: ${stats.kind7Count.toLocaleString()}`,
      `💬 Chat messages: ${stats.kind42Count.toLocaleString()}`,
    ];

    if (stats.topReactionEmojis.length > 0) {
      lines.push(``, `Top reactions: ${stats.topReactionEmojis.map(e => `${e.emoji}(${e.count})`).join(' ')}`);
    }

    lines.push(``, `#nostryears`);

    return lines.join('\n');
  }, [stats, periodString]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setSnackbar({
        open: true,
        message: 'Copied to clipboard!',
        severity: 'success',
      });
    } catch {
      setSnackbar({
        open: true,
        message: 'Failed to copy',
        severity: 'error',
      });
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
          ← Search another user
        </Button>
      </Box>

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h1" sx={{ mb: 3 }}>
          NostrYears
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
            Nostr Activity Summary
          </Typography>
          <Chip
            label={periodString}
            size="small"
            sx={{ 
              mt: 0.5,
              backgroundColor: 'rgba(156, 39, 176, 0.2)',
            }}
          />
          
          {/* Cache indicator */}
          {isFromCache && (
            <Chip
              label="📦 Showing cached data"
              size="small"
              sx={{ 
                mt: 1,
                backgroundColor: 'rgba(33, 150, 243, 0.2)', 
                color: '#2196f3',
              }}
            />
          )}
          
          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {isFromCache && onRefresh && (
              <Button
                variant="outlined"
                size="small"
                onClick={onRefresh}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'text.secondary',
                }}
              >
                🔄 Re-analyze
              </Button>
            )}
            
            {hasNip07() && !published && !isFromCache && (
              <Button
                variant="contained"
                size="small"
                onClick={handlePublish}
                disabled={publishing}
                sx={{
                  background: 'linear-gradient(45deg, #9c27b0, #ff4081)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #7b1fa2, #c60055)',
                  },
                }}
              >
                {publishing ? 'Posting...' : '📤 Post to Relays'}
              </Button>
            )}
            
            {(published || isFromCache) && (
              <Chip
                label="✓ Posted"
                size="small"
                sx={{ backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' }}
              />
            )}
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Kind 1 Stats */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Posts (kind 1)"
            value={stats.kind1Count}
            unit=""
            percentile={percentiles?.kind1Count}
            icon="📝"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Characters (excl. URLs)"
            value={stats.kind1Chars}
            unit=""
            percentile={percentiles?.kind1Chars}
            icon="✍️"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Images Posted"
            value={stats.imageCount}
            unit=""
            percentile={percentiles?.imageCount}
            icon="🖼️"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Long-form (kind 30023)"
            value={stats.kind30023Count}
            unit=""
            percentile={percentiles?.kind30023Count}
            icon="📄"
          />
        </Grid>

        {/* Interaction Stats */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatsCard
            title="Reposts (kind 6)"
            value={stats.kind6Count}
            unit=""
            percentile={percentiles?.kind6Count}
            icon="🔄"
            color="#2196f3"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatsCard
            title="Reactions (kind 7)"
            value={stats.kind7Count}
            unit=""
            percentile={percentiles?.kind7Count}
            icon="❤️"
            color="#e91e63"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatsCard
            title="Chat (kind 42)"
            value={stats.kind42Count}
            unit=""
            percentile={percentiles?.kind42Count}
            icon="💬"
            color="#4caf50"
          />
        </Grid>

        {/* Top Reaction Emojis */}
        {stats.topReactionEmojis.length > 0 && (
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                  😊 Top Reactions
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {stats.topReactionEmojis.map((item, index) => {
                    const badges = ['🥇', '🥈', '🥉'];
                    const rankDisplay = index < 3 ? badges[index] : `#${index + 1}`;
                    
                    return (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          backgroundColor: index === 0 
                            ? 'rgba(255, 215, 0, 0.1)' 
                            : 'rgba(156, 39, 176, 0.05)',
                          border: '1px solid',
                          borderColor: index === 0 
                            ? 'rgba(255, 215, 0, 0.3)' 
                            : 'rgba(156, 39, 176, 0.1)',
                          minWidth: index < 3 ? 140 : 120,
                        }}
                      >
                        <Typography sx={{ fontSize: index < 3 ? '1.2rem' : '0.9rem', minWidth: 24 }}>
                          {rankDisplay}
                        </Typography>
                        <Typography sx={{ fontSize: index < 3 ? '1.5rem' : '1.2rem' }}>
                          {item.emoji}
                        </Typography>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            fontSize: index < 3 ? '0.9rem' : '0.8rem',
                            color: 'text.secondary',
                          }}
                        >
                          {item.count.toLocaleString()}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Top Posts */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TopPosts
            topPosts={stats.topPosts}
            relays={stats.relays}
          />
        </Grid>

        {/* Friends Ranking - only show if not from cache */}
        {!isFromCache && (
          <Grid size={{ xs: 12, md: 6 }}>
            <FriendsRanking friends={stats.friendsRanking} relays={stats.relays} />
          </Grid>
        )}

        {/* Long article stats */}
        {stats.kind30023Count > 0 && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatsCard
              title="Long-form Characters"
              value={stats.kind30023Chars}
              unit=""
              icon="📚"
              color="#ff9800"
            />
          </Grid>
        )}

        {/* Share Text Box */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  📋 Share Your Results
                </Typography>
                <Tooltip title="Copy to clipboard">
                  <IconButton
                    onClick={handleCopy}
                    sx={{
                      color: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'rgba(156, 39, 176, 0.1)',
                      },
                    }}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={summaryText}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>
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
          Relays Used
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
            Compared with {percentileCount} users
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
