const API_URL = process.env.REACT_APP_API_URL || '';

export async function submitRegistration(data) {
  const payload = {
    user_id: data.userId,
    location_type: data.locationType,
    borough: data.borough || null,
    neighborhood: data.neighborhood || null,
    state: data.state || null,
    reason: data.reason,
  };

  // If no API configured yet, log to console for demo
  if (!API_URL) {
    console.log('Registration (no API configured):', payload);
    return payload;
  }

  const res = await fetch(`${API_URL}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function askGenie(question) {
  if (!API_URL) {
    return { answer: 'API not configured', sql: null, columns: [], rows: [], suggested_questions: [] };
  }

  const res = await fetch(`${API_URL}/genie/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Genie error: ${res.status}`);
  }

  return res.json();
}

export async function getRegistrations() {
  if (!API_URL) {
    return [];
  }

  const res = await fetch(`${API_URL}/registrations`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function getBranch() {
  if (!API_URL) {
    return { current: 'production', available: ['production'] };
  }

  const res = await fetch(`${API_URL}/admin/branch`);
  if (!res.ok) {
    return { current: 'production', available: ['production'] };
  }

  return res.json();
}
