/**
 * Databasen bakom spelet. Det här är det enda stället med SQL, så att
 * handleAction och motorns regler går att testa utan databas.
 *
 * Varje ändring görs i en transaktion. Vyerna skickas med realtime.send i
 * samma transaktion, och Supabase skickar dem först när transaktionen är
 * sparad. En vy kan därför aldrig gå ut för ett tillstånd som inte finns.
 */

import { VIEW_EVENT, getPlayerTopic } from './channels.ts';
import { type GameRecord, type GameState, type PlayerRecord, readGameState } from './state.ts';

/** Den del av postgres-bibliotekets sql som spelet använder. */
export type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): PromiseLike<readonly Record<string, unknown>[]>;
  begin<T>(work: (transaction: Sql) => Promise<T>): Promise<T>;
};

export type GameTransaction = {
  /** Ger null om koden redan används, så att en ny kan provas. */
  insertGame(game: { joinCode: string; missionId: string; state: GameState }): Promise<GameRecord | null>;
  /** Låser spelets rad till transaktionens slut, så att ändringarna sker en i taget. */
  lockGameByCode(joinCode: string): Promise<GameRecord | null>;
  lockGameById(gameId: string): Promise<GameRecord | null>;
  updateGameState(gameId: string, state: GameState): Promise<void>;
  listPlayers(gameId: string): Promise<PlayerRecord[]>;
  insertPlayer(player: { gameId: string; userId: string; name: string; isLeader: boolean }): Promise<PlayerRecord>;
  deletePlayer(playerId: string): Promise<void>;
  logEvent(event: { gameId: string; playerId: string | null; action: object }): Promise<void>;
  sendView(playerId: string, view: object): Promise<void>;
};

export type GameStore = {
  readServerTimeMs(): Promise<number>;
  transaction<T>(work: (transaction: GameTransaction) => Promise<T>): Promise<T>;
};

/**
 * JSON skickas som text och görs om till jsonb i databasen. Med bara ::jsonb
 * kodar postgres-biblioteket texten en gång till, och då sparas en sträng i
 * stället för ett objekt.
 */
function toJsonText(value: object): string {
  return JSON.stringify(value);
}

/** Ett id som inte är ett uuid ska ge "finns inte", inte ett fel i databasen. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toGameRecord(row: Record<string, unknown>): GameRecord {
  return {
    id: String(row.id),
    joinCode: String(row.join_code),
    missionId: String(row.mission_id),
    state: readGameState(row.state),
  };
}

function toPlayerRecord(row: Record<string, unknown>): PlayerRecord {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    userId: String(row.user_id),
    name: String(row.name),
    isLeader: Boolean(row.is_leader),
    joinedAtMs: new Date(row.joined_at as string | Date).getTime(),
  };
}

function createTransaction(sql: Sql): GameTransaction {
  return {
    async insertGame({ joinCode, missionId, state }) {
      const [row] = await sql`
        insert into engine.games (join_code, mission_id, state)
        values (${joinCode}, ${missionId}, ${toJsonText(state)}::text::jsonb)
        on conflict (join_code) do nothing
        returning id, join_code, mission_id, state`;
      return row ? toGameRecord(row) : null;
    },
    async lockGameByCode(joinCode) {
      const [row] = await sql`
        select id, join_code, mission_id, state from engine.games
        where join_code = ${joinCode} for update`;
      return row ? toGameRecord(row) : null;
    },
    async lockGameById(gameId) {
      if (!UUID_PATTERN.test(gameId)) return null;
      const [row] = await sql`
        select id, join_code, mission_id, state from engine.games
        where id = ${gameId} for update`;
      return row ? toGameRecord(row) : null;
    },
    async updateGameState(gameId, state) {
      await sql`
        update engine.games set state = ${toJsonText(state)}::text::jsonb, updated_at = now()
        where id = ${gameId}`;
    },
    async listPlayers(gameId) {
      const rows = await sql`
        select id, game_id, user_id, name, is_leader, joined_at from engine.players
        where game_id = ${gameId} order by joined_at`;
      return rows.map(toPlayerRecord);
    },
    async insertPlayer({ gameId, userId, name, isLeader }) {
      const [row] = await sql`
        insert into engine.players (game_id, user_id, name, is_leader)
        values (${gameId}, ${userId}, ${name}, ${isLeader})
        returning id, game_id, user_id, name, is_leader, joined_at`;
      return toPlayerRecord(row);
    },
    async deletePlayer(playerId) {
      await sql`delete from engine.players where id = ${playerId}`;
    },
    async logEvent({ gameId, playerId, action }) {
      await sql`
        insert into engine.events (game_id, player_id, action)
        values (${gameId}, ${playerId}, ${toJsonText(action)}::text::jsonb)`;
    },
    async sendView(playerId, view) {
      // Sista argumentet gör meddelandet privat, så att kanalens regler gäller.
      await sql`select realtime.send(${toJsonText(view)}::text::jsonb, ${VIEW_EVENT}, ${getPlayerTopic(playerId)}, true)`;
    },
  };
}

export function createGameStore(sql: Sql): GameStore {
  return {
    async readServerTimeMs() {
      // Databasens klocka är spelets klocka, eftersom handlingarna stämplas där.
      const [row] = await sql`select clock_timestamp() as server_time`;
      return new Date(row.server_time as string | Date).getTime();
    },
    transaction: (work) => sql.begin((transactionSql) => work(createTransaction(transactionSql))),
  };
}
