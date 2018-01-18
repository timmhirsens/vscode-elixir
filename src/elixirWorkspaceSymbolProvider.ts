import * as vscode from 'vscode';
import { ElixirSymbol, ElixirSymbolExtractor } from './elixirSymbolExtractor';

export class ElixirWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {

    public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return findWorkspaceSymbols(query);
    }
}

function partsMatch(query, name) {
    let hits = 0;
    const parts = name.split('_');
    for (let i = 0; i < parts.length; i++) {
        if (parts[i][0] == query[i]) {
            hits++;
        } else {
            hits = 0;
        }
        if (hits >= 2) {
            return true;
        }
    }
    return false;
}

function isMatch(query, name) {
    const lname = name.toLowerCase();
    const lquery = query.toLowerCase();
    return lname.indexOf(lquery) > -1 || partsMatch(lquery, lname);
}

function findWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
    if (query.length < 2) return;
    let symbols = [];
    let files = vscode.workspace.findFiles('{lib,web}/**/*.ex', '');  

    return new Promise<vscode.SymbolInformation[]>((resolve, reject) => {
        files.then((value) => {
            let symbolExtractor = new ElixirSymbolExtractor();
            for (let file of value) {
                const path = file.path
                const syms = symbolExtractor.extractSymbolsFromFile(path);
                const module = syms[0][1];
                for (let symbol of syms) {
                    const name = symbol[1];
                    if ((symbol[0] == ElixirSymbol.FUNCTION || symbol[0] == ElixirSymbol.MACRO) && isMatch(query, name)) {
                        const arity = symbol[2];
                        const line = symbol[3];
                        symbols.push(
                            new vscode.SymbolInformation(name + '/' + arity,
                                vscode.SymbolKind.Function,
                                new vscode.Range(line - 1, 1, line - 1, 1),
                                vscode.Uri.file(path),
                                module
                            ));
                    }
                }
            }
            resolve(symbols);
        },
            (reason) => {
                console.log(reason);
                reject(reason);
            });
    });
}
