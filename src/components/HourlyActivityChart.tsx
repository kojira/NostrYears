import { Card, CardContent, Typography, Box, useTheme } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { HourlyActivity } from '../types/nostr';

interface HourlyActivityChartProps {
  data: HourlyActivity[];
}

export function HourlyActivityChart({ data }: HourlyActivityChartProps) {
  const theme = useTheme();

  // Find max count for color intensity
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Get color based on count intensity
  const getBarColor = (count: number) => {
    const intensity = count / maxCount;
    // Gradient from light purple to deep purple
    const r = Math.round(138 + (156 - 138) * (1 - intensity));
    const g = Math.round(43 + (39 - 43) * (1 - intensity));
    const b = Math.round(226 + (176 - 226) * (1 - intensity));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Format hour label
  const formatHour = (hour: number) => {
    return `${hour}:00`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: HourlyActivity }> }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5,
            boxShadow: 2,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatHour(data.hour)} - {formatHour((data.hour + 1) % 24)} JST
          </Typography>
          <Typography variant="body2" sx={{ color: 'primary.main' }}>
            {data.count.toLocaleString()} posts
          </Typography>
        </Box>
      );
    }
    return null;
  };

  // Check if there's any data
  const hasData = data.some(d => d.count > 0);

  if (!hasData) {
    return null;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          🕐 Activity by Hour (JST)
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          When do you post the most?
        </Typography>

        <Box sx={{ width: '100%', height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                ticks={[0, 6, 12, 18, 23]}
                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                axisLine={{ stroke: theme.palette.divider }}
              />
              <YAxis
                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                axisLine={{ stroke: theme.palette.divider }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.count)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        {/* Time period labels */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            🌙 Night
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            🌅 Morning
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ☀️ Afternoon
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            🌆 Evening
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

