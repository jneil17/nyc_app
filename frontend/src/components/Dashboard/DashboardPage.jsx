import React, { useEffect, useState, useCallback } from 'react';
import NYCMap from './NYCMap';
import { BoroughChart, LocationPieChart, RecentResponsesTable } from './RegistrationCharts';
import EmbeddedDashboard from './EmbeddedDashboard';
import GenieChat from './GenieChat';
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
    <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-navy-900 mb-2">Live Dashboard</h1>
        <p className="text-gray-600 text-sm md:text-base lg:text-lg">
          See who's here and what they're excited about — powered by Databricks
        </p>
        {lastUpdated && (
          <p className="text-xs md:text-sm text-gray-400 mt-2 inline-flex items-center justify-center">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live — updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-5 lg:p-6 text-center">
          <div className="text-lava-400 mb-1"><i className="fas fa-users text-lg md:text-xl lg:text-2xl"></i></div>
          <div className="text-2xl md:text-4xl lg:text-5xl font-bold text-lava-500">{registrations.length}</div>
          <div className="text-xs md:text-sm lg:text-base text-gray-500 mt-0.5"><span className="hidden sm:inline">Total </span>Registered</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-5 lg:p-6 text-center">
          <div className="text-navy-800 mb-1"><i className="fas fa-city text-lg md:text-xl lg:text-2xl"></i></div>
          <div className="text-2xl md:text-4xl lg:text-5xl font-bold text-navy-900">{nycCount}</div>
          <div className="text-xs md:text-sm lg:text-base text-gray-500 mt-0.5">From NYC</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-5 lg:p-6 text-center">
          <div className="text-navy-800 mb-1"><i className="fas fa-map-marker-alt text-lg md:text-xl lg:text-2xl"></i></div>
          <div className="text-2xl md:text-4xl lg:text-5xl font-bold text-navy-800">{boroughCount}</div>
          <div className="text-xs md:text-sm lg:text-base text-gray-500 mt-0.5">Boroughs</div>
        </div>
      </div>

      {/* Map Section */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-bold text-navy-900 mb-4">
          <i className="fas fa-map-marked-alt mr-2 text-lava-500"></i>
          NYC Registration Map
        </h2>
        <NYCMap registrations={registrations} />
      </section>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-navy-900 mb-4">
            <i className="fas fa-chart-bar mr-2 text-lava-500"></i>
            Registrations by Borough
          </h2>
          <BoroughChart registrations={registrations} />
        </section>

        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-navy-900 mb-4">
            <i className="fas fa-chart-pie mr-2 text-lava-500"></i>
            Where Are Attendees From?
          </h2>
          <LocationPieChart registrations={registrations} />
        </section>
      </div>

      {/* Databricks AI/BI Dashboard */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-bold text-navy-900 mb-4">
          <i className="fas fa-database mr-2 text-lava-500"></i>
          Databricks AI/BI Dashboard
        </h2>
        <EmbeddedDashboard />
      </section>

      {/* Ask Genie */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-bold text-navy-900 mb-4">
          <i className="fas fa-hat-wizard mr-2 text-lava-500"></i>
          Ask Genie
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Ask natural language questions about the event data — powered by Databricks Genie
        </p>
        <GenieChat />
      </section>

      {/* Recent Responses */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-navy-900 mb-4">
          <i className="fas fa-comments mr-2 text-lava-500"></i>
          Recent Responses
        </h2>
        <RecentResponsesTable registrations={registrations} />
      </section>

      {/* Databricks Branding + GitHub Link */}
      <div className="mt-8 mb-4 text-center space-y-3">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-oat-medium text-xs md:text-sm text-gray-500 text-center">
          <img
            src="https://cdn.bfldr.com/9AYANS2F/at/9c6z3t9c35wp88vc2t796qq9/primary-lockup-full-color-rgb.svg?format=png&crop=121%2C113%2Cx0%2Cy0&pad=4%2C0%2C9%2C12"
            alt="Databricks"
            className="h-4 mr-2 flex-shrink-0"
          />
          <span>Powered by Databricks LakeBase <span className="hidden sm:inline">&amp; Unity Catalog</span></span>
        </div>
        <div>
          <a
            href="https://github.com/jneil17/nyc_app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs md:text-sm text-gray-400 hover:text-navy-800 transition-colors"
          >
            <i className="fab fa-github mr-1.5 text-base"></i>
            View source on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}

export default DashboardPage;
