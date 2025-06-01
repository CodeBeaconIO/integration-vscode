import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { TracerConfig, DEFAULT_TRACER_CONFIG } from './types';

/**
 * Manages reading and writing of the remote tracing configuration file
 */
export class ConfigFileManager {
  private readonly configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * Reads the configuration file and returns parsed config
   * Creates default config if file doesn't exist
   */
  async readConfig(): Promise<TracerConfig> {
    try {
      const configUri = vscode.Uri.file(this.configPath);
      
      // Check if file exists
      try {
        await vscode.workspace.fs.stat(configUri);
      } catch (error) {
        // File doesn't exist, create default config
        await this.writeConfig(DEFAULT_TRACER_CONFIG);
        return DEFAULT_TRACER_CONFIG;
      }

      // Read and parse the file
      const fileContent = await vscode.workspace.fs.readFile(configUri);
      const yamlContent = Buffer.from(fileContent).toString('utf8');
      
      const parsedConfig = yaml.load(yamlContent) as TracerConfig;
      
      // Validate and merge with defaults
      return this.validateAndMergeConfig(parsedConfig);
      
    } catch (error) {
      console.error('Error reading tracer config:', error);
      // Return default config on error
      return DEFAULT_TRACER_CONFIG;
    }
  }

  /**
   * Writes configuration to file
   */
  async writeConfig(config: TracerConfig): Promise<void> {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      const configDirUri = vscode.Uri.file(configDir);
      
      try {
        await vscode.workspace.fs.stat(configDirUri);
      } catch (error) {
        // Directory doesn't exist, create it
        await vscode.workspace.fs.createDirectory(configDirUri);
      }

      // Update timestamp and source
      const configToWrite: TracerConfig = {
        ...config,
        last_updated: new Date().toISOString(),
        source: 'vscode-extension'
      };

      // Convert to YAML and write
      const yamlContent = yaml.dump(configToWrite, {
        indent: 2,
        lineWidth: 80,
        noRefs: true
      });

      const configUri = vscode.Uri.file(this.configPath);
      await vscode.workspace.fs.writeFile(configUri, Buffer.from(yamlContent, 'utf8'));
      
    } catch (error) {
      console.error('Error writing tracer config:', error);
      throw new Error(`Failed to write tracer configuration: ${error}`);
    }
  }

  /**
   * Updates only the tracing enabled status
   */
  async updateTracingEnabled(enabled: boolean): Promise<void> {
    const currentConfig = await this.readConfig();
    currentConfig.tracing_enabled = enabled;
    await this.writeConfig(currentConfig);
  }

  /**
   * Validates configuration and merges with defaults
   */
  private validateAndMergeConfig(config: unknown): TracerConfig {
    if (!config || typeof config !== 'object') {
      return DEFAULT_TRACER_CONFIG;
    }

    const configObj = config as Record<string, unknown>;

    return {
      tracing_enabled: typeof configObj.tracing_enabled === 'boolean' ? configObj.tracing_enabled : DEFAULT_TRACER_CONFIG.tracing_enabled,
      last_updated: typeof configObj.last_updated === 'string' ? configObj.last_updated : DEFAULT_TRACER_CONFIG.last_updated,
      source: typeof configObj.source === 'string' ? configObj.source : DEFAULT_TRACER_CONFIG.source,
      version: typeof configObj.version === 'string' ? configObj.version : DEFAULT_TRACER_CONFIG.version,
      filters: this.validateFilters(configObj.filters)
    };
  }

  /**
   * Validates filter configuration
   */
  private validateFilters(filters: unknown): TracerConfig['filters'] {
    if (!filters || typeof filters !== 'object') {
      return DEFAULT_TRACER_CONFIG.filters;
    }

    const filtersObj = filters as Record<string, unknown>;

    return {
      include_paths: Array.isArray(filtersObj.include_paths) ? filtersObj.include_paths : DEFAULT_TRACER_CONFIG.filters?.include_paths,
      exclude_patterns: Array.isArray(filtersObj.exclude_patterns) ? filtersObj.exclude_patterns : DEFAULT_TRACER_CONFIG.filters?.exclude_patterns
    };
  }
} 