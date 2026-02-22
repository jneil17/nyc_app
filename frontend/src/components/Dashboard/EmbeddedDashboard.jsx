import React, { useEffect, useRef, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || '';

function EmbeddedDashboard() {
  const containerRef = useRef(null);
  const dashboardRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initDashboard() {
      if (!containerRef.current || dashboardRef.current) return;

      try {
        // Fetch embed token from our backend
        const res = await fetch(`${API_URL}/dashboard-token`);
        if (!res.ok) {
          throw new Error('Could not fetch dashboard token');
        }
        const { token } = await res.json();

        if (cancelled) return;

        const { DatabricksDashboard } = await import('@databricks/aibi-client');

        const dashboard = new DatabricksDashboard({
          instanceUrl: 'https://dbc-eca83c32-b44b.cloud.databricks.com',
          workspaceId: '3590757798436003',
          dashboardId: '01f1103d19bc175083fbb5392f987e10',
          token,
          container: containerRef.current,
        });

        dashboardRef.current = dashboard;
        dashboard.initialize();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Dashboard embed error:', err);
          setError(err.message);
          setLoading(false);
        }
      }
    }

    if (API_URL) {
      initDashboard();
    } else {
      setError('API not configured');
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-oat-medium rounded-lg flex items-center justify-center" style={{ height: 400 }}>
        <div className="text-center text-gray-400">
          <i className="fas fa-chart-pie text-5xl mb-3 block"></i>
          <p className="font-medium">Databricks AI/BI Dashboard</p>
          <p className="text-sm mt-1">Embed will appear once the backend token endpoint is configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ minHeight: 400 }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-oat-light rounded-lg">
          <div className="text-center text-gray-400">
            <i className="fas fa-spinner fa-spin text-3xl mb-2 block text-lava-500"></i>
            <p className="text-sm">Loading Databricks Dashboard...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full rounded-lg" style={{ minHeight: 400 }} />
    </div>
  );
}

export default EmbeddedDashboard;
