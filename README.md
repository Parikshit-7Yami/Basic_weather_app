# Weather Basic

A small full-stack weather app:

- **Frontend**: vanilla HTML/CSS/JS (no frameworks).
- **Backend**: Node.js + Express, proxies OpenWeatherMap so the API key stays server-side.
- **Data**: OpenWeatherMap *Current Weather* + *5-day / 3-hour Forecast* (free tier).

## Project structure

```
weather-basic/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── server.js
│   ├── package.json
│   └── routes/weather.js
├── .env.example
└── README.md
```

## Setup

1. Get a free API key from https://openweathermap.org/api
2. Copy `.env.example` → `.env` (in the project root) and paste your key:
   ```
   OPENWEATHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
   PORT=5000
   ```
3. Install backend deps:
   ```
   cd backend
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open http://localhost:5000 in your browser.

The Express server serves the `frontend/` folder as static files **and** exposes
`GET /api/weather?city=London&units=metric` (or `?lat=..&lon=..&units=imperial`).

## Notes

- The OpenWeatherMap key is only ever read on the backend (`backend/routes/weather.js`).
  It is never sent to the browser.
- Requires Node.js 18+ (uses the global `fetch`).
