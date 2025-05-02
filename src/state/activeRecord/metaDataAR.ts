import path from 'path';
import { SQLiteConnection } from '../db/sqliteConnection';
import { SQLiteExecutor } from '../../services/sqlite/SQLiteExecutor';

export interface MetaDataARInterface {
  id: string,
  name: string,
  description: string,
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