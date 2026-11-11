import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SectionCard, EmptyState } from './common';
import { formatNumber } from '../utils/format';

const TYPES = [
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
  { value: 'verticalBar', label: 'Vertical bar' },
  { value: 'horizontalBar', label: 'Horizontal bar' },
  { value: 'line', label: 'Line' },
];
const COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

function colorAt(index) {
  return `var(${COLORS[index % COLORS.length]})`;
}

function readChartType(key, fallback) {
  try {
    const value = sessionStorage.getItem(`ims-chart-${key}`);
    return TYPES.some((type) => type.value === value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-title">{label}</div>}
      {payload.map((entry, index) => (
        <div className="chart-tooltip-row" key={`${entry.dataKey || entry.name}-${index}`}>
          <span className="chart-tooltip-swatch" style={{ background: entry.color || entry.payload?.fill || colorAt(index) }} />
          <span>{entry.name || entry.payload?.name || 'Value'}</span>
          <strong>{formatNumber(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload = [] }) {
  return (
    <div className="chart-legend">
      {payload.map((entry, index) => (
        <span className="chart-legend-item" key={entry.value}>
          <span className="legend-dot" style={{ background: entry.color || colorAt(index) }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({
  id,
  title,
  description,
  icon,
  data = [],
  xKey = 'name',
  series = [],
  pieMode = 'rows',
  initialType = 'verticalBar',
  valueFormatter,
}) {
  const [type, setType] = useState(() => readChartType(id, initialType));
  const chartData = useMemo(() => {
    if (type !== 'pie' && type !== 'donut') return data;
    if (pieMode === 'series') {
      return series.map((entry) => ({
        name: entry.name,
        value: data.reduce((sum, row) => sum + (Number(row[entry.key]) || 0), 0),
      })).filter((entry) => entry.value > 0);
    }
    return data.map((row) => ({
      name: String(row[xKey] ?? 'Unlabelled'),
      value: series.reduce((sum, entry) => sum + (Number(row[entry.key]) || 0), 0),
    })).filter((entry) => entry.value > 0);
  }, [data, pieMode, series, type, xKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`ims-chart-${id}`, type);
    } catch {
      // Chart choice remains in component state for this page session.
    }
  }, [id, type]);

  const axes = {
    stroke: 'var(--chart-grid)',
    tick: { fill: 'var(--muted)', fontSize: 11 },
  };
  const tooltip = <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />;
  const legend = <Legend content={<CustomLegend />} />;
  const hasData = type === 'pie' || type === 'donut' ? chartData.length > 0 : data.length > 0;

  return (
    <SectionCard
      className="chart-card"
      title={title}
      description={description}
      icon={icon}
      actions={
        <label className="chart-type-control">
          <span className="sr-only">Chart type for {title}</span>
          <select className="select chart-type-select" value={type} onChange={(event) => setType(event.target.value)} aria-label={`Chart type for ${title}`}>
            {TYPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
      }
    >
      {!hasData ? (
        <EmptyState title="No chart data yet" description="Chart data will appear as inventory transactions are recorded." />
      ) : (
        <div className="chart-box chart-box-card">
          <ResponsiveContainer width="100%" height="100%">
            {(type === 'pie' || type === 'donut') ? (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={type === 'donut' ? 54 : 0}
                  outerRadius={82}
                  paddingAngle={type === 'donut' ? 3 : 1}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => <Cell key={entry.name} fill={colorAt(index)} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            ) : type === 'line' ? (
              <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={axes.stroke} />
                <XAxis dataKey={xKey} tick={axes.tick} axisLine={{ stroke: axes.stroke }} tickLine={{ stroke: axes.stroke }} />
                <YAxis tick={axes.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                {tooltip}
                {legend}
                {series.map((entry, index) => (
                  <Line key={entry.key} type="monotone" dataKey={entry.key} name={entry.name} stroke={colorAt(index)} strokeWidth={2.5} dot={{ r: 3, fill: colorAt(index), strokeWidth: 0 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            ) : type === 'horizontalBar' ? (
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={axes.stroke} />
                <XAxis type="number" tick={axes.tick} axisLine={{ stroke: axes.stroke }} tickLine={{ stroke: axes.stroke }} allowDecimals={false} />
                <YAxis type="category" dataKey={xKey} width={105} tick={axes.tick} axisLine={false} tickLine={false} />
                {tooltip}
                {legend}
                {series.map((entry, index) => <Bar key={entry.key} dataKey={entry.key} name={entry.name} fill={colorAt(index)} radius={[0, 4, 4, 0]} maxBarSize={22} />)}
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={axes.stroke} />
                <XAxis dataKey={xKey} tick={axes.tick} axisLine={{ stroke: axes.stroke }} tickLine={{ stroke: axes.stroke }} />
                <YAxis tick={axes.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                {tooltip}
                {legend}
                {series.map((entry, index) => <Bar key={entry.key} dataKey={entry.key} name={entry.name} fill={colorAt(index)} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {valueFormatter && hasData && <p className="chart-footnote">{valueFormatter}</p>}
    </SectionCard>
  );
}
