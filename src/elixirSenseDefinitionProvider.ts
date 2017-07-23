import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';
import { checkElixirSenseClientInitialized, checkTokenCancellation } from './elixirSenseValidations';

export class ElixirSenseDefinitionProvider implements vscode.DefinitionProvider {
    elixirSenseClient: ElixirSenseClient;

    constructor(elixirSenseClient: ElixirSenseClient) {
        this.elixirSenseClient = elixirSenseClient;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Definition> {

        const wordAtPosition = document.getWordRangeAtPosition(position);
        const word = document.getText(wordAtPosition);
        return new Promise<vscode.Definition>((resolve, reject) => {

            const payload = {
                buffer : document.getText(),
                line   : position.line + 1,
                column : position.character + 1
            };

            return Promise.resolve(this.elixirSenseClient)
            .then((elixirSenseClient) => checkElixirSenseClientInitialized(elixirSenseClient))
            .then((elixirSenseClient) => elixirSenseClient.send('definition', payload))
            .then((result) => checkTokenCancellation(token, result))
            .then((result) => {
                const [filePath, lineNumberStr] = result.split(':');
                const lineNumber = Number(lineNumberStr) - 1;

                if (!filePath || filePath === 'non_existing') {
                    resolve(undefined);
                    return;
                }

                let location;
                if (lineNumber >= 0) {
                    location = new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(lineNumber, 0));
                } else {
                    location = new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
                }

                resolve(location);
            })
            .catch((err) => {
                console.error('rejecting', err);
                reject();
            });
        });
    }
}
