import * as vscode from 'vscode';
//import { ElixirSense } from './elixirSense';
import { ElixirSenseClient } from './elixirSenseClient';

export class ElixirSenseHoverProvider implements vscode.HoverProvider {

    constructor(private elixirSenseClient: ElixirSenseClient) { }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
        return new Promise((resolve, reject) => {

            if (!this.elixirSenseClient) {
                console.log("ElixirSense client not ready");
                console.error('rejecting');
                reject();
                return;
            }

            this.elixirSenseClient.send("docs", { buffer: document.getText(), line: position.line + 1, column: position.character + 1 }, result => {

                if (token.isCancellationRequested) {
                    console.error('rejecting');
                    reject();
                    return;
                }

                let { actual_subject, docs } = result;

                if (!docs) {
                    console.error('rejecting');
                    reject();
                    return;
                }

                const wordAtPosition = document.getWordRangeAtPosition(position);
                const hover = new vscode.Hover(docs.docs, wordAtPosition);
                resolve(hover);

            });

            /*
            this.server.getDocumentation(document, position, (hover: vscode.Hover) => {
                if (!token.isCancellationRequested) {
                    resolve(hover);
                } else {
                    console.error('rejecting');
                    reject();
                }
            });
            */

        });
    }
}