import { logger } from "../../utils/logger";

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY || "f1acc5d5397639eee54c0126b50e33d3";

const headers = {
  "x-apisports-key": API_KEY
};

interface MatchInfo {
  home: string;
  away: string;
  date: string;
  time: string;
  league: string;
  country?: string;
  score?: string;
  status?: string;
  id?: number;
  homeId?: number;
  awayId?: number;
}

const getLocalDate = (offset?: number): string => {
  const tz = process.env.TZ || "America/La_Paz";
  const d = new Date();
  if (offset) d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).replace(/\//g, "-");
};

const formatTime = (timestamp: string): string => {
  if (!timestamp) return "??:??";
  const d = new Date(timestamp);
  return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" });
};

const apiFetch = async (endpoint: string): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json();
    return data?.response || [];
  } catch (err) {
    logger.error({ info: "API-Football error", endpoint, error: (err as Error).message });
    return [];
  }
};

const getFixturesByDate = async (date: string): Promise<MatchInfo[]> => {
  const data = await apiFetch(`/fixtures?date=${date}`);
  return data
    .filter((f: any) => {
      // Mostrar todos: no iniciados, en vivo, terminados
      const status = f.fixture?.status?.short || "";
      // Excluir solo si status está vacío o es cancelado/postergado
      return !["CANC", "POST", "ABAN", "SUSP", "AWARDED"].includes(status);
    })
    .map((f: any) => ({
      home: f.teams?.home?.name || "?",
      away: f.teams?.away?.name || "?",
      date,
      time: formatTime(f.fixture?.date),
      league: f.league?.name || "Otras ligas",
      country: f.league?.country || "",
      score: f.goals?.home !== null ? `${f.goals.home}-${f.goals.away}` : undefined,
      status: f.fixture?.status?.short || "NS",
      id: f.fixture?.id,
      homeId: f.teams?.home?.id,
      awayId: f.teams?.away?.id
    }));
};

const getTodayFixtures = async (): Promise<MatchInfo[]> => getFixturesByDate(getLocalDate());
const getTomorrowFixtures = async (): Promise<MatchInfo[]> => getFixturesByDate(getLocalDate(1));

const getLiveFixtures = async (): Promise<any[]> => apiFetch("/fixtures?live=all");

const getFixtureById = async (fixtureId: number): Promise<any | null> => {
  const data = await apiFetch(`/fixtures?id=${fixtureId}`);
  return data[0] || null;
};

const getFixtureStats = async (fixtureId: number): Promise<any[]> => apiFetch(`/fixtures/statistics?fixture=${fixtureId}`);

const searchFixtures = async (query: string): Promise<any[]> => {
  // Buscar equipos
  const teams = await apiFetch(`/teams?search=${encodeURIComponent(query)}`);
  if (teams.length === 0) return [];
  const teamId = teams[0].team?.id;
  if (!teamId) return [];
  // Buscar próximos fixtures de ese equipo
  const fixtures = await apiFetch(`/fixtures?team=${teamId}&next=5`);
  return fixtures.map((f: any) => ({
    fixture: { id: f.fixture?.id, date: f.fixture?.date },
    teams: { home: { name: f.teams?.home?.name }, away: { name: f.teams?.away?.name } },
    league: { name: f.league?.name }
  }));
};

// ─── Normalizar nombre de liga ───
const normalizeLeagueName = (name: string): string => {
  return name
    .replace(/ Group [A-Z0-9]/i, "")
    .replace(/ Knockout Stage/i, "")
    .replace(/ Relegation\/Promotion.*/i, "")
    .replace(/ Playoffs?/i, "")
    .replace(/ Regular Season/i, "")
    .trim();
};

