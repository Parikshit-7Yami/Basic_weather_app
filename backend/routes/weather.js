// backend/routes/weather.js
// GET /api/weather
//   ?city=<name>&units=metric|imperial
//   OR
//   ?lat=<lat>&lon=<lon>&units=metric|imperial
//
// Calls OpenWeatherMap's Current Weather + 5-day/3-hour Forecast endpoints
// in parallel, then normalizes the response into a clean schema for the frontend.

const express = require("express");
const router = express.Router();

const BASE = "https://api.openweathermap.org/data/2.5";

/**
 * Build the query string used for both endpoints.
 * Either { city } OR { lat, lon } must be provided.
 */
function buildOwmQuery({ city, lat, lon, units, apiKey }) {
  const params = new URLSearchParams();
  if (city) {
    params.set("q", city);
  } else {
    params.set("lat", lat);
    params.set("lon", lon);
  }
  params.set("units", units);
  params.set("appid", apiKey);
  return params.toString();
}

/**
 * Reduce the 3-hour forecast list to a few useful slots.
 * - hourly: next 8 entries (~24h ahead in 3h steps)
 * - tomorrow: midday slot (~12:00 local) of the next calendar day
 */
function summarizeForecast(forecast, tzOffsetSeconds) {
  const list = Array.isArray(forecast?.list) ? forecast.list : [];

  const hourly = list.slice(0, 8).map((slot) => ({
    dt: slot.dt,
    temperature: slot.main?.temp,
    icon: slot.weather?.[0]?.icon,
    conditionMain: slot.weather?.[0]?.main,
    // pop = probability of precipitation (0..1)
    pop: typeof slot.pop === "number" ? slot.pop : 0,
  }));

  // Pick "tomorrow" as the first slot whose local date differs from today's local date,
  // preferring something near 12:00 local time.
  const nowLocalDay = Math.floor((Date.now() / 1000 + tzOffsetSeconds) / 86400);
  const tomorrowSlots = list.filter((slot) => {
    const localDay = Math.floor((slot.dt + tzOffsetSeconds) / 86400);
    return localDay === nowLocalDay + 1;
  });

  let tomorrow = null;
  if (tomorrowSlots.length) {
    // Find slot closest to 12:00 local
    let best = tomorrowSlots[0];
    let bestDiff = Infinity;
    for (const slot of tomorrowSlots) {
      const localHour = ((slot.dt + tzOffsetSeconds) % 86400) / 3600;
      const diff = Math.abs(localHour - 12);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = slot;
      }
    }
    const temps = tomorrowSlots.map((s) => s.main?.temp).filter((t) => typeof t === "number");
    tomorrow = {
      dt: best.dt,
      temperature: best.main?.temp,
      tempMin: temps.length ? Math.min(...temps) : best.main?.temp,
      tempMax: temps.length ? Math.max(...temps) : best.main?.temp,
      icon: best.weather?.[0]?.icon,
      conditionMain: best.weather?.[0]?.main,
      conditionDescription: best.weather?.[0]?.description,
    };
  }

  return { hourly, tomorrow };
}

router.get("/", async (req, res) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ message: "Server is missing OPENWEATHER_API_KEY" });
  }

  const { city, lat, lon } = req.query;
  const units = req.query.units === "imperial" ? "imperial" : "metric";

  if (!city && !(lat && lon)) {
    return res
      .status(400)
      .json({ message: "Provide either ?city= or ?lat=&lon=" });
  }

  try {
    const qs = buildOwmQuery({ city, lat, lon, units, apiKey });
    const currentUrl = `${BASE}/weather?${qs}`;
    const forecastUrl = `${BASE}/forecast?${qs}`;

    // Fire both requests in parallel
    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl),
    ]);

    const current = await currentRes.json();

    // OpenWeatherMap reports errors via { cod, message } in the body
    const code = Number(current.cod);
    if (code === 404) {
      return res.status(404).json({ message: "City not found" });
    }
    if (!currentRes.ok || code >= 400) {
      console.error("OWM current error:", current);
      return res
        .status(500)
        .json({ message: "Unable to fetch weather data" });
    }

    let forecast = null;
    if (forecastRes.ok) {
      forecast = await forecastRes.json();
    } else {
      console.warn("Forecast fetch failed:", forecastRes.status);
    }

    const tzOffset = current.timezone ?? 0;
    const { hourly, tomorrow } = forecast
      ? summarizeForecast(forecast, tzOffset)
      : { hourly: [], tomorrow: null };

    // Clean, frontend-friendly shape
    const payload = {
      city: current.name,
      country: current.sys?.country,
      temperature: current.main?.temp,
      feelsLike: current.main?.feels_like,
      humidity: current.main?.humidity,
      windSpeed: current.wind?.speed,
      conditionMain: current.weather?.[0]?.main,
      conditionDescription: current.weather?.[0]?.description,
      icon: current.weather?.[0]?.icon,
      timezone: tzOffset,
      dt: current.dt,
      sunrise: current.sys?.sunrise,
      sunset: current.sys?.sunset,
      units,
      hourly,
      tomorrow,
    };

    res.json(payload);
  } catch (err) {
    console.error("Weather route error:", err);
    res.status(500).json({ message: "Unable to fetch weather data" });
  }
});

module.exports = router;
