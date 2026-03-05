import React from 'react';
import { Link } from '@tanstack/react-router';

function Header() {
  return (
    <header className="bg-white shadow-sm border-b-2 border-lava-500">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 md:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="no-underline flex items-center">
              <img
                src="https://cdn.bfldr.com/9AYANS2F/at/9c6z3t9c35wp88vc2t796qq9/primary-lockup-full-color-rgb.svg?format=png&crop=121%2C113%2Cx0%2Cy0&pad=4%2C0%2C9%2C12"
                alt="Databricks"
                className="h-7 md:h-9"
              />
            </Link>
          </div>
          <nav className="flex items-center space-x-1">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors no-underline"
              activeProps={{ className: 'px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors no-underline bg-lava-500 text-white' }}
              inactiveProps={{ className: 'px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors no-underline text-navy-800 hover:bg-oat-medium' }}
            >
              <i className="fas fa-user-plus mr-1.5 md:mr-2"></i>
              <span>Register</span>
            </Link>
            <Link
              to="/dashboard"
              className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors no-underline"
              activeProps={{ className: 'px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors no-underline bg-lava-500 text-white' }}
              inactiveProps={{ className: 'px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors no-underline text-navy-800 hover:bg-oat-medium' }}
            >
              <i className="fas fa-chart-bar mr-1.5 md:mr-2"></i>
              <span className="hidden md:inline">Live Dashboard</span>
              <span className="md:hidden">Dashboard</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
