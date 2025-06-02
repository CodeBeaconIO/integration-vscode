/**
 * Remote Tracing Module
 * 
 * Provides file-based communication between VS Code extension and Ruby gem
 * for controlling remote tracing functionality.
 */

export { RemoteTracingService } from './remoteTracingService';
export { ConfigFileManager } from './configFileManager';
export { StatusBarProvider } from './statusBarProvider';
export { TreeViewActions } from './treeViewActions';
export { CommandHandlers } from './commandHandlers';
export { ConfigFileWatcher } from './configFileWatcher';
export { 
  TracerConfig, 
  TracerFilters, 
  DEFAULT_TRACER_CONFIG, 
  TRACER_CONFIG_FILENAME 
} from './types'; 