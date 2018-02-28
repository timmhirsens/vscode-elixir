import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

export class ElixirServer {
  p: cp.ChildProcess;
  args: string[];
  env: string;
  busy: boolean;
  buffer: string;
  ready: boolean;
  lastRequestType: string;
  resultCallback: (result: string) => void;

  constructor(private command: string) {
    const extensionPath: string = vscode.extensions.getExtension('mjmcloug.vscode-elixir').extensionPath;
    this.command = 'elixir';
    this.args = [path.join(extensionPath, 'alchemist-server/run.exs')];
    this.env = 'dev';
    this.buffer = '';
    this.busy = false;
  }

  start() {
    let projectPath = '';
    if (vscode.workspace.rootPath !== undefined) {
      projectPath = path.join(vscode.workspace.rootPath);
    } else {
      const savedFiles: vscode.TextDocument[] = vscode.workspace.textDocuments.filter(value => {
        return value.uri.scheme === 'file';
      });
      if (savedFiles.length > 0) {
        projectPath = path.dirname(savedFiles[0].fileName);
      } else {
        // Bail out, lets use our extensionPath as projectPath
        projectPath = vscode.extensions.getExtension('mjmcloug.vscode-elixir').extensionPath;
      }
    }
    const optionsWin = { cwd: projectPath, windowsVerbatimArguments: true, stdio: 'pipe' };
    const optionsUnix = { cwd: projectPath, stdio: 'pipe' };
    if (process.platform === 'win32') {
      const windowsPath = '"' + this.args + '"';
      this.p = cp.spawn(
        'cmd',
        [
          '/s',
          '/c',
          '"' +
            [this.command]
              .concat(windowsPath)
              .concat(this.env)
              .join(' ') +
            '"'
        ],
        optionsWin
      );
    } else {
      this.p = cp.spawn(this.command, this.args.concat(this.env), optionsUnix);
    }
    console.log('[vscode-elixir] server started', this.p);
    this.p.on('message', message => {
      console.log('message', message);
    });
    this.p.on('error', error => {
      console.log('[vscode-elixir]', error.toString());
    });
    this.p.on('close', exitCode => {
      console.log('[vscode-elixir] exited', exitCode);
    });
    this.p.stdout.on('data', chunk => {
      if ((chunk as Buffer).indexOf(`END-OF-${this.lastRequestType}`) > -1) {
        const chunkString: string = chunk.toString();
        const splitStrings: string[] = chunkString.split(`END-OF-${this.lastRequestType}`);
        const result = (this.buffer + splitStrings[0]).trim();
        this.resultCallback(result);
        this.buffer = '';
        this.busy = false;
      } else {
        this.buffer += chunk.toString();
      }
    });
    this.p.stderr.on('data', (chunk: Buffer) => {
      const errorString = chunk.toString();
      if (!errorString.startsWith('Initializing')) {
        console.log('[vscode-elixir] error: aborting command', chunk.toString());
        // TODO: this could be handled better.
        if (this.resultCallback) {
          this.resultCallback('');
        }
        this.busy = false;
      } else {
        console.log('[vscode-elixir]', chunk.toString());
        this.ready = true;
      }
    });
  }

