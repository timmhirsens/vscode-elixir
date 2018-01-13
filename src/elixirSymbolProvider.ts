import * as vscode from 'vscode';
import { ElixirSymbolExtractor, ElixirSymbol } from './elixirSymbolExtractor';

export class ElixirDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise(
            (resolve, reject) => {
                let src = document.getText();
                let symbolExtractor = new ElixirSymbolExtractor();
                const symbols = [];
                let elixirSymbols = symbolExtractor.extractSymbols(src);
                for (let symbol of elixirSymbols) {
                    switch (symbol[0]) {
                        case ElixirSymbol.FUNCTION: {
                            let [_, name, arity, line] = symbol;
                            symbols.push({
                                name: name + '/' + arity,
                                kind: vscode.SymbolKind.Function,
                                location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                            });
                            break;
                        }
                        case ElixirSymbol.MACRO: {
                            let [_, name, arity, line] = symbol
                            symbols.push({
                                name: name + '/' + arity,
                                kind: vscode.SymbolKind.Function,
                                location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                            });
                            break
                        }
                        case ElixirSymbol.MODULE: {
                            let [_, name, line] = symbol
                            symbols.push({
                                name: name,
                                kind: vscode.SymbolKind.Class,
                                location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                            });
                            break
                        }
                        case ElixirSymbol.VALUE: {
                            let [_, name, line] = symbol
                            symbols.push({
                                name: name,
                                kind: vscode.SymbolKind.Field,
                                location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                            });
                            break
                        }
                        default:
                    }
                }
                resolve(symbols);
            });
    }
}
