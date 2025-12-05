import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  Link,
  Chip,
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from 'nostr-fetch';
import type { TopPostInfo } from '../types/nostr';
import { fetchEventById } from '../services/nostrFetcher';
import { extractImageUrls, extractUrls } from '../utils/textAnalysis';

interface OgData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

interface TopPostsProps {
  topPosts: TopPostInfo[];
  relays: string[];
}

export function TopPosts({ topPosts, relays }: TopPostsProps) {
  const [events, setEvents] = useState<Map<string, NostrEvent>>(new Map());
  const [ogCache, setOgCache] = useState<Map<string, OgData | null>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      if (topPosts.length === 0) {
        setLoading(false);
        return;
      }
      
      const newEvents = new Map<string, NostrEvent>();
      const urls: string[] = [];
      
      for (const post of topPosts) {
        const event = await fetchEventById(post.id, relays);
        if (event) {
          newEvents.set(post.id, event);
          // Extract URLs for OG fetching
          const eventUrls = extractUrls(event.content);
          urls.push(...eventUrls);
        }
      }
      
      setEvents(newEvents);
      setLoading(false);
      
      // Fetch OG data for URLs (best effort, may fail due to CORS)
      fetchOgData(urls);
    };
    
    loadEvents();
  }, [topPosts, relays]);

  const fetchOgData = async (urls: string[]) => {
    const uniqueUrls = [...new Set(urls)].filter(url => !ogCache.has(url));
    
    for (const url of uniqueUrls.slice(0, 5)) { // Limit to 5 URLs
      try {
        // Using a CORS proxy or direct fetch (may fail)
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            setOgCache(prev => new Map(prev).set(url, {
              title: data.data.title,
              description: data.data.description,
              image: data.data.image?.url,
              url,
            }));
          }
        }
      } catch {
        // OG fetch failed, will show simple link instead
        setOgCache(prev => new Map(prev).set(url, null));
      }
    }
  };

  const formatContent = (content: string): string => {
    let text = content;
    // Remove image URLs
    const imageUrls = extractImageUrls(content);
    for (const url of imageUrls) {
      text = text.replace(url, '');
    }
    // Remove other URLs (they'll be shown as cards)
    const otherUrls = extractUrls(content);
    for (const url of otherUrls) {
      text = text.replace(url, '');
    }
    text = text.trim();
    const maxLength = 200;
    if (text.length > maxLength) {
      text = text.slice(0, maxLength) + '...';
    }
    return text;
  };

  const getNostrLink = (id: string): string => {
    try {
      const nevent = nip19.neventEncode({ id });
      return `https://njump.me/${nevent}`;
    } catch {
      return `https://njump.me/${id}`;
    }
  };

  const getRankBadge = (rank: number) => {
    const badges = ['🥇', '🥈', '🥉'];
    return badges[rank] || `#${rank + 1}`;
  };

  if (topPosts.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            🏆 リアクションが多かった投稿 TOP3
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
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          🏆 リアクションが多かった投稿 TOP3
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {topPosts.map((post, index) => {
            const event = events.get(post.id);
            const imageUrls = event ? extractImageUrls(event.content) : [];
            const linkUrls = event ? extractUrls(event.content).filter(url => !imageUrls.includes(url)) : [];

            return (
              <Box
                key={post.id}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: index === 0 
                    ? 'rgba(255, 215, 0, 0.1)' 
                    : 'rgba(156, 39, 176, 0.05)',
                  border: '1px solid',
                  borderColor: index === 0 
                    ? 'rgba(255, 215, 0, 0.3)' 
                    : 'rgba(156, 39, 176, 0.15)',
                }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: '1.5rem' }}>{getRankBadge(index)}</span>
                  </Typography>
                  <Chip
                    label={`❤️ ${post.reactionCount}`}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      backgroundColor: index === 0 
                        ? 'rgba(255, 64, 129, 0.2)' 
                        : 'rgba(156, 39, 176, 0.2)',
                    }}
                  />
                </Box>

                {loading ? (
                  <Box>
                    <Skeleton variant="text" width="100%" />
                    <Skeleton variant="text" width="80%" />
                  </Box>
                ) : event ? (
                  <Box>
                    {/* Content text */}
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'text.primary',
                        mb: 1.5,
                      }}
                    >
                      {formatContent(event.content)}
                    </Typography>

                    {/* Inline images */}
                    {imageUrls.length > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1,
                          mb: 1.5,
                        }}
                      >
                        {imageUrls.slice(0, 2).map((url, imgIndex) => (
                          <Box
                            key={imgIndex}
                            component="a"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: 'block',
                              flex: imageUrls.length === 1 ? '1 1 100%' : '1 1 calc(50% - 4px)',
                              maxWidth: imageUrls.length === 1 ? '100%' : 'calc(50% - 4px)',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              component="img"
                              src={url}
                              alt={`投稿画像 ${imgIndex + 1}`}
                              sx={{
                                width: '100%',
                                height: 'auto',
                                maxHeight: 120,
                                objectFit: 'cover',
                                display: 'block',
                                borderRadius: 1,
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </Box>
                        ))}
                        {imageUrls.length > 2 && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            +{imageUrls.length - 2} 枚
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Link previews */}
                    {linkUrls.slice(0, 2).map((url, linkIndex) => {
                      const og = ogCache.get(url);
                      return (
                        <Box
                          key={linkIndex}
                          component="a"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: 'block',
                            mb: 1,
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textDecoration: 'none',
                            transition: 'background-color 0.2s',
                            '&:hover': {
                              backgroundColor: 'rgba(255,255,255,0.1)',
                            },
                          }}
                        >
                          {og && og.image ? (
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                              <Box
                                component="img"
                                src={og.image}
                                alt=""
                                sx={{
                                  width: 80,
                                  height: 60,
                                  objectFit: 'cover',
                                  borderRadius: 0.5,
                                  flexShrink: 0,
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {og.title || new URL(url).hostname}
                                </Typography>
                                {og.description && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {og.description}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: 'primary.main' }}>
                                🔗
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: 'text.secondary',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {new URL(url).hostname}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      );
                    })}

                    {/* Footer */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {new Date(event.created_at * 1000).toLocaleDateString('ja-JP')}
                      </Typography>
                      <Link
                        href={getNostrLink(post.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: 'secondary.main',
                          textDecoration: 'none',
                          fontSize: '0.75rem',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        詳細 →
                      </Link>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    投稿の取得に失敗しました
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

