import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = {
  lava600: '#FF3621',
  lava500: '#FF5F46',
  lava400: '#FF7A5C',
  navy900: '#0B2026',
  navy800: '#1B3139',
  oat: '#EEEDE9',
};

const PIE_COLORS = [COLORS.lava600, COLORS.lava400, COLORS.navy900];

function BoroughChart({ registrations }) {
  const data = useMemo(() => {
    const counts = {};
    registrations.forEach((r) => {
      if (r.borough) {
        counts[r.borough] = (counts[r.borough] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [registrations]);

  if (data.length === 0) {
    return (
      <div className="bg-oat-medium rounded-lg flex items-center justify-center" style={{ height: 280 }}>
        <p className="text-gray-400 text-sm">No borough data yet — registrations will appear here</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <XAxis dataKey="name" tick={{ fill: '#1B3139', fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: '#999', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontFamily: 'DM Sans' }}
        />
        <Bar dataKey="count" name="Registrations" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? COLORS.lava600 : COLORS.lava400} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LocationPieChart({ registrations }) {
  const data = useMemo(() => {
    const counts = { NYC: 0, 'NY State': 0, 'Other State': 0 };
    registrations.forEach((r) => {
      if (r.location_type === 'nyc') counts['NYC']++;
      else if (r.location_type === 'ny_state') counts['NY State']++;
      else counts['Other State']++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [registrations]);

  if (data.length === 0) {
    return (
      <div className="bg-oat-medium rounded-lg flex items-center justify-center" style={{ height: 280 }}>
        <p className="text-gray-400 text-sm">No data yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend
          wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RecentResponsesTable({ registrations }) {
  const recent = useMemo(() => {
    return [...registrations]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);
  }, [registrations]);

  if (recent.length === 0) {
    return (
      <div className="bg-oat-medium rounded-lg flex items-center justify-center" style={{ height: 200 }}>
        <p className="text-gray-400 text-sm">No responses yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-72">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 px-3 text-navy-800 font-semibold">Location</th>
            <th className="py-2 px-3 text-navy-800 font-semibold">What Brought You Here?</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r, i) => (
            <tr key={r.user_id || i} className="border-b border-gray-100 hover:bg-oat-light">
              <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                {r.borough || r.state || 'Unknown'}
              </td>
              <td className="py-2 px-3 text-gray-700">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { BoroughChart, LocationPieChart, RecentResponsesTable };
