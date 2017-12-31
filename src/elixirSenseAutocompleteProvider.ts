import { join, sep } from 'path';
import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';
import { checkElixirSenseClientInitialized, checkTokenCancellation } from './elixirSenseValidations';

// tslint:disable:max-line-length
export class ElixirSenseAutocompleteProvider implements vscode.CompletionItemProvider {
  elixirSenseClient: ElixirSenseClient;

  constructor(elixirSenseClient: ElixirSenseClient) {
    this.elixirSenseClient = elixirSenseClient;
  }

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      let elixirSenseClientError;
      const resultPromise = Promise.resolve(this.elixirSenseClient)
        .then(elixirSenseClient => checkElixirSenseClientInitialized(elixirSenseClient))
        .catch(err => {
          elixirSenseClientError = err;
        });

      if (elixirSenseClientError) {
        console.error('rejecting', elixirSenseClientError);
        reject();
        return;
      }

      const documentPath = (document.uri || { fsPath: '' }).fsPath || '';
      if (!documentPath.startsWith(join(this.elixirSenseClient.projectPath, sep))) {
        reject();
        return;
      }

      const documentTextRange = new vscode.Range(new vscode.Position(position.line, 0), position);
      const textBeforeCursor = document.getText(documentTextRange);
      const prefix = this.getPrefix(textBeforeCursor);
      const pipeBefore = !!textBeforeCursor.match(new RegExp(`\\|>\\s*${prefix}$`));
      const captureBefore = !!textBeforeCursor.match(new RegExp(`&${prefix}$`));
      const defBefore = this.getDefBefore(textBeforeCursor, prefix);

      if (prefix === '' && defBefore === '') {
        console.error('rejecting');
        reject();
        return;
      }

      const payload = {
        buffer: document.getText(),
        line: position.line + 1,
        column: position.character + 1
      };

