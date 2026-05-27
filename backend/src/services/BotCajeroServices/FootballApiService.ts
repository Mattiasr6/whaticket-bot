import axios from "axios";
import { getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

const API_BASE = "https://api-football-v1.p.rapidapi.com/v3";
const API_KEY = process.env.FOOTBALL_API_KEY || "";

const CACHE = {
  FIXTURES_TODAY: 1800,
  FIXTURES_TOMORROW: 1800,
  FIXTURES_BY_DATE: 1800,
  SEARCH: 1800,
  LIVE: 180,
  FIXTURE_BY_ID: 600,
  STATS: 600
};

const cacheKey = (type: string, param: string): string =>
  `botcajero:football:${type}:${param}`;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
  },
  timeout: 10000
});

const getFixturesByDate = async (date: string): Promise<any[]> => {
  const key = cacheKey("fixtures", date);
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // cache miss
    }
  }

  const res = await apiClient.get("/fixtures", { params: { date } });
  const data = res.data?.response || [];
  if (redis) {
    try {
      await redis.setex(key, CACHE.FIXTURES_BY_DATE, JSON.stringify(data));
    } catch {
      // non-critical
    }
  }
  return data;
};

const getTomorrowFixtures = async (): Promise<any[]> => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];
  return getFixturesByDate(dateStr);
};

const getTodayFixtures = async (): Promise<any[]> => {
  const today = new Date().toISOString().split("T")[0];
  return getFixturesByDate(today);
};

const getLiveFixtures = async (): Promise<any[]> => {
  const key = cacheKey("live", "all");
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // cache miss
    }
  }

  const res = await apiClient.get("/fixtures", { params: { live: "all" } });
  const data = res.data?.response || [];
  if (redis) {
    try {
      await redis.setex(key, CACHE.LIVE, JSON.stringify(data));
    } catch {
      // non-critical
    }
  }
  return data;
};

const getFixtureById = async (fixtureId: number): Promise<any | null> => {
  const key = cacheKey("fixture", String(fixtureId));
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // cache miss
    }
  }

  const res = await apiClient.get("/fixtures", { params: { id: fixtureId } });
  const data = res.data?.response?.[0] || null;
  if (redis && data) {
    try {
      await redis.setex(key, CACHE.FIXTURE_BY_ID, JSON.stringify(data));
    } catch {
      // non-critical
    }
  }
  return data;
};

const getFixtureStats = async (fixtureId: number): Promise<any[]> => {
  const key = cacheKey("stats", String(fixtureId));
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // cache miss
    }
  }

  const res = await apiClient.get("/fixtures/statistics", {
    params: { fixture: fixtureId }
  });
  const data = res.data?.response || [];
  if (redis) {
    try {
      await redis.setex(key, CACHE.STATS, JSON.stringify(data));
    } catch {
      // non-critical
    }
  }
  return data;
};

const searchFixtures = async (query: string): Promise<any[]> => {
  const key = cacheKey(
    "search",
    query.toLowerCase().replace(/\s+/g, "_")
  );
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // cache miss
    }
  }

  const teamRes = await apiClient.get("/teams", {
    params: { search: query }
  });
  const teamId = teamRes.data?.response?.[0]?.team?.id;
  if (!teamId) return [];

  const fixturesRes = await apiClient.get("/fixtures", {
    params: { team: teamId, next: 5 }
  });
  const data = fixturesRes.data?.response || [];
  if (redis) {
    try {
      await redis.setex(key, CACHE.SEARCH, JSON.stringify(data));
    } catch {
      // non-critical
    }
  }
  return data;
};

const formatFixturesByLeague = (fixtures: any[]): string => {
  const leagues: Record<string, string[]> = {};

  for (const f of fixtures) {
    const leagueName = f.league?.name || "Otras ligas";
    const home = f.teams?.home?.name || "?";
    const away = f.teams?.away?.name || "?";
    const date = new Date(f.fixture?.date || "");
    const time = date.toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz"
    });
    const status = f.fixture?.status?.short || "";

    let line = `${home} vs ${away}`;
    if (status === "FT" || status === "AET" || status === "PEN") {
      const scoreHome = f.goals?.home ?? 0;
      const scoreAway = f.goals?.away ?? 0;
      line += ` ${scoreHome}-${scoreAway}`;
    } else if (
      status === "1H" ||
      status === "2H" ||
      status === "HT"
    ) {
      const scoreHome = f.goals?.home ?? 0;
      const scoreAway = f.goals?.away ?? 0;
      line += ` ${scoreHome}-${scoreAway} [${status}]`;
    } else {
      line += ` — ${time}`;
    }

    if (!leagues[leagueName]) leagues[leagueName] = [];
    leagues[leagueName].push(line);
  }

  const emojis: Record<string, string> = {
    "La Liga": "🇪🇸",
    "Premier League": "🇬🇧",
    "Serie A": "🇮🇹",
    Bundesliga: "🇩🇪",
    "Ligue 1": "🇫🇷",
    "Brasileirão": "🇧🇷",
    "Liga Profesional": "🇦🇷",
    default: "⚽"
  };

  let text = "";
  for (const [league, matches] of Object.entries(leagues)) {
    const emoji = emojis[league] || emojis.default;
    text += `${emoji} *${league}:*\n`;
    text += matches.map(m => `   • ${m}`).join("\n");
    text += "\n\n";
  }
  return text.trim();
};

export {
  getFixturesByDate,
  getTodayFixtures,
  getTomorrowFixtures,
  getLiveFixtures,
  getFixtureById,
  getFixtureStats,
  searchFixtures,
  formatFixturesByLeague
};
