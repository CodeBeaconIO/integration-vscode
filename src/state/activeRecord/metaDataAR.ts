import sqlite3 from 'sqlite3';
import path from 'path';
import SQLite3Connection from '../db/sqlite3Connection';

export interface MetaDataARInterface {
  id: string,
  name: string,
  description: string,
  dbPath: string,
  dbBasename: string
}

export class MetaDataAR {
  private static _db: sqlite3.Database;
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

  private static db(): sqlite3.Database {
    if (MetaDataAR._db) {
      return this._db;
    } else {
      this._db = SQLite3Connection.getDatabase();
      return this._db;
    }
  }

  public static reconnectDb(testDb?: sqlite3.Database): void {
    this._db = testDb || SQLite3Connection.getDatabase();
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

  public findById(id: number): Promise<MetaDataARInterface> {
    const query = `SELECT * FROM metadata WHERE id = '${id}'`;
    return this._get(query);
  }

  private _get(query: string): Promise<MetaDataARInterface> {
    return new Promise((resolve, reject) => {
      MetaDataAR.db().get<MetaDataARInterface>(query, (err: Error | null, row: MetaDataARInterface) => {
        if (err) {
          console.error('Error fetching metadata from the database: ' + err.message);
          reject(err);
        }
        if (row) {
          row.dbPath = this.dbPath;
          row.dbBasename = this._dbBasename;
          resolve(row);
        } else {
          reject(null);
        }
      });
    });
  }
}