import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Skeleton,
  Button,
  Chip,
  Link,
  Tooltip,
} from '@mui/material';
import { nip19 } from 'nostr-tools';
import { fetchRecentNostrYearsEvents } from '../services/nostrPublisher';
import type { RecentNostrYearsResult } from '../services/nostrPublisher';
import { fetchProfiles } from '../services/nostrFetcher';
import type { NostrProfile, NostrYearsEventContent } from '../types/nostr';
import { NOSTR_YEARS_VERSION } from '../types/nostr';

interface RecentResultsProps {
  relays: string[];
  onSelectUser?: (pubkey: string) => void;
  onLoadCachedResult: (pubkey: string, content: NostrYearsEventContent, profile: NostrProfile | null) => void;
}

export function RecentResults({ relays, onLoadCachedResult }: RecentResultsProps) {
  const [results, setResults] = useState<RecentNostrYearsResult[]>([]);
  const [profiles, setProfiles] = useState<Map<string, NostrProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      const fetchedResults = await fetchRecentNostrYearsEvents(relays, 20);
      setResults(fetchedResults);
      
      if (fetchedResults.length > 0) {
        const pubkeys = fetchedResults.map(r => r.pubkey);
        const fetchedProfiles = await fetchProfiles(pubkeys, relays);
        setProfiles(fetchedProfiles);
      }
      
      setLoading(false);
    };
    
    loadResults();
  }, [relays]);

  const getDisplayName = (pubkey: string): string => {
    const profile = profiles.get(pubkey);
    if (profile?.display_name) return profile.display_name;
    if (profile?.name) return profile.name;
    
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}...`;
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

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  const displayResults = expanded ? results : results.slice(0, 6);

  if (loading) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
          📊 Recent Results
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[1, 2, 3].map(i => (
            <Skeleton
              key={i}
              variant="rounded"
              width={180}
              height={100}
              sx={{ borderRadius: 2 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
        📊 Recent Results
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {displayResults.map((result) => (
          <Card
            key={result.pubkey}
            sx={{
              width: 180,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 24px rgba(156, 39, 176, 0.3)',
              },
            }}
            onClick={() => onLoadCachedResult(result.pubkey, result.content, profiles.get(result.pubkey) || null)}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Link
                  href={getProfileLink(result.pubkey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar
                    src={profiles.get(result.pubkey)?.picture}
                    sx={{ width: 32, height: 32 }}
                  >
                    {getDisplayName(result.pubkey).charAt(0).toUpperCase()}
                  </Avatar>
                </Link>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {getDisplayName(result.pubkey)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatDate(result.createdAt)}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Chip
                  label={`📝 ${result.content.kind1Count.toLocaleString()}`}
                  size="small"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
                <Chip
                  label={`❤️ ${result.content.kind7Count.toLocaleString()}`}
                  size="small"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
                {result.content.version !== NOSTR_YEARS_VERSION && (
                  <Tooltip title={`Version ${result.content.version} (current: ${NOSTR_YEARS_VERSION})`}>
                    <Chip
                      label={`v${result.content.version}`}
                      size="small"
                      sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'warning.dark' }}
                    />
                  </Tooltip>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
      
      {results.length > 6 && (
        <Button
          variant="text"
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ mt: 2, color: 'text.secondary' }}
        >
          {expanded ? '▲ Show Less' : `▼ Show More (${results.length - 6} more)`}
        </Button>
      )}
    </Box>
  );
}

