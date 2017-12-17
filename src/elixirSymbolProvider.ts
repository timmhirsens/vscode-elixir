import * as vscode from 'vscode';
import { WorkspaceSymbolProvider, DocumentSymbolProvider } from 'vscode';

function function_name(line) {
    line = line.trim();
    var j = line.startsWith("defp") ? 5 : 4;
    var x = line.indexOf("(", j);
    if (x > 0)
        return line.substring(j, x);
    else
        return null;
}

function variable_name(line) {
    line = line.trim().split("=");
    var left = line[0].trim();
    if (/^[a-z0-9_]+$/i.test(left))
        return left;
    else
        return null;
}

export class ElixirDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument,
        token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise((resolve, reject) => {
            var symbols = [];
            for (var i = 0; i < document.lineCount; i++) {
                var line = document.lineAt(i);
                if (line.text.trim().startsWith("def ") || line.text.trim().startsWith("defp ")) {
                    symbols.push({
                        name: function_name(line.text),
                        kind: vscode.SymbolKind.Function,
                        location: new vscode.Location(document.uri, line.range)
                    })
                } else if (line.text.trim().indexOf("=") > 0) {
                    var name = variable_name(line.text);
                    if (name != null)
                        symbols.push({
                            name: variable_name(line.text),
                            kind: vscode.SymbolKind.Variable,
                            location: new vscode.Location(document.uri, line.range)
                        })
                }
            }
            resolve(symbols);
        });
    }
}