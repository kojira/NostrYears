import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Chip,
  Typography,
  Collapse,
  Paper,
} from '@mui/material';
import { DEFAULT_RELAYS } from '../services/nostrFetcher';

interface RelaySettingsProps {
  relays: string[];
  onRelaysChange: (relays: string[]) => void;
  disabled?: boolean;
}

export function RelaySettings({ relays, onRelaysChange, disabled }: RelaySettingsProps) {
  const [newRelay, setNewRelay] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddRelay = () => {
    setError(null);
    
    let url = newRelay.trim();
    if (!url) return;
    
    // Add wss:// prefix if missing
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = 'wss://' + url;
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      setError('Invalid URL');
      return;
    }
    
    // Check for duplicates
    if (relays.includes(url)) {
      setError('This relay is already added');
      return;
    }
    
    onRelaysChange([...relays, url]);
    setNewRelay('');
  };

  const handleRemoveRelay = (relay: string) => {
    onRelaysChange(relays.filter(r => r !== relay));
  };

  const handleResetToDefault = () => {
    onRelaysChange([...DEFAULT_RELAYS]);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Button
        variant="text"
        size="small"
        onClick={() => setExpanded(!expanded)}
        sx={{ color: 'text.secondary', mb: 1 }}
      >
        ⚙️ Relay Settings {expanded ? '▲' : '▼'}
      </Button>
      
      <Collapse in={expanded}>
        <Paper
          sx={{
            p: 2,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Configure the relays to use. Percentile comparison is only available with users using the same relays.
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {relays.map((relay) => (
              <Chip
                key={relay}
                label={relay.replace('wss://', '')}
                onDelete={disabled ? undefined : () => handleRemoveRelay(relay)}
                sx={{
                  backgroundColor: DEFAULT_RELAYS.includes(relay)
                    ? 'rgba(156, 39, 176, 0.3)'
                    : 'rgba(255, 255, 255, 0.1)',
                }}
              />
            ))}
            {relays.length === 0 && (
              <Typography variant="body2" sx={{ color: 'error.main' }}>
                No relays selected
              </Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              placeholder="wss://relay.example.com"
              value={newRelay}
              onChange={(e) => setNewRelay(e.target.value)}
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddRelay();
                }
              }}
              sx={{ flex: 1 }}
              error={!!error}
              helperText={error}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddRelay}
              disabled={disabled || !newRelay.trim()}
            >
              Add
            </Button>
          </Box>
          
          <Button
            variant="text"
            size="small"
            onClick={handleResetToDefault}
            disabled={disabled}
            sx={{ color: 'text.secondary' }}
          >
            Reset to Default
          </Button>
        </Paper>
      </Collapse>
    </Box>
  );
}
