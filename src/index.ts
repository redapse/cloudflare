// Enhanced version of your Worker with KV-backed user preference handling
// and cookie-based user identification. This version integrates seamlessly
// with your existing code.

export default {
  async fetch(request, env): Promise<Response> {
    const PREF_KEY = "pref:";
    let html_style = `body{padding:6em; font-family: sans-serif;} h1{color:#f6821f}`;
    let html_content = "<h1>Weather 🌦</h1>";

    // --- 1. Handle Cookie for user identification
    const cookieHeader = request.headers.get("Cookie") || "";
    const userIdMatch = cookieHeader.match(/user-id=([^;]+)/);
    let userId = userIdMatch ? userIdMatch[1] : null;

    // NEW: Read "unit" preference from query param to allow switching
    const url = new URL(request.url);
    const queryUnit = url.searchParams.get("unit"); // e.g. ?unit=fahrenheit

    // Default preference
    let prefs = { unit: "celsius" };

    if (!userId) {
      // First-time visitor: create ID
      userId = crypto.randomUUID();
    } else {
      // Returning user: try to load stored preferences
      const rawPrefs = await env.PREFS.get(PREF_KEY + userId);
      if (rawPrefs) {
        prefs = JSON.parse(rawPrefs);
      }
    }

    // If user explicitly chooses a new unit via ?unit=...
    if (queryUnit && ["celsius", "fahrenheit"].includes(queryUnit)) {
      prefs.unit = queryUnit;
      await env.PREFS.put(PREF_KEY + userId, JSON.stringify(prefs));
    }

    // Always save preferences on first-time user
    if (!userIdMatch) {
      await env.PREFS.put(PREF_KEY + userId, JSON.stringify(prefs));
    }

    // --- 2. Fetch weather data
    const latitude = request.cf.latitude;
    const longitude = request.cf.longitude;

    const token = "d3145d8e24567dfa64fe753f18945cadff44b562";
    let endpoint = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${token}`;

    const response = await fetch(endpoint, {
      headers: { "content-type": "application/json;charset=UTF-8" },
    });
    const content = await response.json();

    // Convert temperature if needed
    let temperature = content.data.iaqi.t?.v;
    if (prefs.unit === "fahrenheit") {
      temperature = (temperature * 9) / 5 + 32;
    }

    html_content += `<p>This is a demo using Workers geolocation + personalization.</p>`;
    html_content += `<p>You are located at: ${latitude}, ${longitude}.</p>`;
    html_content += `<p>Based on sensor: <a href="${content.data.city.url}">${content.data.city.name}</a></p>`;
    html_content += `<p>The AQI level is: ${content.data.aqi}.</p>`;
    html_content += `<p>The NO2 level is: ${content.data.iaqi.no2?.v}.</p>`;
    html_content += `<p>The O3 level is: ${content.data.iaqi.o3?.v}.</p>`;
    html_content += `<p>The temperature is: ${temperature}°${prefs.unit === "celsius" ? "C" : "F"}.</p>`;
    html_content += `<p><a href="?unit=celsius">Show °C</a> | <a href="?unit=fahrenheit">Show °F</a></p>`;

    const html = `<!DOCTYPE html>
      <head>
        <title>Geolocation: Weather</title>
      </head>
      <body>
        <style>${html_style}</style>
        <div id="container">
        ${html_content}
        </div>
      </body>`;

    const responseHeaders = {
      "content-type": "text/html;charset=UTF-8",
      "Set-Cookie": `user-id=${userId}; Path=/; HttpOnly; SameSite=Lax`,
    };

    return new Response(html, { headers: responseHeaders });
  },
}
