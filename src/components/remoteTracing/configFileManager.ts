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
   * Throws error if file is invalid
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
      
      let parsedConfig: unknown;
      try {
        parsedConfig = yaml.load(yamlContent);
      } catch (yamlError) {
        throw new Error(`Invalid YAML syntax: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`);
      }
      
      // Basic validation
      if (!parsedConfig || typeof parsedConfig !== 'object') {
        throw new Error('Configuration must be a valid object');
      }

      const configObj = parsedConfig as Record<string, unknown>;
      
      if (typeof configObj.tracing_enabled !== 'boolean') {
        throw new Error('tracing_enabled must be a boolean (true or false)');
      }

      // Return valid config with defaults for missing fields
      return {
        tracing_enabled: configObj.tracing_enabled,
        last_updated: typeof configObj.last_updated === 'string' ? configObj.last_updated : new Date().toISOString(),
        source: typeof configObj.source === 'string' ? configObj.source : 'vscode-extension',
        version: typeof configObj.version === 'string' ? configObj.version : '1.1',
        filters: this.parseFilters(configObj.filters)
      };
      
    } catch (error) {
      throw error;
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
   * Creates a valid example configuration file
   */
  async createExampleConfig(): Promise<string> {
    const examplePath = `${this.configPath}.example`;
    const exampleConfig: TracerConfig = {
      ...DEFAULT_TRACER_CONFIG,
      last_updated: new Date().toISOString()
    };

    const yamlContent = yaml.dump(exampleConfig, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });

    // Add helpful comments
    const commentedYaml = `# Code Beacon Remote Tracing Configuration
# This file controls communication between VS Code extension and Ruby gem
#
# tracing_enabled: Enable/disable remote tracing
# last_updated: Timestamp of last modification (auto-updated)
# source: Source of the configuration change (auto-updated)
# version: Configuration format version
# filters: Control which files/patterns to include/exclude

${yamlContent}`;

    try {
      const exampleUri = vscode.Uri.file(examplePath);
      await vscode.workspace.fs.writeFile(exampleUri, Buffer.from(commentedYaml, 'utf8'));
      return examplePath;
    } catch (error) {
      throw new Error(`Failed to create example config: ${error}`);
    }
  }

  /**
   * Parse filters with basic validation
   */
  private parseFilters(filters: unknown): TracerConfig['filters'] {
    if (!filters || typeof filters !== 'object') {
      return DEFAULT_TRACER_CONFIG.filters;
    }

    const filtersObj = filters as Record<string, unknown>;
    
    return {
      include_paths: Array.isArray(filtersObj.include_paths) ? filtersObj.include_paths as string[] : DEFAULT_TRACER_CONFIG.filters?.include_paths,
      exclude_patterns: Array.isArray(filtersObj.exclude_patterns) ? filtersObj.exclude_patterns as string[] : DEFAULT_TRACER_CONFIG.filters?.exclude_patterns,
      recording_meta_exclude: Array.isArray(filtersObj.recording_meta_exclude)
        ? (filtersObj.recording_meta_exclude as unknown[])
            .filter((r): r is { name: string; description: string } =>
              typeof r === 'object' && r !== null &&
              typeof (r as { name?: unknown }).name === 'string' &&
              typeof (r as { description?: unknown }).description === 'string')
            .map(r => ({ name: r.name, description: r.description }))
        : DEFAULT_TRACER_CONFIG.filters?.recording_meta_exclude
    };
  }
} 