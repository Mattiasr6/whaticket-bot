# BotCajero v4 — Fútbol, Predicciones y Tracking en Vivo

## Especificación de Software

> **Basado en**: `handoff/spec-botcajero.md` (v1), `handoff/spec-botcajero-v2.md` (v2), `handoff/spec-botcajero-v3.md` (v3)
> **Estado actual**: BotCajero v1+v2+v3 implementado. Pipeline completo.
> **Stack**: Node.js + TypeScript + Express + Sequelize + MySQL + Redis + Baileys + React 16 + MUI 4
> **API externa**: API-Football via RapidAPI (free tier 100 req/día)

---

## Tabla de Contenido

### Sprint 1 — Base Fútbol
1. [API-Football Integration Service](#1-api-integration)
2. [/partidos y @bot partidos — Fixtures hoy/mañana](#2-partidos)
3. [Push nocturno automático 21:00](#3-push-nocturno)

### Sprint 2 — Dinámicas y Predicciones
4. [Modelos BotCajeroPrediction + BotCajeroPredictionEntry](#4-modelos-prediccion)
5. [PredictionService — CRUD de dinámicas](#5-prediction-service)
6. [/dinamica crear, list, cancel](#6-dinamica-comandos)
7. [/predecir — Registrar predicción](#7-predecir)
8. [Frontend: tab Dinámicas](#8-frontend-dinamicas)

### Sprint 3 — Tracking en Vivo
9. [FootballScheduler — Timer 3-5 min](#9-football-scheduler)
10. [Detección inicio → cerrar dinámicas](#10-deteccion-inicio)
11. [Alerta HT con estadísticas](#11-alerta-ht)
12. [Alerta FT + resolución de ganadores](#12-alerta-ft)

---

## Resumen de esfuerzo por Sprint

| Sprint | Features | Archivos nuevos | Archivos modificados | Esfuerzo total |
|--------|----------|:---------------:|:--------------------:|:--------------:|
| **1** — Base fútbol | 3 | 1 | 4 | 🟡 ~6h |
| **2** — Dinámicas | 5 | 4 | 3 | 🟡 ~6h |
| **3** — Tracking vivo | 4 | 1 | 3 | 🟡 ~6h |

---

# SPRINT 1 — BASE FÚTBOL

<a name="1-api-integration"></a>
## 1️⃣ API-Football Integration Service

### User Story

```
Como administrador,
quiero que el bot consuma la API-Football para obtener fixtures, resultados y estadísticas,
para que los miembros del grupo puedan consultar partidos y participar en predicciones.
```

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/BotCajeroServices/FootballApiService.ts` | Cliente HTTP para API-Football. Cache en Redis TTL 30min. Fetch de fixtures, live scores, statistics. |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `.env.example` | Agregar `FOOTBALL_API_KEY=<rapidapi_key>` |
| `backend/src/config/index.ts` o donde se carguen env vars | Leer `FOOTBALL_API_KEY` |

### API-Football Endpoints

La API-Football de RapidAPI tiene estos endpoints relevantes:

```
Base URL: https://api-football-v1.p.rapidapi.com/v3/
Headers:
  x-rapidapi-key: {FOOTBALL_API_KEY}
  x-rapidapi-host: api-football-v1.p.rapidapi.com
```

| Endpoint | Uso | Free tier? |
|----------|-----|:----------:|
| `GET /fixtures?date=YYYY-MM-DD` | Partidos de una fecha específica | ✅ |
| `GET /fixtures?live=all` | Partidos en vivo ahora | ✅ |
| `GET /fixtures?search={team}` | Buscar partidos por nombre de equipo | ✅ |
| `GET /fixtures/statistics?fixture={id}` | Estadísticas de un partido (posesión, tiros, etc.) | ✅ |
| `GET /fixtures?id={id}` | Datos de un fixture específico | ✅ |

### FootballApiService.ts — Diseño

```typescript
class FootballApiService {
  private baseUrl = "https://api-football-v1.p.rapidapi.com/v3";
  private apiKey: string;
  private redis: Redis;

  constructor() {
    this.apiKey = process.env.FOOTBALL_API_KEY || "";
    this.redis = getRedisClient();
  }

  // Cache key pattern: "football:fixtures:{date}" — TTL 30 min
  async getFixturesByDate(date: string): Promise<Fixture[]>;
  
  // Cache key pattern: "football:live" — TTL 3 min (más corto para live)
  async getLiveFixtures(): Promise<LiveFixture[]>;
  
  // Cache key pattern: "football:search:{keyword}" — TTL 30 min
  async searchFixtures(keyword: string): Promise<Fixture[]>;
  
  // Cache key pattern: "football:stats:{fixtureId}" — TTL 10 min
  async getFixtureStatistics(fixtureId: number): Promise<MatchStats>;
  
  // Cache key pattern: "football:fixture:{fixtureId}" — TTL 30 min
  async getFixtureById(fixtureId: number): Promise<FixtureDetail>;
}
```

**Estrategia de cache:**
```
Clave Redis: "football:fixtures:{date}" → TTL 1800 (30 min)
Clave Redis: "football:live" → TTL 180 (3 min)
Clave Redis: "football:search:{keyword.toLowerCase()}" → TTL 1800
Clave Redis: "football:stats:{fixtureId}" → TTL 600 (10 min)
Clave Redis: "football:fixture:{fixtureId}" → TTL 1800

Si Redis no está disponible o la clave no existe → fetch de API
Si fetch de API falla → log de error, no cachear
```

**Límite de free tier: 100 req/día.**
- Cada fetch de fixtures por fecha: 1 req
- Cada fetch de live: 1 req
- Cada fetch de stats: 1 req
- Con cache Redis de 30 min → máx 48 req/día por tipo de fixture
- Live cada 3 min → máx 480 req/día (excede free tier)
  → Solución: Live SOLO si hay dinámicas activas, y cada 5 min no 3

**Structs de datos (tipados):**

```typescript
interface Fixture {
  fixture: {
    id: number;
    date: string;       // "2026-05-28T16:00:00+00:00"
    status: {
      short: string;    // "NS" | "1H" | "HT" | "2H" | "FT"
      long: string;     // "Not Started" | "First Half" | ...
    };
  };
  league: {
    name: string;       // "La Liga", "Premier League", etc.
    country: string;
    logo: string;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

interface MatchStats {
  fixtureId: number;
  stats: Array<{
    type: string;        // "Ball Possession", "Total Shots", "Shots on Goal", "Corner Kicks", etc.
    home: string;        // "65%", "12", "5", "7"
    away: string;        // "35%", "8", "3", "2"
  }>;
}
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Fetch fixtures por fecha | Llamar getFixturesByDate("2026-05-28") | Retorna array de fixtures |
| QA2 | Cache funciona | Llamar 2 veces misma fecha | 2da llamada no cuenta como request API |
| QA3 | API key inválida | FOOTBALL_API_KEY vacía | Servicio no explota, retorna array vacío y log de error |
| QA4 | Live fixtures | Llamar getLiveFixtures() | Retorna fixtures en vivo (o array vacío si no hay) |

### Dependencias

- `axios` o `node-fetch` para HTTP requests (axios ya está en el proyecto)
- Redis para cache (ya existe `getRedisClient()` en `redisStore.ts`)
- Variable de entorno `FOOTBALL_API_KEY`

### Esfuerzo Estimado

**Medio** (~2-3 horas). Cliente HTTP con cache Redis + types.

---

<a name="2-partidos"></a>
## 2️⃣ /partidos y @bot partidos — Fixtures Hoy/Mañana

### User Story

```
Como miembro del grupo,
quiero escribir @bot partidos en el grupo o /partidos al admin en privado
para ver la lista de partidos de hoy organizados por liga.
```

```
Como administrador,
quiero que los miembros puedan consultar los partidos del día
para estar informados y participar en dinámicas.
```

### Archivos a Crear

Ninguno. Se agrega a `HandlePrivateCommand.ts` y `GroupCommandHandler.ts` existentes.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar cases `/partidos` y `/mañana` |
| `backend/src/services/BotCajeroServices/GroupCommandHandler.ts` | Agregar cases "partidos" y "mañana" en el router de menciones |

### Flujo Detallado

#### /partidos (privado) y @bot partidos (grupo)

```
1. Admin escribe "/partidos" o miembro escribe "@bot partidos"
2. Ejecutar FootballApiService.getFixturesByDate(today)
3. Si no hay partidos:
   → "📋 No hay partidos programados para hoy."
4. Si hay partidos, agrupar por liga:
   "⚽ PARTIDOS DE HOY — {fecha}
   
   🇪🇸 La Liga:
   🆚 Real Madrid vs Barcelona — 16:00
   🆚 Atlético vs Sevilla — 18:30
   
   🏴 Premier League:
   🆚 Liverpool vs Arsenal — 14:00
   
   🇮🇹 Serie A:
   🆚 Juventus vs Milan — 20:00
   
   Total: 4 partidos"
5. Crear BotCajeroLog eventType: 'football_fixtures'
```

#### /mañana (privado) y @bot mañana (grupo)

```
1. Admin escribe "/mañana" o miembro escribe "@bot mañana"
2. Calcular fecha de mañana: tomorrow = new Date(now + 1 día)
3. Ejecutar FootballApiService.getFixturesByDate(tomorrow)
4. Mismo formato que /partidos pero con título "PARTIDOS DE MAÑANA"
```

**Formateo de fecha:** Usar `date-fns` (ya en el proyecto):
```typescript
import { format } from "date-fns";
import { es } from "date-fns/locale";
format(new Date(), "EEEE d 'de' MMMM", { locale: es });
// → "jueves 28 de mayo"
```

**TimeZone:** La API devuelve UTC. Convertir a hora local Bolivia (UTC-4):
```typescript
const localTime = new Date(fixture.fixture.date);
localTime.setHours(localTime.getHours() - 4);
const timeStr = format(localTime, "HH:mm");
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | /partidos con data | Admin escribe `/partidos`, hay partidos hoy | Bot responde con lista agrupada por liga |
| QA2 | /partidos sin data | Admin escribe `/partidos`, no hay partidos | Bot responde "No hay partidos programados" |
| QA3 | @bot partidos en grupo | Miembro escribe `@bot partidos` | Bot responde en grupo con misma info |
| QA4 | /mañana | Admin escribe `/mañana` | Bot responde con partidos de mañana |
| QA5 | Quiet mode | De noche, @bot partidos | Bot NO responde (quiet mode existente) |

### Dependencias

- `FootballApiService.ts` (feature #1)
- `HandlePrivateCommand.ts` existente
- `GroupCommandHandler.ts` existente
- `date-fns` (ya en proyecto)

### Esfuerzo Estimado

**Bajo** (~1 hora). Dos cases nuevos, mismo servicio, formateo de texto.

---

<a name="3-push-nocturno"></a>
## 3️⃣ Push Nocturno Automático 21:00

### User Story

```
Como administrador,
quiero que el bot envíe automáticamente los partidos de mañana al grupo a las 21:00
para que los miembros sepan qué partidos hay y puedan preparar sus predicciones.
```

### Archivos a Crear

Ninguno. Timer dentro del servicio existente o `FootballApiService.ts`.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/server.ts` o `BotCajeroServices/index.ts` | Agregar timer que ejecuta a las 21:00 hora local |
| `backend/src/services/BotCajeroServices/FootballApiService.ts` | Agregar método `sendDailyPush(config)` que obtiene fixtures de mañana y envía al grupo |

### Flujo Detallado

```
En server.ts (o un scheduler central):

// Push nocturno 21:00 — Partidos de mañana
const scheduleDailyPush = () => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(21, 0, 0, 0); // 21:00

  // Si ya pasaron las 21:00 hoy, programar para mañana
  if (now > target) target.setDate(target.getDate() + 1);

  const msUntilTarget = target.getTime() - now.getTime();

  setTimeout(async () => {
    await executeDailyPush();
    // Reprogramar para el día siguiente
    setInterval(executeDailyPush, 24 * 60 * 60 * 1000);
  }, msUntilTarget);
};

async function executeDailyPush() {
  const configs = await BotCajeroConfig.findAll({ 
    where: { autoReplyEnabled: true } 
  });
  
  for (const config of configs) {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = format(tomorrow, "yyyy-MM-dd");
      
      const fixtures = await FootballApiService.getFixturesByDate(dateStr);
      
      if (fixtures.length === 0) return; // no enviar si no hay partidos
      
      const grouped = groupByLeague(fixtures);
      let message = `📋 PARTIDOS DE MAÑANA — ${format(tomorrow, "EEEE d 'de' MMMM", { locale: es })}\n\n`;
      
      for (const [league, matches] of Object.entries(grouped)) {
        message += `🏆 ${league}\n`;
        for (const match of matches) {
          message += `🆚 ${match.teams.home.name} vs ${match.teams.away.name} — ${formatTime(match.fixture.date)}\n`;
        }
        message += "\n";
      }
      
      message += "💡 Usa @bot partidos para ver los de hoy.\n🎯 Hay dinámicas abiertas, participa con /predecir!";
      
      await whatsappProvider.sendMessage(config.whatsappId, config.groupJid, message);
      createLog(config.id, 'football_daily_push');
    } catch (err) {
      logger.error({ info: "BotCajero - Daily push error", error: (err as Error).message });
    }
  }
}
```

**Redis flag anti-duplicado:**
```typescript
// Antes de enviar, verificar:
const key = `botcajero:dailypush:${config.whatsappId}:${dateStr}`;
const alreadySent = await redis.get(key);
if (alreadySent) return; // ya se envió hoy

// Después de enviar:
await redis.setex(key, 86400, "1"); // expira en 24h
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Push automático | Son las 21:00, hay partidos mañana | Bot envía lista al grupo |
| QA2 | Sin partidos | Son las 21:00, no hay partidos mañana | Bot NO envía nada |
| QA3 | No duplica | Timer se ejecuta a las 21:00 y otra vez 5s después | Solo 1 envío (Redis flag) |
| QA4 | Múltiples configs | 2 configs activas | Cada grupo recibe su push |

### Dependencias

- `FootballApiService.ts` (feature #1)
- `BotCajeroConfig.findAll({ where: { autoReplyEnabled: true } })`
- `whatsappProvider.sendMessage()`
- Redis para flag anti-duplicado

### Esfuerzo Estimado

**Medio** (~2-3 horas). Timer con setInterval/setTimeout, formateo, anti-duplicado.

---

# SPRINT 2 — DINÁMICAS Y PREDICCIONES

<a name="4-modelos-prediccion"></a>
## 4️⃣ Modelos BotCajeroPrediction + BotCajeroPredictionEntry

### Tabla: `BotCajeroPredictions`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| botCajeroConfigId | INTEGER | FK → BotCajeroConfig.id, ON DELETE CASCADE | |
| fixtureId | INTEGER | NOT NULL | ID del partido en API-Football |
| matchLabel | VARCHAR(255) | NOT NULL | "Real Madrid vs Barcelona" |
| matchTime | DATETIME | NOT NULL | Fecha/hora del partido (UTC) |
| predictionType | ENUM('score_exacto','goles_totales','primer_gol','esquinas_totales','goles_primer_tiempo') | NOT NULL | Tipo de dinámica |
| status | ENUM('abierta','cerrada','resuelta') | NOT NULL, DEFAULT 'abierta' | Estado |
| result | VARCHAR(100) | NULL | Resultado real (ej. "2-1", "over_2.5") cuando se resuelve |
| createdAt | DATETIME | NOT NULL | |
| updatedAt | DATETIME | NOT NULL | |

**Índices**: INDEX(botCajeroConfigId, status), INDEX(fixtureId, status)

### Tabla: `BotCajeroPredictionEntries`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| predictionId | INTEGER | FK → BotCajeroPredictions.id, ON DELETE CASCADE | |
| userJid | VARCHAR(255) | NOT NULL | JID del usuario que predijo |
| userLabel | VARCHAR(255) | NOT NULL | Nombre o número visible |
| prediction | VARCHAR(100) | NOT NULL | Lo que predijo (ej. "2-1", "over 2.5", "Messi") |
| createdAt | DATETIME | NOT NULL | |

**Índices**: INDEX(predictionId), UNIQUE(predictionId, userJid) — 1 predicción por usuario por dinámica

### Migraciones

```
20260528000001-create-botcajero-predictions.ts
20260528000002-create-botcajero-prediction-entries.ts
```

### Tipos de Predicción

| Tipo | Qué predice el usuario | Formato de prediction | Cómo se resuelve |
|------|----------------------|-----------------------|-------------------|
| `score_exacto` | Marcador exacto | "2-1" (local-visitante) | goals.fulltime |
| `goles_totales` | Total de goles en el partido | "over_2.5" o "under_2.5" | home+away goals |
| `primer_gol` | Qué jugador hace el primer gol | "Messi" (nombre) | Requiere API de eventos (fase 2) |
| `esquinas_totales` | Total de corners | "over_8.5" o "under_8.5" | API stats → corner kicks |
| `goles_primer_tiempo` | Goles en el 1T | "over_1.5" o "under_1.5" | score.halftime |

---

<a name="5-prediction-service"></a>
## 5️⃣ PredictionService — CRUD de Dinámicas

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/BotCajeroServices/PredictionService.ts` | Crear, listar, cancelar dinámicas. Resolver ganadores. |
| `backend/src/services/BotCajeroServices/PredictionResolver.ts` | Lógica de resolución: comparar predicciones vs resultado real, determinar ganadores |

### Archivos a Modificar

Ninguno para el servicio base.

### PredictionService.ts — API Pública

```typescript
class PredictionService {
  // Crear dinámica a partir de un fixture y tipo
  async createPrediction(
    configId: number,
    fixtureId: number,
    predictionType: PredictionType,
    matchLabel: string,
    matchTime: string
  ): Promise<BotCajeroPrediction>;

  // Listar dinámicas activas (abiertas) para un config
  async listActivePredictions(configId: number): Promise<BotCajeroPrediction[]>;

  // Cancelar una dinámica
  async cancelPrediction(predictionId: number): Promise<void>;

  // Registrar predicción de un usuario
  async submitEntry(
    predictionId: number,
    userJid: string,
    userLabel: string,
    prediction: string
  ): Promise<BotCajeroPredictionEntry>;

  // Cerrar dinámica (cuando empieza el partido)
  async closePrediction(predictionId: number): Promise<void>;

  // Resolver dinámica con resultado real
  async resolvePrediction(
    predictionId: number,
    actualResult: string
  ): Promise<WinnerResult>;

  // Obtener entries de una dinámica
  async getEntries(predictionId: number): Promise<BotCajeroPredictionEntry[]>;
}

interface WinnerResult {
  predictionId: number;
  actualResult: string;
  winners: BotCajeroPredictionEntry[];
  totalEntries: number;
}
```

### PredictionResolver.ts

Lógica de resolución según tipo:

```typescript
class PredictionResolver {
  resolve(
    predictionType: PredictionType,
    entries: BotCajeroPredictionEntry[],
    matchResult: MatchResult
  ): WinnerResult {
    switch (predictionType) {
      case 'score_exacto':
        const actualScore = `${matchResult.goals.home}-${matchResult.goals.away}`;
        const winners = entries.filter(e => e.prediction === actualScore);
        return { actualResult: actualScore, winners, totalEntries: entries.length };

      case 'goles_totales':
        const totalGoals = matchResult.goals.home + matchResult.goals.away;
        const actualOverUnder = totalGoals > 2.5 ? 'over_2.5' : 'under_2.5';
        // También soportar over/under con valor exacto: "over_3.5"
        const winnersOU = entries.filter(e => {
          const [side, threshold] = e.prediction.split('_');
          const numThreshold = parseFloat(threshold);
          return side === 'over' ? totalGoals > numThreshold : totalGoals < numThreshold;
          // Si totalGoals === numThreshold, nadie gana (push)
        });
        return { actualResult: actualOverUnder, winners: winnersOU, totalEntries: entries.length };

      case 'goles_primer_tiempo':
        const htGoals = matchResult.score.halftime.home + matchResult.score.halftime.away;
        const actualHT = htGoals > 0.5 ? 'over_0.5' : 'under_0.5';
        // Similar a goles_totales pero con HT goals
        ...

      case 'esquinas_totales':
        // Obtener corners de MatchStats
        const totalCorners = parseInt(matchResult.stats.corners.home) + parseInt(matchResult.stats.corners.away);
        // Misma lógica over/under
        ...

      case 'primer_gol':
        // Requiere eventos del partido (API-Football events endpoint)
        // Por ahora: no resuelve automáticamente, marca como pendiente
        return { actualResult: 'pendiente_implementacion', winners: [], totalEntries: entries.length };
    }
  }
}
```

---

<a name="6-dinamica-comandos"></a>
## 6️⃣ /dinamica crear, list, cancel

### User Story

```
Como administrador,
quiero crear dinámicas de predicción para partidos específicos
para que los miembros puedan participar y ganar premios simbólicos.
```

### Archivos a Crear

Ninguno. Lógica en `PredictionService.ts`.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar cases: `/dinamica crear <búsqueda> <tipo>`, `/dinamica list`, `/dinamica cancel <id>` |

### Flujo Detallado

#### /dinamica crear <búsqueda> <tipo>

```
1. Admin escribe: "/dinamica crear Real Madrid score_exacto"
2. HandlePrivateCommand detecta "/dinamica crear":
   a. Extraer búsqueda y tipo:
      resto = "Real Madrid score_exacto"
      parts = resto.split(' ')
      tipo = parts.pop()                           // "score_exacto"
      busqueda = parts.join(' ')                    // "Real Madrid"
   b. Validar que tipo sea válido:
      tipos válidos: score_exacto, goles_totales, primer_gol, esquinas_totales, goles_primer_tiempo
      → Si no: "❌ Tipo inválido. Tipos: score_exacto, goles_totales, primer_gol, esquinas_totales, goles_primer_tiempo"
   c. Buscar fixtures en API-Football:
      fixtures = await FootballApiService.searchFixtures(busqueda)
      → Si no encuentra: "❌ No se encontraron partidos para '{búsqueda}'."
   d. Si encuentra, filtrar solo los que aún no han empezado (status = "NS"):
      disponibles = fixtures.filter(f => f.fixture.status.short === "NS")
   e. Si solo hay 1 resultado:
      → Crear dinámica directamente:
         "✅ Dinámica creada: {fixture.teams.home.name} vs {fixture.teams.away.name}
         Tipo: {tipo}
         ID: #{prediction.id}
         
         Los miembros pueden predecir con /predecir <valor>
         Ejemplo para score_exacto: /predecir 2-1"
   f. Si hay múltiples resultados:
      → Listar para que admin elija (sugerencia para v2: elegir el primero):
         "🔍 Se encontraron varios partidos:
         #{fixture.id} — {equipos} — {hora}
         Usa /dinamica crear con el fixture ID exacto."
      → Alternativa v1: elegir automáticamente el primero
   g. Crear BotCajeroLog eventType: 'prediction_created', detail: fixture info
```

#### /dinamica list

```
1. Admin escribe: "/dinamica list"
2. Buscar dinámicas activas (status = 'abierta') para esta config
3. Si no hay: "📋 No hay dinámicas activas."
4. Si hay:
   "📋 DINÁMICAS ACTIVAS
   
   #{id} — {matchLabel} — {tipo}
   ⏰ {matchTime} — {entriesCount} participantes
   ..."
5. Crear BotCajeroLog eventType: 'prediction_list'
```

#### /dinamica cancel <id>

```
1. Admin escribe: "/dinamica cancel 3"
2. Buscar dinámica por id + config
3. Si no existe: "❌ Dinámica no encontrada."
4. Si status !== 'abierta': "❌ La dinámica ya está {status}. No se puede cancelar."
5. status = 'cerrada' (con nota de cancelada)
6. Responder: "✅ Dinámica #{id} cancelada."
7. Crear BotCajeroLog eventType: 'prediction_cancelled'
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Crear dinámica | Admin escribe `/dinamica crear Real Madrid score_exacto` | Dinámica creada, ID asignado |
| QA2 | Tipo inválido | Admin escribe `/dinamica crear Real Madrid tipo_invalido` | Bot responde "❌ Tipo inválido" |
| QA3 | Sin resultados | Admin escribe `/dinamica crear EquipoFalso123 score_exacto` | Bot responde "❌ No se encontraron partidos" |
| QA4 | Listar dinámicas | `/dinamica list` con 3 dinámicas activas | Bot lista las 3 con IDs |
| QA5 | Cancelar dinámica | `/dinamica cancel 1` | Dinámica cancelada |
| QA6 | Cancelar ya cerrada | Cancelar dinámica en estado 'cerrada' | Bot responde "❌ Ya está cerrada" |

### Dependencias

- `PredictionService.ts` (feature #5)
- `BotCajeroPrediction` + `BotCajeroPredictionEntry` modelos
- `FootballApiService.searchFixtures()`

### Esfuerzo Estimado

**Medio** (~2-3 horas). Lógica CRUD + búsqueda de fixtures + validaciones.

---

<a name="7-predecir"></a>
## 7️⃣ /predecir — Registrar Predicción

### User Story

```
Como miembro del grupo,
quiero escribir /predecir <valor> en respuesta a un mensaje del bot sobre una dinámica
para registrar mi predicción y participar.
```

### Archivos a Crear

Ninguno.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/handlers/handleWhatsappEvents.ts` | Agregar detección de `/predecir` en mensajes de grupo (después de FAQ block, similar a group commands) |

### Flujo Detallado

Hay dos formas de implementar `/predecir`:

**Opción A (recomendada, simple):** El usuario menciona al bot con contexto de la dinámica.

```
1. Miembro escribe en el grupo: "@bot predecir 2-1"
2. GroupCommandHandler detecta "predecir":
   a. Extraer valor después de "predecir " (trim): "2-1"
   b. Si no hay valor: "🤖 Debes escribir cuál es tu predicción. Ej: @bot predecir 2-1"
   c. Buscar la dinámica ABIERTA más reciente para este grupo
      (suponiendo que solo hay 1 activa a la vez, o la más cercana en el tiempo)
      const prediction = await BotCajeroPrediction.findOne({
        where: { botCajeroConfigId: config.id, status: 'abierta' },
        order: [['matchTime', 'ASC']]
      })
   d. Si no hay dinámicas abiertas:
      "🤖 No hay dinámicas activas en este momento. Pregunta al administrador."
   e. Validar formato de predicción según tipo:
      - score_exacto: debe ser "X-Y" donde X e Y son números
      - goles_totales: "over_X" o "under_X"
      - etc.
   f. Si formato inválido: "🤖 Formato inválido para {tipo}. Ej: /predecir 2-1"
   g. Verificar que el usuario no haya predicho ya en esta dinámica:
      const existing = await BotCajeroPredictionEntry.findOne({
        where: { predictionId: prediction.id, userJid: senderJid }
      })
   h. Si ya existe: "🤖 Ya registraste tu predicción: {existing.prediction}. No puedes cambiarla."
   i. Si todo ok: crear entry
   j. Responder en el GRUPO (mencionando al usuario):
      "✅ @{userName} predicción registrada: {valor} para {matchLabel}"
   k. Crear BotCajeroLog eventType: 'prediction_submitted'
```

**Opción B (mejor UX):** El bot envía la dinámica al grupo, y los miembros responden a ESE mensaje con "/predecir valor". Pero detectar quoted messages requiere extraer `contextInfo.stanzaId` y mapearlo a un `predictionId`.

Para v1, ir con **Opción A** (más simple).

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Predecir válido | Miembro escribe `@bot predecir 2-1`, hay dinámica abierta tipo score_exacto | Predicción registrada, bot confirma |
| QA2 | Sin dinámica activa | Miembro escribe `@bot predecir 2-1`, no hay dinámicas | Bot responde "No hay dinámicas activas" |
| QA3 | Formato inválido | Miembro escribe `@bot predecir abc` en dinámica score_exacto | Bot responde "Formato inválido" |
| QA4 | Predicción duplicada | Miembro predice 2 veces para misma dinámica | Bot responde "Ya registraste tu predicción" |
| QA5 | Quiet mode | De noche, @bot predecir | Bot NO responde |

### Dependencias

- `PredictionService.submitEntry()`
- `GroupCommandHandler.ts` (feature v2.1)
- `BotCajeroPrediction` + `BotCajeroPredictionEntry` modelos

### Esfuerzo Estimado

**Medio** (~2-3 horas). Detección en handler + validación de formato según tipo + respuesta con mención.

---

<a name="8-frontend-dinamicas"></a>
## 8️⃣ Frontend: Tab Dinámicas (Opcional para MVP)

### User Story

```
Como administrador,
quiero ver y gestionar las dinámicas desde la interfaz web de BotCajero
para tener una visión general sin usar comandos.
```

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/BotCajero/index.js` | Agregar tab "⚽ Dinámicas" con tabla de dinámicas activas + historial |
| `backend/src/controllers/BotCajeroController.ts` | Agregar endpoints para listar predicciones desde la UI |

### Nuevos endpoints API

```
GET /api/bot-cajero/:whatsappId/predictions → Listar dinámicas (activas + historial)
GET /api/bot-cajero/predictions/:id/entries → Listar entries de una dinámica
```

### UI: Tab Dinámicas

```
┌──────────────────────────────────────────────────────────┐
│ ⚙️ Config │ ❓ FAQs │ 🛡️ Anti-Spam │ 🎨 Stickers │ 📋 Logs │ ⚽ Dinámicas │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 📋 DINÁMICAS ACTIVAS                        [+ Nueva]   │
│                                                          │
│ ID │ Partido           │ Tipo          │ Estado │ Acciones│
│ ───┼───────────────────┼───────────────┼────────┼────────│
│ 1  │ Real vs Barcelona │ score_exacto  │ 🟢 Abierta│ [👁️][🗑️]│
│    │ ⏰ 28/05 16:00    │ 8 participantes│        │        │
│    │                   │               │        │        │
│ 2  │ Liverpool vs Arsenal│ goles_total │ 🟢 Abierta│ [👁️][🗑️]│
│    │ ⏰ 28/05 14:00    │ 12 participantes│       │        │
│                                                          │
│ 📋 HISTORIAL                                             │
│ ID │ Partido           │ Tipo    │ Resultado │ Ganadores  │
│ ───┼───────────────────┼─────────┼───────────┼────────────│
│ 3  │ Boca vs River     │ score   │ 2-1       │ @user1     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Esfuerzo

**Medio** (~2-3 horas). Tabla simple con datos de predicciones. Opcional para MVP.

---

# SPRINT 3 — TRACKING EN VIVO

<a name="9-football-scheduler"></a>
## 9️⃣ FootballScheduler — Timer 3-5 Minutos

### User Story

```
Como administrador,
quiero que el bot monitoree los partidos con dinámicas activas cada pocos minutos
para detectar inicio, medio tiempo y final automáticamente.
```

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/BotCajeroServices/FootballScheduler.ts` | Timer que cada 3-5 minutos consulta live API y dispara eventos |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/server.ts` | Inicializar FootballScheduler al arrancar (si hay configs con dinámicas activas) |

### Flujo Detallado

```typescript
class FootballScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minutos

  start() {
    if (this.intervalId) return; // ya iniciado

    const tick = async () => {
      try {
        await this.checkActivePredictions();
      } catch (err) {
        logger.error({ info: "FootballScheduler tick error", error: (err as Error).message });
      }
    };

    // Ejecutar inmediatamente y luego cada 5 min
    tick();
    this.intervalId = setInterval(tick, this.POLL_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkActivePredictions() {
    // 1. Buscar configs con dinámicas abiertas o cerradas (no resueltas aún)
    const activePredictions = await BotCajeroPrediction.findAll({
      where: { status: ['abierta', 'cerrada'] },
      include: [{ model: BotCajeroConfig, required: true }]
    });

    if (activePredictions.length === 0) return;

    // 2. Agrupar por fixtureId (varias dinámicas pueden apuntar al mismo partido)
    const fixtureIds = [...new Set(activePredictions.map(p => p.fixtureId))];

    // 3. Para cada fixture, obtener estado actual
    for (const fixtureId of fixtureIds) {
      const fixtureData = await FootballApiService.getFixtureById(fixtureId);
      const status = fixtureData.fixture.status.short; // "NS", "1H", "HT", "2H", "FT"
      const goals = fixtureData.goals;
      const predictions = activePredictions.filter(p => p.fixtureId === fixtureId);
      const config = predictions[0].botCajeroConfig;

      // 4. Disparar eventos según estado
      await this.handleStatusChange(config, predictions, fixtureId, status, goals, fixtureData);
    }
  }
}
```

### Inicialización en server.ts

```typescript
import { FootballScheduler } from "./services/BotCajeroServices/FootballScheduler";

// Después de inicializar todo:
const footballScheduler = new FootballScheduler();

// Solo iniciar si hay FOOTBALL_API_KEY configurada
if (process.env.FOOTBALL_API_KEY) {
  footballScheduler.start();
  logger.info("FootballScheduler started (5min interval)");
}
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Scheduler se inicia | Servidor arranca con FOOTBALL_API_KEY | FootballScheduler.start() ejecutado |
| QA2 | Scheduler no inicia sin API key | Servidor arranca sin FOOTBALL_API_KEY | FootballScheduler NO se inicia |
| QA3 | Scheduler sin dinámicas | No hay dinámicas activas | checkActivePredictions retorna sin hacer requests |

### Dependencias

- `FootballApiService.getFixtureById()`
- `BotCajeroPrediction.findAll({ where: { status: ['abierta', 'cerrada'] } })`

### Esfuerzo Estimado

**Medio** (~2-3 horas). Timer + lógica de agrupación por fixture + dispatching de eventos.

---

<a name="10-deteccion-inicio"></a>
## 1️⃣0️⃣ Detección de Inicio → Cerrar Dinámicas

### Flujo Detallado

Dentro de `FootballScheduler.handleStatusChange()`:

```
Cuando status cambia de "NS" (Not Started) a "1H" (First Half) o "Live":

1. Obtener dinámicas activas (status='abierta') para este fixture
2. Si no hay → salir
3. Para cada dinámica:
   a. Cambiar status a 'cerrada'
   b. Guardar en DB
4. Verificar Redis flag: "botcajero:matchalert:{fixtureId}:start"
   → Si ya se envió → salir
5. Enviar al GRUPO:
   "⏰ ¡EMPEZÓ!
   ⚽ {matchLabel}
   🎯 Las predicciones están cerradas para este partido.
   
   ¡Suerte a los {N} participantes!"
6. Guardar Redis flag: setex("botcajero:matchalert:{fixtureId}:start", 86400, "1")
7. Crear BotCajeroLog eventType: 'match_started'
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Inicio detectado | Partido pasa de NS a 1H, hay dinámicas | Dinámicas cerradas, bot avisa al grupo |
| QA2 | Sin dinámicas | Partido empieza, no hay dinámicas | Bot no hace nada |
| QA3 | No duplica alerta | Scheduler corre 2 veces seguidas con mismo estado | Solo 1 alerta se envía (Redis flag) |

### Esfuerzo

**Medio** (~1-2 horas). Lógica dentro del scheduler.

---

<a name="11-alerta-ht"></a>
## 1️⃣1️⃣ Alerta HT con Estadísticas

### Flujo Detallado

Dentro de `FootballScheduler.handleStatusChange()`:

```
Cuando status cambia a "HT" (Half Time):

1. Verificar que hay dinámicas activas/cerradas para este fixture
2. Verificar Redis flag: "botcajero:matchalert:{fixtureId}:ht"
   → Si ya se envió → salir
3. Obtener estadísticas del partido (si hay dinámicas de esquinas):
   const stats = await FootballApiService.getFixtureStatistics(fixtureId)
4. Enviar al GRUPO:
   "📊 MEDIO TIEMPO
   ⚽ {matchLabel}
   🥅 {goals.home} - {goals.away}
   
   📈 Estadísticas:
   ⚡ Posesión: {home}% - {away}%
   🎯 Tiros: {home} - {away}
   🥅 A puerta: {home} - {away}
   🏁 Esquinas: {home} - {away}
   🟡 Tarjetas: {home} - {away}
   
   Quedan 45 minutos. ¡Que gane el mejor!"
5. Guardar Redis flag: setex("botcajero:matchalert:{fixtureId}:ht", 86400, "1")
6. Crear BotCajeroLog eventType: 'match_halftime'
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | HT detectado | Partido llega a HT, hay dinámicas | Bot envía stats al grupo |
| QA2 | Sin stats | API de stats falla | Bot envía HT sin stats (solo score) |
| QA3 | No duplica | 2 ticks seguidos en HT | Solo 1 alerta |

### Esfuerzo

**Bajo** (~1 hora). Formateo de stats + envío.

---

<a name="12-alerta-ft"></a>
## 1️⃣2️⃣ Alerta FT + Resolución de Ganadores

### Flujo Detallado

Dentro de `FootballScheduler.handleStatusChange()`:

```
Cuando status cambia a "FT" (Match Finished) o "AET" (After Extra Time) o "PEN" (Penalty):

1. Verificar Redis flag: "botcajero:matchalert:{fixtureId}:ft"
   → Si ya se envió → salir
2. Obtener dinámicas en estado 'cerrada' para este fixture
3. Para cada dinámica:
   a. Obtener resultado real según tipo:
      - score_exacto: goals.fulltime → "${home}-${away}"
      - goles_totales: total = home+away
      - goles_primer_tiempo: score.halftime.home + score.halftime.away
      - esquinas_totales: obtener de API stats
   b. Llamar PredictionResolver.resolve(tipo, entries, resultado)
   c. Obtener winners
4. Enviar al GRUPO:
   "🏁 ¡FINAL DEL PARTIDO!
   ⚽ {matchLabel}
   🥅 {goals.home} - {goals.away}
   
   ---
   
   RESOLVIENDO DINÁMICAS...
   
   🎯 score_exacto
   Resultado real: {score}
   
   Ganadores ({N} de {M} acertaron):
   🏆 @user1 — {predicción}
   🏆 @user2 — {predicción}
   
   ---
   
   🎯 goles_totales
   Resultado real: over_2.5 ({totalGoals} goles)
   
   Ganadores ({N}):
   🏆 @user3
   
   ¡Felicidades a todos los ganadores! 🥳"
5. Para cada dinámica: status = 'resuelta', result = resultadoReal
6. Guardar Redis flag: setex("botcajero:matchalert:{fixtureId}:ft", 86400, "1")
7. Crear BotCajeroLog eventType: 'match_finished' y 'prediction_resolved'
```

**Menciones a ganadores:** Usar `mentions: [winner.jid for each winner]` en sendMessage (mismo soporte que /sorteo y /warn). Si hay más de 5 ganadores, mencionar solo los primeros 5 y agregar "y {N} más".

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | FT detectado | Partido termina, hay dinámicas cerradas | Bot resuelve y anuncia ganadores |
| QA2 | Sin ganadores | Nadie acertó la predicción | Bot anuncia "No hubo ganadores en esta dinámica" |
| QA3 | Múltiples dinámicas | score_exacto + goles_totales para mismo partido | Ambas se resuelven correctamente |
| QA4 | Sin dinámicas | Partido termina, no hay dinámicas | Bot no hace nada |
| QA5 | No duplica | Scheduler corre 2 veces en FT | Solo 1 resolución |

### Dependencias

- `PredictionResolver.ts` (feature #5)
- `FootballApiService.getFixtureById()` + `getFixtureStatistics()`
- Soporte de `mentions[]` en `sendMessage` (mismo que /sorteo v3.2)

### Esfuerzo

**Medio-Alto** (~3-4 horas). Lógica de resolución por tipo, menciones múltiples, formateo complejo.

---

## Tabla Resumen Global

| Sprint | # | Feature | Archivos nuevos | Archivos modificados | Esfuerzo |
|:------:|:-:|---------|:---------------:|:--------------------:|:--------:|
| **1** | 1 | API-Football Service | 1 | 1 | 🟡 2-3h |
| **1** | 2 | /partidos + @bot partidos | 0 | 2 | 🟢 1h |
| **1** | 3 | Push nocturno 21:00 | 0 | 2 | 🟡 2-3h |
| **2** | 4 | Modelos Prediction + Entry | 0 (migraciones) | 0 | 🟢 1h |
| **2** | 5 | PredictionService | 2 | 0 | 🟡 2-3h |
| **2** | 6 | /dinamica crear/list/cancel | 0 | 1 | 🟡 2-3h |
| **2** | 7 | /predecir | 0 | 1 | 🟡 2-3h |
| **2** | 8 | Frontend Dinámicas | 0 | 2 | 🟡 2-3h |
| **3** | 9 | FootballScheduler | 1 | 1 | 🟡 2-3h |
| **3** | 10 | Detección inicio → cerrar | 0 | 0 | 🟡 1-2h |
| **3** | 11 | Alerta HT + stats | 0 | 0 | 🟢 1h |
| **3** | 12 | Alerta FT + resolución | 0 | 0 | 🟡🔴 3-4h |

### Totales
- **Archivos nuevos**: 4 (FootballApiService, PredictionService, PredictionResolver, FootballScheduler)
- **Migraciones**: 2 (predictions, entries)
- **Archivos modificados**: ~10 (HandlePrivateCommand, GroupCommandHandler, server.ts, handleWhatsappEvents, etc.)
- **Esfuerzo total**: ~18-26 horas (3 sprints de ~6h cada uno)

### Dependencia externa clave
- API-Football via RapidAPI: se requiere key en variable de entorno `FOOTBALL_API_KEY`
- Free tier: 100 req/día. Con cache Redis 30 min, se consumen ~48 req/día en fixtures. Live tracking agrega ~12-24 req/día adicionales. Total ~72 req/día — dentro del free tier.

---

*Documento generado el 2026-05-28. BotCajero v4 — Fútbol, Predicciones y Tracking en Vivo. WhaTicket Community Edition.*
