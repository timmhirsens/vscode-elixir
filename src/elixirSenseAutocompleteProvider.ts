import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';
import { checkElixirSenseClientInitialized, checkTokenCancellation } from './elixirSenseValidations';

// tslint:disable:max-line-length
export class ElixirSenseAutocompleteProvider implements vscode.CompletionItemProvider {

    elixirSenseClient: ElixirSenseClient;

    constructor(elixirSenseClient: ElixirSenseClient) {
        this.elixirSenseClient = elixirSenseClient;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
    : Thenable<vscode.CompletionItem[]> {
        return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
            const documentTextRange = new vscode.Range(new vscode.Position(position.line, 0), position);
            const textBeforeCursor = document.getText(documentTextRange);
            const prefix = this.getPrefix(textBeforeCursor);
            const defBefore = this.getDefBefore(textBeforeCursor, prefix);

            if (prefix === '' && defBefore === '') {
                console.error('rejecting');
                reject();
                return;
            }

            const payload = {
                buffer : document.getText(),
                line   : position.line + 1,
                column : position.character + 1
            };

            return Promise.resolve(this.elixirSenseClient)
            .then((elixirSenseClient) => checkElixirSenseClientInitialized(elixirSenseClient))
            .then((elixirSenseClient) => elixirSenseClient.send('suggestions', payload))
            .then((result) => checkTokenCancellation(token, result))
            .then((result) => {
                console.log('[$$$]', result);
                return result;
            })
            // .then((result) => this.extendResultSet(prefix, result))
            .then((result) => this.processSuggestionResult(prefix, position, defBefore, result))
            .then((result) => resolve(result))
            .catch((err) => {
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
        } else if (textBeforeCursor.match(new RegExp(`use\\s*${prefix}$`))) {
            return 'use';
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

    // getModulesToAdd(prefix: string): string[] {
    //     const matchesWordEnd = prefix.match(/\.[^A-Z][^\.]*$/);
    //     const matchesNonWordEnd = prefix.match(/^[^A-Z:][^\.]*$/);
    //     const isPrefixFunctionCall = !!(matchesWordEnd || matchesNonWordEnd);
    //     if (prefix && !isPrefixFunctionCall) {
    //         const prefixModules = prefix.split('.').slice(0, -1);
    //         return Array.from(prefixModules);
    //     }
    //     return [];
    // }

    // extendResultSet(prefix: string, suggestionResults) {
    //     const modulesToAdd = this.getModulesToAdd(prefix);
    //     const isModulesToAddEmpty = modulesToAdd.length > 0;
    //     const lastModuleHint = isModulesToAddEmpty ? modulesToAdd[modulesToAdd.length - 1] : '';
    //     return suggestionResults.map((serverSuggestion) => {
    //         const { name } = serverSuggestion;
    //         const nameArray = Array.from([name, `:${name}`]);
    //         const islastModuleHintNotInNameArray = nameArray.findIndex((i) => i === lastModuleHint) === -1;
    //         if (isModulesToAddEmpty && islastModuleHintNotInNameArray) {
    //             serverSuggestion.name = `${modulesToAdd.join('.')}.${name}`;
    //         }
    //         return serverSuggestion;
    //     });
    // }

    processSuggestionResult(prefix: string, position: vscode.Position, defBefore: string, suggestionResult)
    : vscode.CompletionItem[] {
        const [hint, ...unsortedSuggestions] = suggestionResult;
        const suggestions = this.sortSuggestions(unsortedSuggestions)
        .map((serverSuggestion) => {
            return this.createSuggestion(serverSuggestion, position, prefix, defBefore);
        }).filter((item) => {
            return item.label;
        });
        return suggestions;
    }

    createSuggestion(serverSuggestion, position: vscode.Position, prefix: string, defBefore: string): vscode.CompletionItem {
        const {name, type, args, summary, spec, arity, subtype, snippet, origin} = serverSuggestion;
        if (defBefore === 'def' && type !== 'callback') {
            return new vscode.CompletionItem('', 0);
        }
        if (defBefore === 'use' && type !== 'module') {
            return new vscode.CompletionItem('', 0);
        }

        return {
            label      : this.getLabel(serverSuggestion),
            kind       : this.getKind(serverSuggestion),
            detail     : this.getDetail(serverSuggestion),
            insertText : this.getInsertText(serverSuggestion),
            documentation : this.getDocumentation(serverSuggestion),
            additionalTextEdits : this.getAdditionalTextEdits(serverSuggestion, position)
        };
    }

    getAdditionalTextEdits(serverSuggestion, position): vscode.TextEdit[] | undefined {
        const {origin, type} = serverSuggestion;
        if (type === 'callback') {
            const start = new vscode.Position(position.line - 1, 0);
            const range = new vscode.Range(start, start);
            const newText = `\n\t@impl ${origin}`;
            return [new vscode.TextEdit(range, newText)];
        }
        return undefined;
    }

    getDocumentation(serverSuggestion): string {
        const {summary, spec = ''} = serverSuggestion;
        const description = summary ? summary : 'No documentation available.';
        return `${description}\n${spec}`;
    }

    getInsertText(serverSuggestion): string {
        const {name, args, type, origin} = serverSuggestion;
        if (type === 'callback') {
            return `${name}(${args.split(',').join(', ')}) do\n\t\nend\n`;
        }
        if (type === 'macro') {
            return `${name} `;
        }
        if (type === 'function' && origin) {
            return `${origin}.${name}`;
        }
        return name;
    }

    getLabel(serverSuggestion): string | undefined {
        const {name, arity, origin, subtype} = serverSuggestion;
        if (origin && origin.startsWith('Kernel')) {
            return name;
        }
        else if (Number.isInteger(arity)) {
            const {type} = serverSuggestion;
            if (type === 'callback') {
                return `${name}/${arity}`;
            }
            return `${origin}.${name}/${arity}`;
        }
        else if (subtype === 'protocol') {
            return undefined;
        }
        return name;
    }

    getDetail(serverSuggestion): string {
        const {type, subtype, args} = serverSuggestion;
        const signature = args ? `(${args.split(',').join(', ')})` : '';
        return signature
        || subtype
        || type;
    }

    getKind(serverSuggestion): vscode.CompletionItemKind {
        switch (serverSuggestion.type) {
            case 'attribute':
                return vscode.CompletionItemKind.Property;
            case 'variable' :
                return vscode.CompletionItemKind.Variable;
            case 'module'   :
                return vscode.CompletionItemKind.Module;
            case 'callback' :
                return vscode.CompletionItemKind.Interface;
            case 'return'   :
                return vscode.CompletionItemKind.Value;
            case 'private_function' :
            case 'public_function'  :
            case 'function' :
            case 'macro' :
                return vscode.CompletionItemKind.Function;
            default:
                return vscode.CompletionItemKind.Unit;
        }
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
        const isFunc = (suggestion) => funcTypes.indexOf(suggestion.type) >= 0;

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
            return sortKind(a, b)
            || sortFunctionByType(a, b)
            || sortFunctionByName(a, b)
            || sortFunctionByArity(a, b);
        };

        suggestions = suggestions.sort(sortFunc);

        return suggestions;
    }
}
