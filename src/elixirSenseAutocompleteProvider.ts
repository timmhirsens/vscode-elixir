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
            .then((suggestions) => {
                console.log('[vscode-elixir] elixir-sense suggestions:', suggestions);
                return suggestions;
            })
            .then((suggestions) => this.processSuggestions(prefix, position, defBefore, suggestions))
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

    processSuggestions(prefix: string, position: vscode.Position, defBefore: string, suggestions)
    : vscode.CompletionItem[] {
        const [hint, ...unsortedSuggestions] = suggestions;
        return this.sortSuggestions(unsortedSuggestions)
        .map((serverSuggestion) => this.createSuggestion(serverSuggestion, position, prefix, defBefore))
        .filter((item) => item.label);
    }

    createSuggestion(serverSuggestion, position: vscode.Position, prefix: string, defBefore: string): vscode.CompletionItem {
        const {name, type, args, summary, spec, arity, subtype, snippet, origin} = serverSuggestion;
        if (defBefore === 'def' && !['public_function', 'callback'].includes(type)) {
            return new vscode.CompletionItem('', 0);
        }
        if (defBefore === 'use' && type !== 'module') {
            return new vscode.CompletionItem('', 0);
        }

        const label = this.getLabel(serverSuggestion);
        const kind  = this.getKind(serverSuggestion);
        const detail = this.getDetail(serverSuggestion);
        const insertText = this.getInsertText(serverSuggestion);
        const documentation = this.getDocumentation(serverSuggestion);
        const additionalTextEdits = this.getAdditionalTextEdits(serverSuggestion, position);

        return {
            label,
            kind,
            detail,
            insertText,
            documentation,
            additionalTextEdits
        };
    }

    getAdditionalTextEdits(serverSuggestion, position): vscode.TextEdit[] | undefined {
        const {origin, type} = serverSuggestion;
        if (this.elixirSenseClient.version.elixir >= '1.5') {
            if (type === 'callback') {
                const start = new vscode.Position(position.line - 1, 0);
                const range = new vscode.Range(start, start);
                const newText = `\n\t@impl ${origin}`;
                return [new vscode.TextEdit(range, newText)];
            }
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
        if (type === 'function' && origin === 'Kernel') {
            return `${name}`;
        }
        if (type === 'function' && origin) {
            return `${origin}.${name}`;
        }
        return name;
    }

    getLabel(serverSuggestion): string | undefined {
        const {name, arity, origin, subtype} = serverSuggestion;
        if (origin && origin.startsWith('Kernel')) {
            if (name.match(new RegExp(`^([A-Za-z]).+$`))) {
                return `${name}/${arity}`;
            }
            return name;
        }
        else if (Number.isInteger(arity)) {
            const {type} = serverSuggestion;
            if (['public_function', 'callback'].includes(type)) {
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
        if (!serverSuggestion.name.match(new RegExp(`^([A-Za-z]).+$`))) {
            return vscode.CompletionItemKind.Operator;
        }
        switch (serverSuggestion.type) {
            case 'attribute':
                return vscode.CompletionItemKind.Property;
            case 'variable':
                return vscode.CompletionItemKind.Variable;
            case 'module':
                return vscode.CompletionItemKind.Module;
            case 'public_function':
            case 'callback':
                return vscode.CompletionItemKind.Interface;
            case 'return':
                return vscode.CompletionItemKind.Value;
            case 'macro':
                return vscode.CompletionItemKind.Field;
            case 'private_function':
            case 'function':
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
