import * as vscode from 'vscode';
//import { ElixirSense } from './elixirSense';
import { ElixirSenseClient } from './elixirSenseClient';

export class ElixirSenseDefinitionProvider implements vscode.DefinitionProvider {
    elixirSenseClient: ElixirSenseClient;

    constructor(elixirSenseClient: ElixirSenseClient) {
        this.elixirSenseClient = elixirSenseClient;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition | Thenable<vscode.Definition> {

        const wordAtPosition = document.getWordRangeAtPosition(position);
        const word = document.getText(wordAtPosition);
        return new Promise<vscode.Definition>((resolve, reject) => {

            if (!this.elixirSenseClient) {
                console.log("ElixirSense client not ready");
                console.error('rejecting');
                reject();
                return;
            }

            this.elixirSenseClient.send("definition", { buffer: document.getText(), line: position.line + 1, column: position.character + 1 }, result => {

                if (token.isCancellationRequested) {
                    console.error('rejecting');
                    reject();
                    return;
                }

                let [filePath, lineNumberStr] = result.split(':');

                let lineNumber = Number(lineNumberStr) - 1;

                if (!filePath || filePath == 'non_existing') {
                    resolve(null);
                    return;
                }

                let location;
                if (lineNumber >= 0) {
                    location = new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(lineNumber, 0));
                } else {
                    location = new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
                }

                resolve(location);
            });
        });
    }
}