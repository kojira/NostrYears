import { useState } from 'react';
import { Card, CardContent, Typography, Box, useTheme } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyActivity } from '../types/nostr';

interface MonthlyActivityChartProps {
  data: MonthlyActivity[];
}

export function MonthlyActivityChart({ data }: MonthlyActivityChartProps) {
  const theme = useTheme();
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  if (data.length === 0) {
    return null;
  }

  // Format month for display (YYYY-MM -> MMM)
  const formatMonth = (month: string): string => {
    const [year, m] = month.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(m, 10) - 1;
    return `${monthNames[monthIndex]} ${year.slice(2)}`;
  };

  const chartData = data.map(item => ({
    ...item,
    monthLabel: formatMonth(item.month),
  }));

  const lineConfig = [
    { dataKey: 'kind1', name: 'Posts', color: '#8884d8' },
    { dataKey: 'kind7', name: 'Reactions Sent', color: '#ff7300' },
    { dataKey: 'receivedReactions', name: 'Reactions Received', color: '#e91e63' },
    { dataKey: 'kind6', name: 'Reposts', color: '#82ca9d' },
    { dataKey: 'kind42', name: 'Chat', color: '#ffc658' },
    { dataKey: 'kind30023', name: 'Articles', color: '#ff6b6b' },
    { dataKey: 'zapsSent', name: 'Zaps Sent', color: '#f9a825' },
    { dataKey: 'zapsReceived', name: 'Zaps Received', color: '#ffeb3b' },
  ];

  // Filter lines that have at least one non-zero value
  const activeLines = lineConfig.filter(config => 
    data.some(item => {
      const value = item[config.dataKey as keyof MonthlyActivity];
      return typeof value === 'number' && value > 0;
    })
  );

  // Handle legend click to toggle line visibility
  const handleLegendClick = (dataKey: string) => {
    setHiddenLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  };

  // Custom legend with click handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 1 }}>
        {payload.map((entry: { dataKey: string; value: string; color: string }) => (
          <Box
            key={entry.dataKey}
            onClick={() => handleLegendClick(entry.dataKey)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              opacity: hiddenLines.has(entry.dataKey) ? 0.3 : 1,
              transition: 'opacity 0.2s',
              padding: '2px 8px',
              borderRadius: 1,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: entry.color,
              }}
            />
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {entry.value}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          📈 Monthly Activity
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          Click legend to show/hide lines
        </Typography>
        
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme.palette.divider}
              />
              <XAxis 
                dataKey="monthLabel" 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <YAxis 
                stroke={theme.palette.text.secondary}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                }}
                labelStyle={{ color: theme.palette.text.primary }}
              />
              <Legend content={renderLegend} />
              {activeLines.map(config => (
                <Line
                  key={config.dataKey}
                  type="monotone"
                  dataKey={config.dataKey}
                  name={config.name}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  hide={hiddenLines.has(config.dataKey)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
