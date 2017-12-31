import cp = require('child_process');
import * as vscode from 'vscode';

export class ElixirFormatterProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): vscode.TextEdit[] | Thenable<vscode.TextEdit[]> {
    return document.save().then(() => {
      return formatDocument(document);
    });
  }
}

const formatDocument = (document: vscode.TextDocument): Thenable<vscode.TextEdit[]> => {
  return new Promise((resolve, reject) => {
    const filename = document.fileName;
    const checkVersion = `elixir --version`;
    const cmd = `mix format ${document.fileName}`;
    console.log(`cmd line:${cmd}`);
    const cwd = vscode.workspace.rootPath ? vscode.workspace.rootPath : '';
    cp.exec(checkVersion, { cwd }, (versionError, versionStdout, versionStderr) => {
      if (versionError !== null) {
        const message = `Cannot format due to syntax errors.: ${versionStderr}`;
        console.log(`exec error: ${versionStderr}`);
        vscode.window.showErrorMessage(message);
        return reject(message);
      } else {
        if (versionStdout.indexOf('Elixir 1.6') !== -1) {
          cp.exec(cmd, { cwd }, (error, stdout, stderr) => {
            if (error !== null) {
              const message = `Cannot format due to syntax errors.: ${stderr}`;
              console.log(`exec error: ${stderr}`);
              vscode.window.showErrorMessage(message);
              return reject(message);
            } else {
              return resolve();
            }
          });
        } else {
          reject('version 1.6 is required to format');
        }
      }
    });
  });
};
