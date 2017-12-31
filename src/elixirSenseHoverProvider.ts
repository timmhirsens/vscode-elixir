import { join, sep } from 'path';
import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';
import { checkElixirSenseClientInitialized, checkTokenCancellation } from './elixirSenseValidations';

export class ElixirSenseHoverProvider implements vscode.HoverProvider {
  constructor(private elixirSenseClient: ElixirSenseClient) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
    return new Promise((resolve, reject) => {
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

      const payload = {
        buffer: document.getText(),
        line: position.line + 1,
        column: position.character + 1
      };

      return resultPromise
        .then((elixirSenseClient: ElixirSenseClient) => elixirSenseClient.send('docs', payload))
        .then(result => checkTokenCancellation(token, result))
        .then(result => {
          const { actual_subject, docs } = result;
          if (!docs) {
            console.error('rejecting');
            reject();
            return;
          }
          const wordAtPosition = document.getWordRangeAtPosition(position);
          const hover = new vscode.Hover(docs.docs, wordAtPosition);
          resolve(hover);
        })
        .catch(err => {
          console.error('rejecting', err);
          reject();
        });
    });
  }
}