const IMPORTANT_KEYWORDS = [
  "libertadores", "sudamericana", "copa do brasil", "copa argentina",
  "la liga", "serie a", "bundesliga", "ligue 1", "champions league",
  "europa league", "conference league", "world cup", "copa américa",
  "brasileirão", "brasileiro série", "liga profesional",
  "primera división argentina", "primera división bolivia",
  "primera división chile", "primera división perú",
  "mls", "eredivisie", "primeira liga", "belgian pro league",
  "super lig", "allsvenskan", "eliteserien",
  "england premier league", "english premier",
  "spain la liga", "spanish la liga",
  "italy serie a", "italian serie a",
  "germany bundesliga", "german bundesliga",
  "france ligue 1", "french ligue 1",
  "portugal primeira liga", "portuguese primeira liga"
];

const EXCLUDE_KEYWORDS = [
  "u17", "u19", "u20", "u23", "regionalliga", "oberliga",
  "queensland", "victoria", "new south wales", "south australia", "tasmania", "western australia",
  "liga f", "egyptian", "sudani", "ethiopia", "kuwait", "kyrgyzstan", "bhutan", "barbados",
  "copa do nordeste", "serie c", "serie d", "liga 2", "liga 3", "4 deild", "3 deild",
  "landesliga", "kakkonen", "kolmonen", "division 2", "division intermedia",
  "2. division", "3. division", "third league", "second league", "first nl",
  "erovnuli", "virsliga", "1 lyga", "a lyga",
  "premier league kazakh", "premier league united arab", "premier league barbados",
  "premier league bhutan", "premier league sudan", "premier league ethiopia",
  "premier league kyrgyzstan", "premier league kuwait",
  "norway 3. division", "sweden division 2",
  "czech", "bulgaria third", "croatia second", "serbia prva",
  "montenegro", "kosovo", "tunisia", "ukraine persha",
  "uzbekistan", "china league one",
  "u19", "u20", "u23", "u17", "reserve", "aspirantes",
  "friendlies", "liga women", "feminine", "nwsl", "w league",
  "northern super league", "canadian premier",
  "paulista", "baiano", "mineiro", "copa norte", "copa ecuador", "copa colombia", "copa paraguay",
  "ligue 2", "serie b", "second league",
  "paraguay", "peru segunda", "peru liga women",
  "club friendly", "women"
];

const formatFixturesByLeague = (fixtures: MatchInfo[], dateLabel?: string): string => {
  const filtered = fixtures.filter(m => {
    const leagueLower = m.league.toLowerCase();
    const combined = leagueLower + " " + (m.country || "").toLowerCase();
    for (const excl of EXCLUDE_KEYWORDS) if (combined.includes(excl)) return false;
    return IMPORTANT_KEYWORDS.some(kw => combined.includes(kw));
  });

  const grouped: Record<string, MatchInfo[]> = {};
  for (const match of filtered) {
    const norm = normalizeLeagueName(match.league);
    if (!grouped[norm]) grouped[norm] = [];
    grouped[norm].push(match);
  }

  const tz = process.env.TZ || "America/La_Paz";
  const dateStr = dateLabel || new Intl.DateTimeFormat("es", { timeZone: tz, weekday: "long", day: "numeric", month: "numeric", year: "numeric" }).format(new Date());

  if (filtered.length === 0) return `📋 No hay partidos programados para ${dateStr}.`;

  let text = `⚽ Partidos de Fútbol — ${dateStr}\n\n`;
  text += `📊 ${filtered.length} partidos · ${Object.keys(grouped).length} ligas\n\n`;

  for (const [league, matches] of Object.entries(grouped)) {
    text += `🏆 ${league}\n`;
    for (const m of matches) {
      if (m.score) text += `  🕐 ${m.time}  ${m.home} ${m.score} ${m.away}\n`;
      else text += `  🕐 ${m.time}  ${m.home} vs ${m.away}\n`;
    }
    text += "\n";
  }

  text += `_Hora Bolivia (America/La_Paz)_`;
  return text.trim();
};

export {
  getFixturesByDate, getTodayFixtures, getTomorrowFixtures,
  getLiveFixtures, getFixtureById, getFixtureStats,
  searchFixtures, formatFixturesByLeague
};
