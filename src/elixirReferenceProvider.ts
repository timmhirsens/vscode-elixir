import cp = require('child_process');
import * as vscode from 'vscode';

enum Subject {
    MODULE,
    FUNCTION,
    FQ_FUNCTION
}

function extractSubject(src, line, row) {
    let subject = '';
    let j = row;
    if (/^[a-z0-9_\?\.\!]$/i.test(line[row])) {
        while (j >= 0) {
            if (line[j] == ' ') { break; }
            subject = line[j] + subject;
            j--;
        }
        j = row + 1;
        while (j < line.length) {
            if (line[j] == ' ') { break; }
            if (line[j] == '(') { break; }
            subject = subject + line[j];
            j++;
        }
        if (subject.indexOf('.') == - 1) {
            if (subject[0] == subject[0].toUpperCase()) return [Subject.MODULE, subject];
            else return [Subject.FUNCTION, subject];
        }
        else {
            let parts = subject.split('.');
            let last = parts[parts.length - 1]
            if (last[0] == last[0].toUpperCase())
                return [Subject.MODULE, subject];
            else return [Subject.FQ_FUNCTION, subject]
        }
    }
    return undefined;
}

function extractModule(src, lineNo) {
    const lines = src.split('\n');
    const subDoc = lines.slice(0, lineNo).join('\n');
    const x = subDoc.lastIndexOf('defmodule');
    if (x > -1) {
        let j = x + 10;
        let name = '';
        while (/^[a-z0-9_\?\.\!]$/i.test(subDoc[j]) && j < subDoc.length) {
            name += subDoc[j++];
        }
        return name;
    }
    return undefined;
}

function prepareArgs(type, subject, src, line) {
    if (type == Subject.FUNCTION) {
        // find owning module
        const module = extractModule(src, line);
        return module + '.' + subject;
    }
    return subject;
}

export class ElixirReferenceProvider implements vscode.ReferenceProvider {

    public provideReferences(document: vscode.TextDocument, position: vscode.Position, options: { includeDeclaration: boolean }, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        const dir = vscode.workspace.getWorkspaceFolder(document.uri);
        if (dir == undefined)
            vscode.window.showWarningMessage('No workspace is opened. Finding references needs a workspace with a mix project.');
        if (dir.uri.path) {
            //TODO: check if a mix project
            const lineNo = position.line;
            const line = document.lineAt(lineNo).text;
            const src = document.getText();
            const [type, subject] = extractSubject(src, line, position.character);
            const args = prepareArgs(type, subject, src, lineNo);

            return new Promise((resolve, reject) => {
                const cmd = `mix xref callers ${args}`;
                console.log(cmd)
                const cwd = vscode.workspace.rootPath ? vscode.workspace.rootPath : '';
                cp.exec(cmd, { cwd }, (error, stdout, stderr) => {
                    if (error !== null) {
                        const message = 'Error while execuing `mix xref`';
                        vscode.window.showErrorMessage(message);
                        reject(message);
                    }
                    else {
                        const lines = stdout.split('\n');
                        if (lines.length > 1) {
                            let references = [];
                            for (let aline of lines) {
                                let [file, lineNumber, name] = aline.split(':');
                                references.push(new vscode.Location(vscode.Uri.file(cwd + '/' + file),
                                    new vscode.Range(Number(lineNumber) - 1, 0, Number(lineNumber) - 1, 0)));
                            }
                            resolve(references);
                        } else {
                            resolve([]);
                        }
                    }
                })
            });
        }
    }
}
