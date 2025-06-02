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
    
    // Ensure no config file exists at start of each test
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    
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

  test('should validate configuration', async () => {
    const isValid = await service.validateConfiguration();
    assert.strictEqual(isValid, true);
  });

  test('should return correct config path', () => {
    const returnedPath = service.getConfigPath();
    assert.strictEqual(returnedPath, configPath);
  });

  test('should handle invalid YAML syntax gracefully', async () => {
    // Write invalid YAML to the config file
    const invalidYaml = `
tracing_enabled: true
invalid_yaml: [unclosed array
version: "1.0"
`;
    fs.writeFileSync(configPath, invalidYaml);

    // Should throw error when trying to read config
    await assert.rejects(
      async () => await service.getCurrentConfig(),
      (error: Error) => error.message.includes('Invalid YAML syntax')
    );

    // isTracingEnabled should return false for invalid config
    const isEnabled = await service.isTracingEnabled();
    assert.strictEqual(isEnabled, false);

    // validateConfiguration should return false
    const isValid = await service.validateConfiguration();
    assert.strictEqual(isValid, false);
  });

  test('should handle invalid configuration structure gracefully', async () => {
    // Write valid YAML but invalid structure
    const invalidConfig = `
tracing_enabled: "not_a_boolean"
version: 123
source: true
`;
    fs.writeFileSync(configPath, invalidConfig);

    // Should throw error when trying to read config
    await assert.rejects(
      async () => await service.getCurrentConfig(),
      (error: Error) => error.message.includes('tracing_enabled must be a boolean')
    );

    // isTracingEnabled should return false for invalid config
    const isEnabled = await service.isTracingEnabled();
    assert.strictEqual(isEnabled, false);

    // validateConfiguration should return false
    const isValid = await service.validateConfiguration();
    assert.strictEqual(isValid, false);
  });

  test('should create example configuration', async () => {
    // Clean up any existing config file to ensure clean state
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    
    const examplePath = await service.createExampleConfig();
    
    // Check that example file was created
    assert.ok(fs.existsSync(examplePath));
    
    // Check that example file contains valid YAML
    const exampleContent = fs.readFileSync(examplePath, 'utf8');
    
    assert.ok(exampleContent.includes('tracing_enabled: false'));
    assert.ok(exampleContent.includes('version: \'1.0\'') || exampleContent.includes('version: "1.0"'));
    assert.ok(exampleContent.includes('# Code Beacon Remote Tracing Configuration'));
  });
}); 