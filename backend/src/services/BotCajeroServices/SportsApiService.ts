import { formatFixturesByLeague as formatFootball } from "./FootballApiService";
import { logger } from "../../utils/logger";

const API_BASKET = "https://v1.basketball.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY || "f1acc5d5397639eee54c0126b50e33d3";

interface SportMatch {
  home: string;
  away: string;
  time: string;
  league: string;
  country?: string;
}

const getLocalDate = (offset?: number): string => {
  const tz = process.env.TZ || "America/La_Paz";
  const d = new Date();
  if (offset) d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).replace(/\//g, "-");
};

const IMPORTANT_BASKET_LEAGUES = [
  "nba", "euroleague", "eurocup", "liga acb", "serie a", "bbl",
  "nbl", "cba", "lnb", "bsn", "cebl", "nba w"
];

const getBasketballFixturesByDate = async (date: string): Promise<SportMatch[]> => {
  try {
    const res = await fetch(`${API_BASKET}/games?date=${date}`, {
      headers: { "x-apisports-key": API_KEY },
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    const games = data?.response || [];
    return games
      .filter((g: any) => (g.status?.short || "NS") === "NS")
      .filter((g: any) => {
        const league = g.league?.name || "";
        const country = g.league?.country || "";
        const combined = (league + " " + country).toLowerCase();
        return IMPORTANT_BASKET_LEAGUES.some(kw => combined.includes(kw));
      })
      .map((g: any) => ({
        home: g.teams?.home?.name || "?",
        away: g.teams?.away?.name || "?",
        time: g.date ? new Date(g.date).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" }) : "??:??",
        league: g.league?.name || "Básquet",
        country: g.league?.country || ""
      }));
  } catch (err) {
    logger.error({ info: "Basketball API error", error: (err as Error).message });
    return [];
  }
};

const getAllSportsFixtures = async (date: string): Promise<{ football: any[]; basketball: SportMatch[] }> => {
  const { getFixturesByDate } = await import("./FootballApiService");
  const [football, basketball] = await Promise.all([
    getFixturesByDate(date),
    getBasketballFixturesByDate(date)
  ]);
  return { football, basketball };
};

const getAllSportsToday = async (): Promise<{ football: any[]; basketball: SportMatch[] }> => {
  const today = getLocalDate();
  return getAllSportsFixtures(today);
};

const getAllSportsTomorrow = async (): Promise<{ football: any[]; basketball: SportMatch[] }> => {
  const tomorrow = getLocalDate(1);
  return getAllSportsFixtures(tomorrow);
};

const formatAllSports = (
  footballFixtures: any[],
  basketballFixtures: SportMatch[],
  dateLabel: string,
  isTomorrow: boolean
): string => {
  const header = isTomorrow ? "PARTIDOS DE MAÑANA" : "PARTIDOS DE HOY";
  let text = `📋 *${header}*\n\n`;

  // Football section
  const footballText = formatFootball(footballFixtures, dateLabel);
  const lines = footballText.split("\n");
  // Strip first 2 lines (football header + stats line) + trailing hora line
  const footballBody = lines.length > 2 ? lines.slice(2, -1).join("\n").trim() : "";
  if (footballBody) {
    text += footballBody;
  }

  // Basketball section
  if (basketballFixtures.length > 0) {
    const grouped: Record<string, SportMatch[]> = {};
    for (const m of basketballFixtures) {
      if (!grouped[m.league]) grouped[m.league] = [];
      grouped[m.league].push(m);
    }
    if (footballBody) text += "\n\n";
    text += `🏀 *Básquet*\n`;
    for (const [league, matches] of Object.entries(grouped)) {
      text += `🏆 ${league}\n`;
      for (const m of matches) {
        text += `  🕐 ${m.time}  ${m.home} vs ${m.away}\n`;
      }
      text += "\n";
    }
  }

  text += `_Hora Bolivia (America/La_Paz)_`;
  return text.trim();
};

export {
  getAllSportsFixtures,
  getAllSportsToday,
  getAllSportsTomorrow,
  formatAllSports,
  getBasketballFixturesByDate
};
