import * as vscode from 'vscode';
import { ElixirServer } from './elixirServer';

export class ElixirAutocomplete implements vscode.CompletionItemProvider {
  elixirServer: ElixirServer;

  constructor(elixirServer: ElixirServer) {
    this.elixirServer = elixirServer;
  }

  // tslint:disable-next-line:max-line-length
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      this.elixirServer.getCompletions(document, position, (result: vscode.CompletionItem[]) => {
        if (!token.isCancellationRequested) {
          resolve(result);
        } else {
          console.error('rejecting');
          reject();
        }
      });
    });
  }
}
