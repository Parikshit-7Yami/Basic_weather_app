// frontend/script.js
// Vanilla JS controller for Weather Basic.
// Talks ONLY to our backend at /api/weather — no API key in the browser.

(() => {
  // ---------- State ----------
  let currentUnits = "metric";        // "metric" => °C, "imperial" => °F
  let lastQuery = null;               // { type: "city"|"coords", value: string|{lat,lon} }
  let lastData = null;                // last successful API response

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const app          = $("app");
  const cityInput    = $("city-input");
  const searchBtn    = $("search-btn");
  const geoBtn       = $("geo-btn");
  const unitC        = $("unit-c");
  const unitF        = $("unit-f");
  const status       = $("status");
  const cityName     = $("city-name");
  const dateLine     = $("date-line");
  const timeLine     = $("time-line");
  const heroIcon     = $("hero-icon");
  const tempValue    = $("temp-value");
  const tempUnit     = $("temp-unit");
  const condition    = $("condition");
  const humidity     = $("humidity");
  const wind         = $("wind");
  const hourlyEl     = $("hourly");
  const rainChart    = $("rain-chart");
  const tabs         = document.querySelectorAll(".tab");
  const tomorrowCard = $("tomorrow-card");
  const tomorrowIcon = $("tomorrow-icon");
  const tomorrowCond = $("tomorrow-cond");
  const tomorrowMax  = $("tomorrow-max");
  const tomorrowMin  = $("tomorrow-min");

  // ---------- Utilities ----------
  const buildIconUrl = (code) =>
    code ? `https://openweathermap.org/img/wn/${code}@2x.png` : "";

  const tempSymbol = () => (currentUnits === "metric" ? "°C" : "°F");
  const speedSymbol = () => (currentUnits === "metric" ? "m/s" : "mph");

  /**
   * Compute the local date/time of a place from:
   *   dt        - UTC timestamp (seconds) returned by OpenWeatherMap
   *   tzOffset  - seconds to add to UTC for local time
   * We build a Date in UTC from (dt + tzOffset) and then read its UTC fields,
   * which gives us "local time at the city" without depending on the browser's tz.
   */
  function localDate(dt, tzOffset) {
    return new Date((dt + tzOffset) * 1000);
  }
  function formatLocalDate(dt, tzOffset) {
    const d = localDate(dt, tzOffset);
    return d.toLocaleDateString(undefined, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "UTC",
    });
  }
  function formatLocalTime(dt, tzOffset) {
    const d = localDate(dt, tzOffset);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    });
  }
  function formatHourLabel(dt, tzOffset) {
    const d = localDate(dt, tzOffset);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    });
  }

  /**
   * Pick the dynamic background class based on weather + day/night.
   * Day/night comes from OpenWeatherMap's icon code suffix ("d" or "n").
   */
  function pickBackground(conditionMain, icon) {
    const isNight = typeof icon === "string" && icon.endsWith("n");
    const c = (conditionMain || "").toLowerCase();
    if (isNight) return "bg-night";
    if (c.includes("rain") || c.includes("drizzle") || c.includes("thunder")) return "bg-rain";
    if (c.includes("cloud")) return "bg-clouds";
    if (c.includes("clear")) return "bg-sunny";
    if (c.includes("snow") || c.includes("mist") || c.includes("fog")) return "bg-clouds";
    return "bg-sunny";
  }
  function applyBackground(klass) {
    app.classList.remove("bg-sunny", "bg-clouds", "bg-rain", "bg-night");
    app.classList.add(klass);
  }

  function setStatus(msg, isError = false) {
    status.textContent = msg || "";
    status.classList.toggle("error", !!(msg && isError));
  }

  // ---------- API ----------
  async function fetchWeather(query, units) {
    const params = new URLSearchParams();
    if (query.type === "city") {
      params.set("city", query.value);
    } else {
      params.set("lat", query.value.lat);
      params.set("lon", query.value.lon);
    }
    params.set("units", units);

    const res = await fetch(`/api/weather?${params.toString()}`);
    let body = null;
    try { body = await res.json(); } catch (_) { /* non-JSON */ }
    if (!res.ok) {
      const message = body?.message || "Unable to fetch weather data";
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function loadWeather(query) {
    if (!query) return;
    lastQuery = query;
    setStatus("Loading…");
    try {
      const data = await fetchWeather(query, currentUnits);
      lastData = data;
      renderAll(data);
      setStatus("");
    } catch (err) {
      console.error(err);
      if (err.status === 404) setStatus("City not found", true);
      else setStatus("Unable to fetch weather data. Please try again later.", true);
    }
  }

  // ---------- Rendering ----------
  function renderAll(d) {
    // Hero
    cityName.textContent = `${d.city ?? "—"}${d.country ? ", " + d.country : ""}`;
    dateLine.textContent = formatLocalDate(d.dt, d.timezone);
    timeLine.textContent = `Local time: ${formatLocalTime(d.dt, d.timezone)}`;
    heroIcon.src = buildIconUrl(d.icon);
    heroIcon.alt = d.conditionDescription || "";
    tempValue.textContent = Math.round(d.temperature);
    tempUnit.textContent  = tempSymbol();
    condition.textContent = d.conditionDescription || d.conditionMain || "";
    humidity.textContent  = `${d.humidity}%`;
    wind.textContent      = `${Math.round(d.windSpeed)} ${speedSymbol()}`;

    // Background
    applyBackground(pickBackground(d.conditionMain, d.icon));

    // Hourly
    renderHourly(d.hourly || [], d.timezone);

    // Rain chart
    renderRainChart(d.hourly || []);

    // Tomorrow
    renderTomorrow(d.tomorrow);
  }

  function renderHourly(list, tzOffset) {
    hourlyEl.innerHTML = "";
    if (!list.length) {
      hourlyEl.innerHTML = `<p style="opacity:.7;font-size:13px;margin:0">No hourly data available.</p>`;
      return;
    }
    for (const slot of list) {
      const div = document.createElement("div");
      div.className = "hour";
      div.innerHTML = `
        <span class="h-time">${formatHourLabel(slot.dt, tzOffset)}</span>
        <img src="${buildIconUrl(slot.icon)}" alt="${slot.conditionMain || ""}" />
        <span class="h-temp">${Math.round(slot.temperature)}${tempSymbol()}</span>
      `;
      hourlyEl.appendChild(div);
    }
  }

  /**
   * Render a tiny inline-SVG line chart of "chance of rain" (pop, 0..1)
   * over the hourly slots. Three guide lines mark light/med/heavy.
   */
  function renderRainChart(list) {
    const W = 320, H = 80, padX = 8, padY = 8;
    if (!list.length) {
      rainChart.innerHTML = "";
      return;
    }
    const xs = list.map((_, i) => padX + (i * (W - padX * 2)) / Math.max(list.length - 1, 1));
    const ys = list.map((s) => padY + (1 - (s.pop || 0)) * (H - padY * 2));

    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    const area = `${path} L${xs[xs.length - 1].toFixed(1)},${H - padY} L${xs[0].toFixed(1)},${H - padY} Z`;

    const guides = [0.25, 0.5, 0.75]
      .map((p) => {
        const y = padY + (1 - p) * (H - padY * 2);
        return `<line x1="${padX}" x2="${W - padX}" y1="${y}" y2="${y}" stroke="rgba(0,0,0,0.08)" stroke-dasharray="3 4"/>`;
      })
      .join("");

    rainChart.innerHTML = `
      <defs>
        <linearGradient id="rainGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stop-color="#c2410c" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#ffd1b3" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      ${guides}
      <path d="${area}" fill="url(#rainGrad)"/>
      <path d="${path}" fill="none" stroke="#c2410c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  function renderTomorrow(t) {
    if (!t) {
      tomorrowCard.classList.add("hidden");
      return;
    }
    tomorrowCard.classList.remove("hidden");
    tomorrowIcon.src = buildIconUrl(t.icon);
    tomorrowIcon.alt = t.conditionDescription || "";
    tomorrowCond.textContent = t.conditionDescription || t.conditionMain || "";
    tomorrowMax.textContent  = `${Math.round(t.tempMax ?? t.temperature)}${tempSymbol()}`;
    tomorrowMin.textContent  = `${Math.round(t.tempMin ?? t.temperature)}${tempSymbol()}`;
  }

  // ---------- Events ----------
  function doSearch() {
    const v = cityInput.value.trim();
    if (!v) { setStatus("Please enter a city name.", true); return; }
    loadWeather({ type: "city", value: v });
  }

  searchBtn.addEventListener("click", doSearch);
  cityInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by your browser.", true);
      return;
    }
    setStatus("Detecting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather({
        type: "coords",
        value: { lat: pos.coords.latitude, lon: pos.coords.longitude },
      }),
      () => setStatus("Unable to access your location", true),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });

  // Unit toggle: update state, refresh active styling, re-fetch the current place.
  function setUnits(units) {
    if (units === currentUnits) return;
    currentUnits = units;
    unitC.classList.toggle("active", units === "metric");
    unitF.classList.toggle("active", units === "imperial");
    if (lastQuery) loadWeather(lastQuery);
  }
  unitC.addEventListener("click", () => setUnits("metric"));
  unitF.addEventListener("click", () => setUnits("imperial"));

  // Tabs: simply toggle which forecast block to highlight.
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.tab;
      if (which === "tomorrow" && lastData?.tomorrow) {
        // Briefly nudge tomorrow card into view on small screens
        tomorrowCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });

  // ---------- Init ----------
  // Try geolocation silently; if denied, just wait for user input.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather({
        type: "coords",
        value: { lat: pos.coords.latitude, lon: pos.coords.longitude },
      }),
      () => { /* silently ignore — user can search manually */ },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }
})();