      return resultPromise
        .then((elixirSenseClient: ElixirSenseClient) => elixirSenseClient.send('suggestions', payload))
        .then(result => checkTokenCancellation(token, result))
        .then(result => this.processSuggestionResult(prefix, pipeBefore, captureBefore, defBefore, result))
        .then(result => resolve(result))
        .catch(err => {
          console.error('rejecting', err);
          reject();
        });
    });
  }

  getDefBefore(textBeforeCursor: string, prefix: string): string {
    if (textBeforeCursor.match(new RegExp(`def\\s*${prefix}$`))) {
      return 'def';
    } else if (textBeforeCursor.match(new RegExp(`defmacro\\s*${prefix}$`))) {
      return 'defmacro';
    }
    return '';
  }

  getPrefix(textBeforeCursor: string): string {
    if (textBeforeCursor.endsWith(' {')) {
      return '{';
    }
    const regex: RegExp = /[\w0-9\._!\?\:@]+$/;
    const matches = textBeforeCursor.match(regex);
    if (matches && matches.length > 0) {
      return matches[0];
    }
    return '';
  }

  getModulesToAdd(prefix: string): string[] {
    const matchesWordEnd = prefix.match(/\.[^A-Z][^\.]*$/);
    const matchesNonWordEnd = prefix.match(/^[^A-Z:][^\.]*$/);
    const isPrefixFunctionCall = !!(matchesWordEnd || matchesNonWordEnd);
    if (prefix && !isPrefixFunctionCall) {
      const prefixModules = prefix.split('.').slice(0, -1);
      return Array.from(prefixModules);
    }
    return [];
  }

  processSuggestionResult(
    prefix: string,
    isPipeBefore: boolean,
    isCaptureBefore: boolean,
    autoCompleteKeyword: string,
    suggestionResult
  ): vscode.CompletionItem[] {
    const hint = suggestionResult[0].value;
    const modulesToAdd = this.getModulesToAdd(prefix);
    const unsortedSuggestions = suggestionResult.slice(1);
    const hintModules = hint.split('.').slice(0, -1);
    const isModulesToAddEmpty = modulesToAdd.length > 0;
    const lastModuleHint = isModulesToAddEmpty ? modulesToAdd[modulesToAdd.length - 1] : '';

    const suggestions = this.sortSuggestions(unsortedSuggestions)
      .map((serverSuggestion, index) => {
        const { name } = serverSuggestion;
        const nameArray = Array.from([name, `:${name}`]);
        const islastModuleHintNotInNameArray = nameArray.findIndex(i => i === lastModuleHint) === -1;
        if (isModulesToAddEmpty && islastModuleHintNotInNameArray) {
          serverSuggestion.name = modulesToAdd.join('.') + '.' + name;
        }
        return this.createSuggestion(serverSuggestion, index, prefix, isPipeBefore, isCaptureBefore, autoCompleteKeyword);
      })
      .filter((item: vscode.CompletionItem) => {
        return item !== undefined && item.label !== '';
      });
    return suggestions;
  }

  createSuggestion(serverSuggestion, index: number, prefix: string, pipeBefore: boolean, captureBefore: boolean, defBefore: string) {
    // tslint:disable-next-line:one-variable-per-declaration
    let desc, kind, mod, name, signature, snippet, spec, subtype;
    if (serverSuggestion.type === 'module') {
      [name, kind, subtype, desc] = [serverSuggestion.name, serverSuggestion.type, serverSuggestion.subtype, serverSuggestion.summary];
    } else if (serverSuggestion.type === 'return') {
      [name, kind, spec, snippet] = Array.from([serverSuggestion.description, serverSuggestion.type, serverSuggestion.spec, serverSuggestion.snippet]);
    } else {
      [name, kind, signature, mod, desc, spec] = Array.from([
        serverSuggestion.name,
        serverSuggestion.type,
        serverSuggestion.args,
        serverSuggestion.origin,
        serverSuggestion.summary,
        serverSuggestion.spec
      ]);
    }

    if (defBefore && kind !== 'callback') {
      return '';
    }

    const suggestion: vscode.CompletionItem = (() => {
      if (kind === 'attribute') {
        return this.createSuggestionForAttribute(name, prefix);
      } else if (kind === 'variable') {
        return this.createSuggestionForVariable(name);
      } else if (kind === 'module') {
        return this.createSuggestionForModule(serverSuggestion, name, desc, prefix, subtype);
      } else if (kind === 'callback') {
        return this.createSuggestionForCallback(serverSuggestion, name + '/' + serverSuggestion.arity, kind, signature, mod, desc, spec, prefix, defBefore);
      } else if (kind === 'return') {
        return this.createSuggestionForReturn(serverSuggestion, name, kind, spec, prefix, snippet);
      } else if (['private_function', 'public_function', 'public_macro'].indexOf(kind) > -1) {
        return this.createSuggestionForFunction(
          serverSuggestion,
          name + '/' + serverSuggestion.arity,
          kind,
          signature,
          '',
          desc,
          spec,
          prefix,
          pipeBefore,
          captureBefore
        );
      } else if (['function', 'macro'].indexOf(kind) > -1) {
        return this.createSuggestionForFunction(
          serverSuggestion,
          name + '/' + serverSuggestion.arity,
          kind,
          signature,
          mod,
          desc,
          spec,
          prefix,
          pipeBefore,
          captureBefore
        );
      } else {
        console.log(`Unknown kind: ${serverSuggestion}`);
        return {
          label: serverSuggestion,
          detail: kind || 'hint'
        };
      }
    })();

    suggestion.sortText = ('00' + index).slice(-3);

    return suggestion;
  }

  createSuggestionForAttribute(name, prefix): vscode.CompletionItem {
    return {
      detail: 'attribute',
      insertText: name.slice(1),
      kind: vscode.CompletionItemKind.Property,
      label: name.slice(1)
    };
  }

  createSuggestionForVariable(name): vscode.CompletionItem {
    return {
      detail: 'variable',
      kind: vscode.CompletionItemKind.Variable,
      label: name
    };
  }

  createSuggestionForFunction(serverSuggestion, name, kind, signature, mod, desc, spec, prefix, pipeBefore, captureBefore): vscode.CompletionItem {
    const args = signature.split(',');
    const [_, func, arity] = Array.from<string>(name.match(/(.+)\/(\d+)/));
    const array = prefix.split('.');
    const adjustedLength = Math.max(array.length, 1);
    const moduleParts = array.slice(0, adjustedLength - 1);
    const postfix = array[adjustedLength - 1];

    let displayText = '';
    let detail = '';
    let snippet = func;
    let description = desc;
    spec = spec;

    if (signature) {
      displayText = `${func}`;
      detail = `(${args.join(', ')})`;
    } else {
      if (Number(arity) > 0) {
        detail =
          '(' +
          Array(Number(arity))
            .fill(0)
            .map((x, i) => `arg${i}`)
            .join(', ') +
          ')';
      }
      displayText = `${func}/${arity}`;
    }

    snippet = snippet.replace(/^:/, '') + '$0';

    const [type, typeSpec] = Array.from(
      (() => {
        switch (kind) {
          case 'private_function':
            return [vscode.CompletionItemKind.Method, 'private'];
          case 'public_function':
            return [vscode.CompletionItemKind.Function, 'public'];
          case 'function':
            return [vscode.CompletionItemKind.Function, mod];
          case 'public_macro':
            return [vscode.CompletionItemKind.Function, 'public'];
          case 'macro':
            return [vscode.CompletionItemKind.Function, mod];
          default:
            return [undefined, ''];
        }
      })()
    );

    const label = displayText;
    const insertText = func;

    if (prefix.match(/^:/)) {
      const [module, funcName] = Array.from(this.moduleAndFuncName(moduleParts, func));
      description = 'No documentation available.';
    }

    return {
      label,
      insertText,
      kind: type,
      detail,
      documentation: description + (spec ? '\n' + spec : '')
    };
  }

  createSuggestionForCallback(serverSuggestion, name, kind, signature, mod, desc, spec, prefix, defBefore): vscode.CompletionItem {
    const args = signature.split(',');
    const [func, arity] = Array.from<string>(name.split('/'));

    let params = [];
    let displayText = '';
    let snippet: string = func;
    let description = desc;
    spec = spec;

    if (signature) {
      params = args.map((arg, i) => `\${${i + 1}:${arg.replace(/\s+\\.*$/, '')}}`);
      displayText = `${func}(${args.join(', ')})`;
    } else {
      if (Number(arity) > 0) {
        params = [1, arity, true].map(i => `\${${i}:arg${i}}`);
      }
      displayText = `${func}/${arity}`;
    }

    snippet = `${defBefore} ${func}(${args.join(', ')}) do\n\t\nend\n`;

    const [type, iconHTML, detail]: string[] = Array.from<string>(['value', 'c', mod]);

    if (desc === '') {
      description = 'No documentation available.';
    }

    return {
      detail: mod,
      documentation: description + (spec ? '\n' + spec : ''),
      insertText: snippet,
      kind: vscode.CompletionItemKind.Value,
      label: displayText
    };
  }

  createSuggestionForReturn(serverSuggestion, name, kind, spec, prefix, snippet): vscode.CompletionItem {
    snippet = snippet.replace(/"(\$\{\d+:)/g, '$1').replace(/(\})\$"/g, '$1') + '$0';
    const insertText = name.startsWith(prefix) ? name.slice(prefix.length, name.length - prefix.length - 1) : name;

    return {
      label: name,
      kind: vscode.CompletionItemKind.Value,
      detail: 'return',
      insertText,
      documentation: spec
    };
  }

  createSuggestionForModule(serverSuggestion, name, desc, prefix, subtype): vscode.CompletionItem {
    if (name.match(/^[^A-Z:]/)) {
      name = `:${name}`;
    }
    const description = desc || 'No documentation available.';

    return {
      label: name,
      kind: vscode.CompletionItemKind.Module,
      detail: subtype || 'module',
      documentation: description
    };
  }

  sortSuggestions(suggestions) {
    const sortKind = (a, b) => {
      const priority = {
        callback: 1,
        return: 1,
        variable: 2,
        attribute: 3,
        private_function: 4,
        module: 5,
        public_macro: 6,
        macro: 6,
        public_function: 6,
        function: 6
      };

      return priority[a.type] - priority[b.type];
    };

    const funcTypes = ['private_function', 'public_function', 'function', 'public_macro', 'macro'];
    const isFunc = suggestion => funcTypes.indexOf(suggestion.type) >= 0;

    const sortFunctionByType = (a, b) => {
      if (!isFunc(a) || !isFunc(b)) {
        return 0;
      }

      const startsWithLetterRegex = /^[a-zA-Z]/;
      const aStartsWithLetter = a.name.match(startsWithLetterRegex);
      const bStartsWithLetter = b.name.match(startsWithLetterRegex);

      if (!aStartsWithLetter && bStartsWithLetter) {
        return 1;
      } else if (aStartsWithLetter && !bStartsWithLetter) {
        return -1;
      } else {
        return 0;
      }
    };

    const sortFunctionByName = (a, b) => {
      if (!isFunc(a) || !isFunc(b)) {
        return 0;
      }

      if (a.name > b.name) {
        return 1;
      } else if (a.name < b.name) {
        return -1;
      } else {
        return 0;
      }
    };

    const sortFunctionByArity = (a, b) => {
      if (!isFunc(a) || !isFunc(b)) {
        return 0;
      }
      return a.arity - b.arity;
    };

    const sortFunc = (a, b) => {
      return sortKind(a, b) || sortFunctionByType(a, b) || sortFunctionByName(a, b) || sortFunctionByArity(a, b);
    };

    suggestions = suggestions.sort(sortFunc);

    return suggestions;
  }

  moduleAndFuncName(moduleParts, func) {
    let module = '';
    let funcName = '';
    if (func.match(/^:/)) {
      [module, funcName] = Array.from<string>(func.split('.'));
    } else if (moduleParts.length > 0) {
      module = moduleParts[0];
      funcName = func;
    }
    return [module, funcName];
  }
}
