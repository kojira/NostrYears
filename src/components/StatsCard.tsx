import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { formatPercentile } from '../utils/percentile';

interface StatsCardProps {
  title: string;
  value: number | string;
  unit?: string;
  percentile?: number;
  icon?: React.ReactNode;
  color?: string;
}

export function StatsCard({ title, value, unit, percentile, icon, color }: StatsCardProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  
  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px rgba(156, 39, 176, 0.3)`,
        },
      }}
    >
      {percentile !== undefined && percentile > 0 && (
        <Chip
          label={formatPercentile(percentile)}
          size="small"
          sx={{
            position: 'absolute',
            top: -10,
            right: 16,
            background: percentile <= 10 
              ? 'linear-gradient(45deg, #ff4081, #f50057)'
              : percentile <= 25
              ? 'linear-gradient(45deg, #9c27b0, #ba68c8)'
              : 'linear-gradient(45deg, #7b1fa2, #9c27b0)',
            color: 'white',
            fontWeight: 600,
          }}
        />
      )}
      
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon && (
            <Box sx={{ color: color || 'primary.main', fontSize: 24 }}>
              {icon}
            </Box>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              background: color 
                ? `linear-gradient(45deg, ${color}, ${color}88)`
                : 'linear-gradient(45deg, #9c27b0, #ff4081)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {displayValue}
          </Typography>
          {unit && (
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {unit}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}


