import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Skeleton,
  LinearProgress,
  Link,
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import type { FriendScore, NostrProfile } from '../types/nostr';
import { fetchProfiles } from '../services/nostrFetcher';

interface FriendsRankingProps {
  friends: FriendScore[];
  relays: string[];
}

export function FriendsRanking({ friends, relays }: FriendsRankingProps) {
  const [profiles, setProfiles] = useState<Map<string, NostrProfile>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfiles = async () => {
      if (friends.length === 0) {
        setLoading(false);
        return;
      }
      
      const pubkeys = friends.map(f => f.pubkey);
      const fetchedProfiles = await fetchProfiles(pubkeys, relays);
      setProfiles(fetchedProfiles);
      setLoading(false);
    };
    
    loadProfiles();
  }, [friends, relays]);

  const getDisplayName = (pubkey: string): string => {
    const profile = profiles.get(pubkey);
    if (profile?.display_name) return profile.display_name;
    if (profile?.name) return profile.name;
    
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
    } catch {
      return `${pubkey.slice(0, 8)}...`;
    }
  };

  const getProfileLink = (pubkey: string): string => {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `https://njump.me/${npub}`;
    } catch {
      return `https://njump.me/${pubkey}`;
    }
  };

  const getRankBadge = (rank: number) => {
    const badges = ['🥇', '🥈', '🥉'];
    if (rank < 3) {
      return (
        <Typography
          component="span"
          sx={{ fontSize: 24, mr: 1 }}
        >
          {badges[rank]}
        </Typography>
      );
    }
    return (
      <Chip
        label={`#${rank + 1}`}
        size="small"
        sx={{
          mr: 1,
          minWidth: 40,
          backgroundColor: 'rgba(156, 39, 176, 0.2)',
        }}
      />
    );
  };

  const getBalanceLabel = (balance: number): string => {
    if (balance >= 0.9) return 'Best';
    if (balance >= 0.7) return 'Good';
    if (balance >= 0.5) return 'OK';
    return 'One-way';
  };

  const getBalanceColor = (balance: number): string => {
    if (balance >= 0.9) return '#4caf50';
    if (balance >= 0.7) return '#8bc34a';
    if (balance >= 0.5) return '#ff9800';
    return '#f44336';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          🤝 Friends Ranking TOP10
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          People you reacted to (balanced = mutual friendship)
        </Typography>
        
        {friends.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No data available
          </Typography>
        ) : (
          <List sx={{ p: 0 }}>
            {friends.map((friend, index) => (
              <ListItem
                key={friend.pubkey}
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: index < friends.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  {getRankBadge(index)}
                </Box>
                
                <ListItemAvatar>
                  {loading ? (
                    <Skeleton variant="circular" width={40} height={40} />
                  ) : (
                    <Link
                      href={getProfileLink(friend.pubkey)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Avatar
                        src={profiles.get(friend.pubkey)?.picture}
                        sx={{
                          bgcolor: 'primary.main',
                          border: '2px solid',
                          borderColor: index < 3 ? 'secondary.main' : 'transparent',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          },
                        }}
                      >
                        {getDisplayName(friend.pubkey).charAt(0).toUpperCase()}
                      </Avatar>
                    </Link>
                  )}
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    loading ? (
                      <Skeleton width={120} />
                    ) : (
                      <Link
                        href={getProfileLink(friend.pubkey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: 'text.primary',
                          textDecoration: 'none',
                          '&:hover': {
                            color: 'secondary.main',
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {getDisplayName(friend.pubkey)}
                        </Typography>
                      </Link>
                    )
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          → {friend.outgoingReactions}❤️ {friend.outgoingReplies}💬
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ← {friend.incomingReactions}❤️ {friend.incomingReplies}💬
                        </Typography>
                      </Box>
                      {/* Balance indicator */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={friend.balanceScore * 100}
                          sx={{
                            width: 60,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: getBalanceColor(friend.balanceScore),
                              borderRadius: 2,
                            },
                          }}
                        />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: getBalanceColor(friend.balanceScore),
                            fontSize: '0.65rem',
                          }}
                        >
                          {getBalanceLabel(friend.balanceScore)}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                
                <Box sx={{ textAlign: 'right', minWidth: 50 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #9c27b0, #ff4081)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {friend.outgoingReactions}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    sent ❤️
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
