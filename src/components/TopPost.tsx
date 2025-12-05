import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  Link,
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from 'nostr-fetch';
import { fetchEventById } from '../services/nostrFetcher';

interface TopPostProps {
  eventId: string | null;
  reactionCount: number;
}

export function TopPost({ eventId, reactionCount }: TopPostProps) {
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }
      
      const fetchedEvent = await fetchEventById(eventId);
      setEvent(fetchedEvent);
      setLoading(false);
    };
    
    loadEvent();
  }, [eventId]);

  const formatContent = (content: string, maxLength: number = 280): string => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const getNostrLink = (id: string): string => {
    try {
      const nevent = nip19.neventEncode({ id });
      return `https://njump.me/${nevent}`;
    } catch {
      return `https://njump.me/${id}`;
    }
  };

  if (!eventId) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            🏆 一番リアクションが多かった投稿
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            データがありません
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            🏆 一番リアクションが多かった投稿
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #ff4081, #f50057)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {reactionCount}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              リアクション
            </Typography>
          </Box>
        </Box>
        
        {loading ? (
          <Box>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        ) : event ? (
          <Box>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                border: '1px solid rgba(156, 39, 176, 0.2)',
                mb: 2,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {formatContent(event.content)}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {new Date(event.created_at * 1000).toLocaleString('ja-JP')}
              </Typography>
              
              <Link
                href={getNostrLink(eventId)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'secondary.main',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                詳細を見る →
              </Link>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            投稿の取得に失敗しました
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

