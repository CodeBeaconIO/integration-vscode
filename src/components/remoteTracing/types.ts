/**
 * Configuration structure for remote tracing communication
 */
export interface TracerConfig {
  tracing_enabled: boolean;
  last_updated: string;
  source: string;
  version: string;
  filters?: TracerFilters;
}

/**
 * Filtering options for remote tracing
 */
export interface TracerFilters {
  include_paths?: string[];
  exclude_patterns?: string[];
  recording_meta_exclude?: MetaExcludeRule[];
}

/**
 * Default configuration values
 */
export const DEFAULT_TRACER_CONFIG: TracerConfig = {
  tracing_enabled: false,
  last_updated: new Date().toISOString(),
  source: 'vscode-extension',
  version: '1.1',
  filters: {
    include_paths: ['app/', 'lib/'],
    exclude_patterns: ['*_spec.rb', '*_test.rb'],
    recording_meta_exclude: []
  }
};

/**
 * Configuration file name
 */
export const TRACER_CONFIG_FILENAME = 'tracer_config.yml';

export interface MetaExcludeRule {
  name: string;
  description: string;
} 