  getDefinition(document: vscode.TextDocument, position: vscode.Position, callback): void {
    const wordAtPosition = document.getWordRangeAtPosition(position);
    const word = document.getText(wordAtPosition);
    if (word.indexOf('\n') >= 0) {
      console.error('[vscode-elixir] got whole file as word');
      callback([]);
      return;
    }
    const lookup = this.createDefinitionLookup(word);
    const command = `DEFL { "${lookup}", "${document.fileName}", "${document.fileName}", ${position.line + 1} }\n`;
    const resultCb = (result: string) => {
      if (process.platform === 'win32') {
        result = result.replace(/\//g, '\\');
      }
      callback(result);
    };
    this.sendRequest('DEFL', command, resultCb);
  }

  getDocumentation(document: vscode.TextDocument, position: vscode.Position, callback): void {
    const wordAtPosition = document.getWordRangeAtPosition(position);
    const word = document.getText(wordAtPosition);
    if (word.indexOf('\n') >= 0) {
      console.error('[vscode-elixir] got whole file as word');
      callback([]);
      return;
    }
    const command = `DOCL { "${word}", "${document.fileName}", ${position.line + 1} }\n`;
    const resultCb = (result: string) => {
      if (result) {
        const hover = new vscode.Hover(result, wordAtPosition);
        callback(hover);
      } else {
        callback([]);
      }
    };
    this.sendRequest('DOCL', command, resultCb);
  }

  createDefinitionLookup(word: string): string {
    if (word.indexOf('.') >= 0) {
      const words = word.split('.');
      let lookup = '';
      words.forEach(w => {
        if (lookup.length > 0) {
          if (this.isModuleName(w)) {
            lookup = `${lookup}.${w}`;
          } else {
            lookup = `${lookup},${w}`;
          }
        } else {
          lookup = w;
        }
      });
      if (lookup.indexOf(',') < 0) {
        lookup = `${lookup},nil`;
      }
      return lookup;
    } else {
      if (this.isModuleName(word)) {
        return `${word},nil`;
      } else {
        return `nil,${word}`;
      }
    }
  }

  isModuleName(word: string): boolean {
    return /^[A-Z]/.test(word);
  }

  getCompletions(document: vscode.TextDocument, position: vscode.Position, callback: (completionItems) => void): void {
    const wordAtPosition = document.getWordRangeAtPosition(position);
    const word = document.getText(wordAtPosition);
    if (word.indexOf('\n') >= 0) {
      console.error('[vscode-elixir] got whole file as word');
      callback([]);
      return;
    }
    const command = `COMP { "${word}", "${document.fileName}", ${position.line + 1} }\n`;
    const resultCb = (result: string) => {
      const suggestionLines = result.split('\n');
      // remove 'hint' suggestion (always the first one returned by alchemist)
      const hintLine = suggestionLines.shift();
      const completionItems = suggestionLines.map(line => {
        return this.createCompletion(word, line, hintLine.startsWith(':'));
      });
      callback(completionItems);
    };
    this.sendRequest('COMP', command, resultCb);
  }

  stop() {
    console.log('[vscode-elixir] stopping server');
    this.p.stdin.end();
  }

  private sendRequest(type: string, command: string, cb): void {
    if (!this.busy && this.ready) {
      this.lastRequestType = type;
      if (process.platform === 'win32') {
        command = command.replace(/\\/g, '/');
      }
      console.log('[vscode-elixir] cmd: ', command);
      this.busy = true;
      this.resultCallback = cb;
      this.p.stdin.write(command);
    } else {
      console.log('[vscode-elixir] server is busy / not ready');
    }
  }

  private createCompletion(hint: string, line: string, isErlangModule = false) {
    const suggestion = line.split(';');
    const completionItem = new vscode.CompletionItem(suggestion[0]);
    completionItem.documentation = suggestion[suggestion.length - 2];
    switch (suggestion[1]) {
      case 'macro':
      case 'public_function':
      case 'function': {
        completionItem.kind = vscode.CompletionItemKind.Function;
        break;
      }
      case 'module': {
        completionItem.kind = vscode.CompletionItemKind.Module;
      }
    }
    completionItem.insertText = suggestion[0];
    if (suggestion[1] === 'module') {
      const [name, kind, subtype, desc] = suggestion;
      let prefix = '';
      if (hint.indexOf('.') >= 0) {
        const lastIndex = hint.lastIndexOf('.');
        prefix = hint.substr(0, lastIndex + 1);
      }
      if (isErlangModule) {
        prefix = ':' + prefix;
      }
      completionItem.label = prefix + name;
      completionItem.insertText = prefix + name;
    } else {
      const [name, kind, signature, mod, desc, spec] = suggestion;
      completionItem.detail = signature;
      let prefix = '';
      if (hint.indexOf('.') >= 0) {
        const lastIndex = hint.lastIndexOf('.');
        prefix = hint.substr(0, lastIndex + 1);
      }
      if (kind === 'function' || kind === 'macro' || kind === 'public_function') {
        const expandedName = name.indexOf('/') === -1 ? name : name.split('/')[0];
        // TODO: VSCode currently doesnt seem to support 'snippet completions'
        //      so adding the parameters to the Completion is not really useful.
        // completionItem.insertText = prefix + name + '(' + signature + ')';
        completionItem.insertText = prefix + expandedName;
      }
      completionItem.label = prefix + name;
    }
    return completionItem;
  }
}
