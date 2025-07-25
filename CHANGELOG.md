# Change Log

All notable changes to the "Code Beacon" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.0] - 2025-01-26

### Added
- Rich metadata tooltips and improved recording display
- Delete recordings functionality - allows users to remove unwanted recordings  
- Recording metadata exclude filters for better data management
- Status bar indicating active tracing state
- Complete remote tracing state management and file watching (Phase 3)
- WorkspaceSetupService with multi-workspace support
- Protection for DEFAULT_TRACER_CONFIG from accidental mutation

### Changed
- **License changed from MIT to UNLICENSED** ⚠️
- Improved robustness when no recording database is selected

### Fixed
- File/method loading on file explorer selection
- Handling of missing data directory on initial load
- Reduced unwanted scrolling behavior
- Extension initialization when data directory doesn't exist

## [0.2.2] - 2025-05-07

### Noop
- No changes
- Version bump for release

## [0.2.1] - 2025-05-06

### Removed
- Node sqlite3 implementation and dependency


## [0.2.0] - 2025-05-06

### Added
- External SQLite binary support via BinarySQLiteExecutor
- Comprehensive unit tests for database operations
- SQLite abstraction layer for improved database handling

### Fixed
- URLs in package.json

## [0.1.0] - 2025-03-25

### Added
- Initial release of Code Beacon (formerly Ruby Flow)
- Method call visualization for Ruby applications
- Execution path tracking with interactive navigation
- Recording management for saving and loading execution traces
- Integration with VS Code's tree view for intuitive navigation
- Configuration options for data directory and workspace root

### Attributions
- Icon attribution: Laser icons created by Freepik - Flaticon
- Material Design Icon Theme by Material Extensions (MIT License)