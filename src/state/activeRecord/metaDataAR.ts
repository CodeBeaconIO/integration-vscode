import path from 'path';
import { SQLiteConnection } from '../db/sqliteConnection';
import { SQLiteExecutor } from '../../services/sqlite/SQLiteExecutor';

export interface MetaDataARInterface {
  id: string,
  name: string,
  description: string,
  caller_file: string,
  caller_method: string,
  caller_line: string,
  caller_class: string,
  start_time: string,
  end_time: string,
  duration_ms: string,
  trigger_type: string,
  dbPath: string,
  dbBasename: string
}

export class MetaDataAR {
  private static _executor: SQLiteExecutor;
  private static _all: Map<string, MetaDataAR> = new Map(); // These are inserted in a particular order (by id)
  private _row: MetaDataARInterface;
  private dbPath: string;
  private _dbBasename: string;
  
  constructor(
    dbPath: string
  ) {
    this.dbPath = dbPath;
    this._dbBasename = path.basename(dbPath);
    this._row = {
      id: '',
      name: '',
      description: '',
      caller_file: '',
      caller_method: '',
      caller_line: '',
      caller_class: '',
      start_time: '',
      end_time: '',
      duration_ms: '',
      trigger_type: '',
      dbPath: this.dbPath,
      dbBasename: this._dbBasename
    };
  }

  private static executor(): SQLiteExecutor {
    if (MetaDataAR._executor) {
      return this._executor;
    } else {
      this._executor = SQLiteConnection.getExecutor();
      return this._executor;
    }
  }

  public static reconnectDb(testExecutor?: SQLiteExecutor): void {
    this._executor = testExecutor || SQLiteConnection.getExecutor();
  }

  public get id(): string {
    return this._row.id;
  }
  
  public get name(): string {
    return this._row.name;
  }

  public get description(): string {
    return this._row.description;
  }

  public get callerFile(): string {
    return this._row.caller_file;
  }

  public get callerMethod(): string {
    return this._row.caller_method;
  }

  public get callerLine(): string {
    return this._row.caller_line;
  }

  public get callerClass(): string {
    return this._row.caller_class;
  }

  public get startTime(): string {
    return this._row.start_time;
  }

  public get endTime(): string {
    return this._row.end_time;
  }

  public get durationMs(): string {
    return this._row.duration_ms;
  }

  public get triggerType(): string {
    return this._row.trigger_type;
  }

  public get dbBasename(): string {
    return this._dbBasename;
  }

  public async findById(id: string | number): Promise<MetaDataARInterface> {
    const query = `SELECT * FROM metadata WHERE id = ?`;
    return this._get(query, [id.toString()]);
  }

  private async _get(query: string, params: (string | number | boolean | null)[] = []): Promise<MetaDataARInterface> {
    try {
      const row = await MetaDataAR.executor().get<Omit<MetaDataARInterface, 'dbPath' | 'dbBasename'>>(query, params);
      if (row) {
        return {
          ...row,
          dbPath: this.dbPath,
          dbBasename: this._dbBasename
        };
      } else {
        throw null;
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error fetching metadata from the database: ' + err.message);
        throw err;
      } else {
        throw null;
      }
    }
  }
}