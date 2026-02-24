import React from 'react';
import { Link } from '@tanstack/react-router';

function Confirmation({ userId }) {
  return (
    <div className="text-center">
      <div className="bg-gradient-to-br from-lava-500 to-lava-600 rounded-2xl p-6 md:p-10 text-white mb-6 md:mb-8 shadow-lg">
        <div className="text-5xl md:text-6xl mb-4 animate-bounce">🎉</div>
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Thanks for registering!</h2>
        <p className="text-base md:text-lg opacity-90 max-w-md mx-auto">
          Your response has been recorded. Check out the live dashboard to see who else is here.
        </p>
      </div>

      <Link
        to="/dashboard"
        className="w-full md:w-auto inline-flex items-center justify-center bg-navy-900 text-white px-8 py-4 rounded-xl font-semibold hover:bg-navy-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 no-underline text-base md:text-lg"
      >
        <i className="fas fa-chart-bar mr-3"></i>
        View Live Dashboard
        <i className="fas fa-arrow-right ml-3"></i>
      </Link>

      <p className="mt-6 md:mt-8 text-xs text-gray-400">
        Your ID: <code className="bg-oat-medium px-2 py-1 rounded text-gray-500 font-mono text-xs">{userId}</code>
      </p>
    </div>
  );
}

export default Confirmation;
