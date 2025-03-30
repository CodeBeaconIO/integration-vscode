import * as assert from 'assert';
import * as vscode from 'vscode';
import { Config } from '../config';

suite('Config Test Suite', () => {
  let mockWorkspaceConfig: vscode.WorkspaceConfiguration;
  let config: Config;

  setup(() => {
    mockWorkspaceConfig = {
      get: (key: string, defaultValue: string) => {
        switch (key) {
          case 'code-beacon.rootDir':
            return '/test/root';
          case 'code-beacon.dataDir':
            return 'data';
          default:
            return defaultValue;
        }
      }
    } as vscode.WorkspaceConfiguration;

    config = new Config(mockWorkspaceConfig);
  });

  test('should return correct root directory', () => {
    assert.strictEqual(config.getRootDir(), '/test/root');
  });

  test('should return correct data directory', () => {
    assert.strictEqual(config.getDataDir(), '/test/root/data');
  });

  test('should return correct db directory', () => {
    assert.strictEqual(config.getDbDir(), '/test/root/data/db');
  });

  test('should return correct db path', () => {
    assert.strictEqual(config.getDbPath(), '/test/root/data/db/codebeacon_tracer.db');
  });

  test('should return correct refresh path', () => {
    assert.strictEqual(config.getRefreshPath(), '/test/root/data/tmp/refresh');
  });

  test('should return correct paths path', () => {
    assert.strictEqual(config.getPathsPath(), '/test/root/data/paths.yml');
  });

  test('should default getRootDir to cwd', () => {
    const emptyConfig = {
      get: (key: string, defaultValue: string) => {
        switch (key) {
          case 'code-beacon.rootDir':
            return defaultValue;
        }
      }
    } as vscode.WorkspaceConfiguration;

    const configWithDefaults = new Config(emptyConfig);
    assert.strictEqual(configWithDefaults.getRootDir(), process.cwd());
  });

  test('should default getDataDir to [root]/.code-beacon', () => {
    const emptyConfig = {
      get: (key: string, defaultValue: string) => {
        switch (key) {
          case 'code-beacon.rootDir':
            return '/test/root';
          case 'code-beacon.dataDir':
            return defaultValue;
        }
      }
    } as vscode.WorkspaceConfiguration;

    const configWithDefaults = new Config(emptyConfig);
    assert.strictEqual(configWithDefaults.getDataDir(), '/test/root/.code-beacon');
  });
});
