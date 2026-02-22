import React, { useEffect, useState, useCallback } from 'react';
import NYCMap from './NYCMap';
import { BoroughChart, LocationPieChart, RecentResponsesTable } from './RegistrationCharts';
import EmbeddedDashboard from './EmbeddedDashboard';
import { getRegistrations } from '../../services/api';

const POLL_INTERVAL = 10000; // 10 seconds

function DashboardPage() {
  const [registrations, setRegistrations] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getRegistrations();
      setRegistrations(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch registrations:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const nycCount = registrations.filter((r) => r.location_type === 'nyc').length;
  const boroughCount = new Set(registrations.filter((r) => r.borough).map((r) => r.borough)).size;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Live Dashboard</h1>
        <p className="text-gray-600">
          See who's here and what they're excited about — powered by Databricks
        </p>
        {lastUpdated && (
          <p className="text-xs text-gray-400 mt-1">
            <i className="fas fa-sync-alt mr-1"></i>
            Auto-refreshing every 10s — Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-lava-500">{registrations.length}</div>
          <div className="text-sm text-gray-500">Total Registered</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-navy-900">{nycCount}</div>
          <div className="text-sm text-gray-500">From NYC</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-navy-800">{boroughCount}</div>
          <div className="text-sm text-gray-500">Boroughs Represented</div>
        </div>
      </div>

      {/* Map Section */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-navy-900 mb-4">
          <i className="fas fa-map-marked-alt mr-2 text-lava-500"></i>
          NYC Registration Map
        </h2>
        <NYCMap registrations={registrations} />
      </section>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-navy-900 mb-4">
            <i className="fas fa-chart-bar mr-2 text-lava-500"></i>
            Registrations by Borough
          </h2>
          <BoroughChart registrations={registrations} />
        </section>

        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-navy-900 mb-4">
            <i className="fas fa-chart-pie mr-2 text-lava-500"></i>
            Where Are Attendees From?
          </h2>
          <LocationPieChart registrations={registrations} />
        </section>
      </div>

      {/* Databricks AI/BI Dashboard */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-navy-900 mb-4">
          <i className="fas fa-database mr-2 text-lava-500"></i>
          Databricks AI/BI Dashboard
        </h2>
        <EmbeddedDashboard />
      </section>

      {/* Recent Responses */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-navy-900 mb-4">
          <i className="fas fa-comments mr-2 text-lava-500"></i>
          Recent Responses
        </h2>
        <RecentResponsesTable registrations={registrations} />
      </section>

      {/* Databricks Branding */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          <i className="fas fa-database mr-1"></i>
          Data stored in Databricks LakeBase — Analytics powered by Unity Catalog
        </p>
      </div>
    </main>
  );
}

export default DashboardPage;
