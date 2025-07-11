import * as vscode from 'vscode';
import { MetaDataARInterface } from '../../state/activeRecord/metaDataAR';

class DbNode extends vscode.TreeItem {
  name!: string;
  fileName!: string;
  dbPath: string;
  private metadata?: MetaDataARInterface;

  constructor(dbPath: string) {
    super('', vscode.TreeItemCollapsibleState.None);
    this.dbPath = dbPath;
    this.contextValue = 'recording';
  }

  setName(name: string): void {
    this.name = name;
    this.label = name;
  }

  setDescription(description: string): void {
    this.description = description;
    this.updateTooltip();
  }

  setFileName(fileName: string): void {
    this.fileName = fileName;
    this.updateCommand();
  }

  setMetadata(metadata: MetaDataARInterface): void {
    this.metadata = metadata;
    if (metadata) {
      this.iconPath = this.getIconForTriggerType(metadata.trigger_type);
    }
    this.updateTooltip();
  }

  private getIconForTriggerType(triggerType: string): vscode.ThemeIcon {
    switch (triggerType) {
      // case 'manual':
      //   return new vscode.ThemeIcon('list-tree'); 
      case 'script':
        return new vscode.ThemeIcon('terminal'); // alt: file-code
      case 'middleware':
        return new vscode.ThemeIcon('globe'); // alt: link
      default:
        return new vscode.ThemeIcon('list-tree');
    }
  }

  private updateTooltip(): void {
    if (this.metadata) {
      // Create rich tooltip with all metadata
      this.createRichTooltip();
    } else if (this.description) {
      // Fallback to old JSON parsing behavior
      this.createSimpleTooltip();
    }
  }

  private getTrimmedString(value: unknown): string {
    if (typeof value === 'string') {return value.trim();}
    if (value === null || value === undefined) {return '';}
    return String(value).trim();
  }

  private createRichTooltip(): void {
    if (!this.metadata) {return;}

    // Table 1: Name, Description, File, Line, Class, Method
    const rows1: string[] = [];
    if (this.getTrimmedString(this.metadata.name) !== '') {
      rows1.push(`| **Name** | ${this.metadata.name} |`);
    }
    if (this.getTrimmedString(this.metadata.description) !== '') {
      rows1.push(`| **Description** | ${this.metadata.description} |`);
    }
    if (this.getTrimmedString(this.metadata.caller_file) !== '') {
      rows1.push(`| **File** ${"&nbsp;".repeat(22)} | ${this.metadata.caller_file} |`);
    }
    const callerLine = this.getTrimmedString(this.metadata.caller_line);
    if (callerLine !== '') {
      rows1.push(`| **Line** | ${callerLine} |`);
    }
    if (this.getTrimmedString(this.metadata.caller_class) !== '') {
      rows1.push(`| **Class** | ${this.metadata.caller_class} |`);
    }
    if (this.getTrimmedString(this.metadata.caller_method) !== '') {
      rows1.push(`| **Method** | ${this.metadata.caller_method} |`);
    }
    const table1 = rows1.length > 0 ? '|  |  |\n|---|---|\n' + rows1.join('\n') : '';

    // Table 2: Start Time, Duration
    const rows2: string[] = [];
    if (this.getTrimmedString(this.metadata.start_time) !== '') {
      const startTime = this.formatTimestamp(this.metadata.start_time);
      rows2.push(`| **Start Time** ${"&nbsp;".repeat(7)} | ${startTime} |`);
    }
    if (this.getTrimmedString(this.metadata.duration_ms) !== '') {
      const duration = this.formatDuration(this.metadata.duration_ms);
      rows2.push(`| **Duration** | ${duration} |`);
    }
    const table2 = rows2.length > 0 ? '|  |  |\n|---|---|\n' + rows2.join('\n') : '';

    // Table 3: Type, Database File
    const rows3: string[] = [];
    if (this.getTrimmedString(this.metadata.trigger_type) !== '') {
      rows3.push(`| **Type**     | ${this.metadata.trigger_type} |`);
    }
    if (this.getTrimmedString(this.metadata.dbBasename) !== '') {
      rows3.push(`| **Database File** ${"&nbsp;".repeat(2)} | ${this.metadata.dbBasename} |`);
    }
    const table3 = rows3.length > 0 ? '|  |  |\n|---|---|\n' + rows3.join('\n') : '';

    // Compose the Markdown tables, separated by blank lines
    const tables = [table1, table2, table3].filter(Boolean).join('\n---\n');
    this.tooltip = new vscode.MarkdownString(tables);
  }

  private createSimpleTooltip(): void {
    if (!this.description) {return;}
    
    let obj;
    try {
      obj = JSON.parse(this.description as string);
      let markdownDescription = Object.entries(obj)
        .map(([key, value]) => `  "${key}": "${value}"`)
        .join(',\n');
      markdownDescription = `{\n${markdownDescription}\n}`;
      this.tooltip = new vscode.MarkdownString(`\`\`\`json\n${markdownDescription}\n\`\`\``);
    } catch (error) {
      this.tooltip = new vscode.MarkdownString(`\`\`\`json\n${this.description}\n\`\`\``);
    }
  }

  private formatTimestamp(timestamp: string): string {
    if (!timestamp) {return '';}
    // Try to parse as ISO or other date string first
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
    // Fallback: return raw value
    return timestamp;
  }

  private formatDuration(durationMs: string): string {
    try {
      const ms = parseFloat(durationMs);
      if (isNaN(ms)) {
        return `${durationMs} ms`;
      }
      
      if (ms < 1000) {
        return `${ms.toFixed(2)} ms`;
      } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(2)} seconds`;
      } else {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(2);
        return `${minutes}m ${seconds}s`;
      }
    } catch {
      return `${durationMs} ms`;
    }
  }

  private updateCommand(): void {
    if (this.fileName) {
      this.command = { command: 'recordingsTree.loadDb', title: "Load Db", arguments: [this.fileName] };
    }
  }
}

class DbErrorNode extends vscode.TreeItem {
  dbFileName: string;

  constructor(
    dbFileName: string,
    fullPath: string
  ) {
    super("Error loading database", vscode.TreeItemCollapsibleState.None);
    this.dbFileName = dbFileName;
    this.description = dbFileName;
    this.tooltip = `Database file exists but could not be loaded: ${fullPath}`;
    this.contextValue = 'dbError';
    this.command = undefined;
  }
}
  
export { DbNode, DbErrorNode };
