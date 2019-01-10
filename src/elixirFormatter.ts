'use strict';

import cp = require('child_process');
import path = require('path');
import vscode = require('vscode');

export class ElixirFormatterProvider implements vscode.DocumentFormattingEditProvider {

  public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
    return this.runFormatter(document, token).then(edits => edits, err => {
      const message = `Can not format due to syntax errors: ${err}`;

      console.log(err);
      vscode.window.showErrorMessage(message);
      return Promise.reject(message);
    });
  }

  private runFormatter(document: vscode.TextDocument, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
    return new Promise<vscode.TextEdit[]>((resolve, reject) => {
      const cwd = path.dirname(document.fileName);
      const p = cp.spawn('mix', ['format', '-'], { cwd });
      let stdout = '';
      let stderr = '';

      // Kill the formatter process if the formatter is canceled by some reason.
      token.onCancellationRequested(() => !p.killed && p.kill());
      // Fetch stdout and stderr from the formatter process.
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', data => stdout += data);
      p.stderr.on('data', data => stderr += data);
      // Abort the formatting if the formatter process errors.
      p.on('error', err => reject());
      // Replace the editor text with formatted code once the formatter finishes. We return the
      // complete file content in the edit. VS Code will calculate the minimall edits to be applied.
      p.on('close', code => {
        if (code !== 0) {
          return reject(stderr);
        }
        const fileStart = new vscode.Position(0, 0);
        const fileEnd = document.lineAt(document.lineCount - 1).range.end;
        const textEdits: vscode.TextEdit[] = [new vscode.TextEdit(new vscode.Range(fileStart, fileEnd), stdout)]

        return resolve(textEdits);
      });
      // Once the process is running, pass the entire document text to it so it gets formatted.
      if (p.pid) {
        p.stdin.end(document.getText());
      }
    });
  }

}
