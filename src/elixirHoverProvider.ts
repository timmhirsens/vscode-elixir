import * as vscode from 'vscode';
import { ElixirServer } from './elixirServer';

export class ElixirHoverProvider implements vscode.HoverProvider {
  constructor(private server: ElixirServer) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
    return new Promise((resolve, reject) => {
      this.server.getDocumentation(document, position, (hover: vscode.Hover) => {
        if (!token.isCancellationRequested) {
          resolve(hover);
        } else {
          console.error('rejecting');
          reject();
        }
      });
    });
  }
}
