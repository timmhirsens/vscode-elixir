import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';

export class ElixirSenseAutocompleteProvider implements vscode.CompletionItemProvider {

    elixirSenseClient: ElixirSenseClient;

    constructor(elixirSenseClient: ElixirSenseClient) {
        this.elixirSenseClient = elixirSenseClient;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
        return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
            let textBeforeCursor: string = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position));
            let prefix = this.getPrefix(textBeforeCursor);
            let pipeBefore = !!textBeforeCursor.match(new RegExp(`\\|>\\s*${prefix}$`));
            let captureBefore = !!textBeforeCursor.match(new RegExp(`&${prefix}$`));
            let defBefore = null;
            if (textBeforeCursor.match(new RegExp(`def\\s*${prefix}$`))) {
                defBefore = 'def';
            } else if (textBeforeCursor.match(new RegExp(`defmacro\\s*${prefix}$`))) {
                defBefore = 'defmacro';
            }

            if (prefix === "" && !defBefore) {
                console.error('rejecting');
                reject();
                return;
            }

            if (!this.elixirSenseClient) {
                console.log("ElixirSense client not ready");
                console.error('rejecting');
                reject();
                return;
            }

            this.elixirSenseClient.send("suggestions", { buffer: document.getText(), line: position.line + 1, column: position.character + 1 }, result => {
                if (!token.isCancellationRequested) {
                    const rst = this.processSuggestionResult(prefix, pipeBefore, captureBefore, defBefore, result);
                    resolve(rst);
                } else {
                    console.error('rejecting');
                    reject();
                }
            });
        });
    }

    getPrefix(textBeforeCursor: string): string {
        if (textBeforeCursor.endsWith("  {"))
            return "{";
        let regex: RegExp = /[\w0-9\._!\?\:@]+$/;
        let matches = textBeforeCursor.match(regex);
        if (matches && matches.length > 0)
            return matches[0];
        return '';
    }

    processSuggestionResult(prefix: string, pipeBefore: boolean, captureBefore: boolean, defBefore: string, suggestionResult): vscode.CompletionItem[] {

        let hint: string = suggestionResult[0].value;
        let suggestions = suggestionResult.slice(1);
        let modulesToAdd: string[] = [];
        let lastModuleHint: string;
        let isPrefixFunctionCall: boolean = !!(prefix.match(/\.[^A-Z][^\.]*$/) || prefix.match(/^[^A-Z:][^\.]*$/));

        if (prefix !== '' && !isPrefixFunctionCall) {
            let prefixModules = prefix.split('.').slice(0, -1);
            let hintModules = hint.split('.').slice(0, -1);

            modulesToAdd = Array.from(prefixModules);

            if (prefix.slice(-1)[0] !== '.' || `${prefixModules}` !== `${hintModules}`) {
                for (let i = 0; i < hintModules.length; i++) {
                    let m = hintModules[i];
                    if (m !== prefixModules[i]) {
                        modulesToAdd.push(m);
                    }
                }
            }

            if (modulesToAdd.length > 0)
                lastModuleHint = modulesToAdd[modulesToAdd.length - 1];
        }

        suggestions = this.sortSuggestions(suggestions).map((serverSuggestion, index) => {
            let { name } = serverSuggestion;
            if (lastModuleHint && Array.from<string>([name, `:${name}`]).findIndex(i => i == lastModuleHint) == -1 && modulesToAdd.length > 0) {
                serverSuggestion.name = modulesToAdd.join('.') + '.' + name;
            }
            return this.createSuggestion(serverSuggestion, index, prefix, pipeBefore, captureBefore, defBefore);
        }).filter(function (item: vscode.CompletionItem) {
            return item != null && item.label !== '';
        });

        return suggestions;
    }


    createSuggestion(serverSuggestion, index: number, prefix: string, pipeBefore: boolean, captureBefore: boolean, defBefore: string) {
        let desc, kind, mod, name, signature, snippet, spec, subtype;
        if (serverSuggestion.type === 'module') {
            [name, kind, subtype, desc] = Array.from([serverSuggestion.name, serverSuggestion.type, serverSuggestion.subtype, serverSuggestion.summary]);
        } else if (serverSuggestion.type === 'return') {
            [name, kind, spec, snippet] = Array.from([serverSuggestion.description, serverSuggestion.type, serverSuggestion.spec, serverSuggestion.snippet]);
        } else {
            [name, kind, signature, mod, desc, spec] = Array.from([serverSuggestion.name, serverSuggestion.type, serverSuggestion.args, serverSuggestion.origin, serverSuggestion.summary, serverSuggestion.spec]);
        }

        if (defBefore && kind !== 'callback') {
            return "";
        }

        let suggestion: vscode.CompletionItem = (() => {
            if (kind === 'attribute') {
                return this.createSuggestionForAttribute(name, prefix);
            } else if (kind === 'variable') {
                return this.createSuggestionForVariable(name);
            } else if (kind === 'module') {
                return this.createSuggestionForModule(serverSuggestion, name, desc, prefix, subtype);
            } else if (kind === 'callback') {
                return this.createSuggestionForCallback(serverSuggestion, name + "/" + serverSuggestion.arity, kind, signature, mod, desc, spec, prefix, defBefore);
            } else if (kind === 'return') {
                return this.createSuggestionForReturn(serverSuggestion, name, kind, spec, prefix, snippet);
            } else if (['private_function', 'public_function', 'public_macro'].indexOf(kind) > -1) {
                return this.createSuggestionForFunction(serverSuggestion, name + "/" + serverSuggestion.arity, kind, signature, "", desc, spec, prefix, pipeBefore, captureBefore);
            } else if (['function', 'macro'].indexOf(kind) > -1) {
                return this.createSuggestionForFunction(serverSuggestion, name + "/" + serverSuggestion.arity, kind, signature, mod, desc, spec, prefix, pipeBefore, captureBefore);
            } else {
                console.log(`Unknown kind: ${serverSuggestion}`);
                return {
                    label: serverSuggestion,
                    detail: kind || 'hint'
                };
            }
        })();

        suggestion.sortText = ("00" + index).slice(-3);

        return suggestion;
    }

    createSuggestionForAttribute(name, prefix): vscode.CompletionItem {
        return {
            label: name.slice(1),
            insertText: name.slice(1),
            kind: vscode.CompletionItemKind.Property,
            detail: 'attribute'
        };
    }

    createSuggestionForVariable(name): vscode.CompletionItem {
        return {
            label: name,
            kind: vscode.CompletionItemKind.Variable,
            detail: 'variable'
        }
    }

    createSuggestionForFunction(serverSuggestion, name, kind, signature, mod, desc, spec, prefix, pipeBefore, captureBefore): vscode.CompletionItem {
        let args = signature.split(',');
        let [_, func, arity] = Array.from<string>(name.match(/(.+)\/(\d+)/));
        let array = prefix.split('.'),
            adjustedLength = Math.max(array.length, 1),
            moduleParts = array.slice(0, adjustedLength - 1),
            postfix = array[adjustedLength - 1];

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
                detail = '(' + Array(Number(arity)).fill(0).map((x, i) => `arg${i}`).join(', ') + ')';
            }
            displayText = `${func}/${arity}`;
        }

        snippet = snippet.replace(/^:/, '') + "$0";

        let [type, typeSpec] = Array.from((() => {
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
                    return [null, ''];
            }
        })());

        let label = displayText;
        let insertText = func;

        if (prefix.match(/^:/)) {
            let [module, funcName] = Array.from(this.moduleAndFuncName(moduleParts, func));
            description = "No documentation available.";
        }

        return {
            label: label,
            insertText: insertText,
            kind: type,
            detail: detail,
            documentation: description + (spec ? "\n" + spec : ""),
        };
    }

    createSuggestionForCallback(serverSuggestion, name, kind, signature, mod, desc, spec, prefix, defBefore): vscode.CompletionItem {
        let args = signature.split(',');
        let [func, arity] = Array.from<string>(name.split('/'));

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

        snippet = `${func}(${args.join(', ')}) do\n\t\nend\n`;

        if (defBefore === 'def') {
            if (spec.startsWith('@macrocallback')) {
                return null;
            }
        } else if (defBefore === 'defmacro') {
            if (spec.startsWith('@callback')) {
                return null;
            }
        } else {
            let def_str = spec.startsWith('@macrocallback') ? 'defmacro' : 'def';
            snippet = `${def_str} ${snippet}`;
        }

        let [type, iconHTML, detail]: string[] = Array.from<string>(['value', 'c', mod]);

        if (desc === "") {
            description = "No documentation available.";
        }

        return {
            label: displayText,
            kind: vscode.CompletionItemKind.Value,
            detail: detail,
            insertText: snippet,
            documentation: description + (spec ? "\n" + spec : ""),
        };
    }

    createSuggestionForReturn(serverSuggestion, name, kind, spec, prefix, snippet): vscode.CompletionItem {
        let displayText = name;
        snippet = snippet.replace(/"(\$\{\d+:)/g, "$1").replace(/(\})\$"/g, "$1") + "$0";

        let insertText: string = displayText;
        if (insertText.startsWith(prefix))
            insertText = insertText.slice(prefix.length, insertText.length - prefix.length - 1);

        return {
            label: displayText,
            kind: vscode.CompletionItemKind.Value,
            detail: 'return',
            insertText: insertText,
            documentation: spec
        };
    }

    createSuggestionForModule(serverSuggestion, name, desc, prefix, subtype): vscode.CompletionItem {
        if (name.match(/^[^A-Z:]/)) {
            name = `:${name}`;
        }
        let description = desc || "No documentation available.";

        return {
            label: name,
            kind: vscode.CompletionItemKind.Module,
            detail: subtype || 'module',
            documentation: description,
        };
    }

    sortSuggestions(suggestions) {
        let sortKind = function (a, b) {
            let priority = {
                "callback": 1,
                "return": 1,
                "variable": 2,
                "attribute": 3,
                "private_function": 4,
                "module": 5,
                "public_macro": 6,
                "macro": 6,
                "public_function": 6,
                "function": 6
            };

            return priority[a.type] - priority[b.type];
        };

        let funcTypes = ["private_function", "public_function", "function", "public_macro", "macro"];
        let isFunc = (suggestion) => funcTypes.indexOf(suggestion.type) >= 0;

        let sortFunctionByType = function (a, b) {
            if (!isFunc(a) || !isFunc(b)) {
                return 0;
            }

            let startsWithLetterRegex = /^[a-zA-Z]/;
            let aStartsWithLetter = a.name.match(startsWithLetterRegex);
            let bStartsWithLetter = b.name.match(startsWithLetterRegex);

            if (!aStartsWithLetter && bStartsWithLetter) {
                return 1;
            } else if (aStartsWithLetter && !bStartsWithLetter) {
                return -1;
            } else {
                return 0;
            }
        };

        let sortFunctionByName = function (a, b) {
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

        let sortFunctionByArity = function (a, b) {
            if (!isFunc(a) || !isFunc(b)) {
                return 0;
            }
            return a.arity - b.arity;
        };

        let sortFunc = (a, b) => sortKind(a, b) || sortFunctionByType(a, b) || sortFunctionByName(a, b) || sortFunctionByArity(a, b);

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