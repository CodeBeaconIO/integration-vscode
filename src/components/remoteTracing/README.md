# Remote Tracing Module

This module provides file-based communication between the VS Code extension and the Ruby tracer gem for controlling remote tracing functionality.

## Phase 1 Implementation (Completed)

### Architecture

The remote tracing system consists of three main components:

1. **RemoteTracingService** - Main orchestrator for remote tracing operations
2. **ConfigFileManager** - Handles YAML file I/O operations
3. **Types** - TypeScript interfaces and default configurations

### Configuration File

The system uses a YAML configuration file (`tracer_config.yml`) located in the `.code-beacon` directory:

```yaml
tracing_enabled: false
last_updated: '2024-06-01T21:03:00.000Z'
source: vscode-extension
version: '1.0'
filters:
  include_paths:
    - app/
    - lib/
  exclude_patterns:
    - '*_spec.rb'
    - '*_test.rb'
```

### Key Features

- **Automatic file creation**: Creates default configuration if file doesn't exist
- **Validation**: Validates and merges configuration with defaults
- **Error handling**: Graceful error handling with user notifications
- **Type safety**: Full TypeScript type definitions
- **Extensible**: Easy to add new configuration options

### API Usage

```typescript
import { RemoteTracingService } from './components/remoteTracing';

const service = new RemoteTracingService(config);

// Check current state
const isEnabled = await service.isTracingEnabled();

// Enable/disable explicitly
await service.enableTracing();
await service.disableTracing();

// Get full configuration
const config = await service.getCurrentConfig();
```

### File Structure

```
src/components/remoteTracing/
├── index.ts                    # Module exports
├── types.ts                    # TypeScript interfaces
├── configFileManager.ts        # YAML file operations
├── remoteTracingService.ts     # Main service class
└── README.md                   # This file
```

### Testing

Comprehensive test suite covers:
- Configuration file creation and validation
- Enable/disable functionality
- Error handling
- File I/O operations

Run tests with: `npm test`

### Next Steps (Future Phases)

- **Phase 2**: UI Components (status bar, tree view actions, commands)
- **Phase 3**: State Management (file watching, event emitters)
- **Phase 4**: Integration & Polish (wire up components, notifications)
- **Phase 5**: Ruby Gem Integration (coordinate with Ruby team)

### Dependencies

- `js-yaml`: YAML parsing and generation
- `vscode`: VS Code API for file operations and notifications 