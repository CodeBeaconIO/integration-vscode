import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { RemoteTracingService } from '../../../../components/remoteTracing';
import { IConfig } from '../../../../config';

suite('RemoteTracingService', () => {
  let service: RemoteTracingService;
  let tempDir: string;
  let configPath: string;
  let mockConfig: IConfig;

  setup(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(__dirname, 'test-'));
    configPath = path.join(tempDir, 'tracer_config.yml');
    
    // Create mock config
    mockConfig = {
      getSqliteBinaryPath: () => '',
      getDataDir: () => tempDir,
      getDbDir: () => '',
      getDbPath: () => '',
      getRefreshPath: () => '',
      getRootDir: () => '',
      getPathsPath: () => '',
      getTracingEnabled: () => true,
      getRemoteTracingConfigPath: () => configPath,
      getRemoteTracingEnabled: () => false,
      setRemoteTracingEnabled: async () => {}
    };

    service = new RemoteTracingService(mockConfig);
  });

  teardown(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should initialize with default configuration', async () => {
    const config = await service.getCurrentConfig();
    
    assert.strictEqual(config.tracing_enabled, false);
    assert.strictEqual(config.source, 'vscode-extension');
    assert.strictEqual(config.version, '1.0');
    assert.ok(config.filters);
    assert.ok(Array.isArray(config.filters.include_paths));
    assert.ok(Array.isArray(config.filters.exclude_patterns));
  });

  test('should enable tracing', async () => {
    const initiallyEnabled = await service.isTracingEnabled();
    assert.strictEqual(initiallyEnabled, false);

    await service.enableTracing();
    
    const nowEnabled = await service.isTracingEnabled();
    assert.strictEqual(nowEnabled, true);
  });

  test('should disable tracing', async () => {
    // First enable it
    await service.enableTracing();
    assert.strictEqual(await service.isTracingEnabled(), true);

    // Then disable it
    await service.disableTracing();
    assert.strictEqual(await service.isTracingEnabled(), false);
  });

  test('should toggle tracing state', async () => {
    const initialState = await service.isTracingEnabled();
    
    const newState = await service.toggleTracing();
    assert.strictEqual(newState, !initialState);
    
    const currentState = await service.isTracingEnabled();
    assert.strictEqual(currentState, newState);
  });

  test('should validate configuration', async () => {
    const isValid = await service.validateConfiguration();
    assert.strictEqual(isValid, true);
  });

  test('should return correct config path', () => {
    const returnedPath = service.getConfigPath();
    assert.strictEqual(returnedPath, configPath);
  });
}); 