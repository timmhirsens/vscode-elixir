import * as vscode from 'vscode';
import * as cp from 'child_process';

export class ElixirTest {
    cp: cp.ChildProcess;
    lastTestArgs: string[];
    outputChannel: vscode.OutputChannel;

    constructor() {
        // TODO: Maybe move this up and call it 'mix' or 'elixir'?
        this.outputChannel = vscode.window.createOutputChannel('Elixir Test');
    }

    testAtCursor() {
        const editor = this.currentTestEditor();
        if (!editor) { return; };
        const filePath = editor.document.fileName;
        const lineNumber = editor.selection.start.line;
        this.test([`${filePath}:${lineNumber}`]);
    }

    testCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; };
        this.test([editor.document.fileName]);
    }

    testPrevious() {
        if (!this.lastTestArgs) {
            vscode.window.showInformationMessage('No test has been recently executed.');
            return;
        }
        this.test(this.lastTestArgs);
    }

    testProject() {
        return this.test([]);
    }

    private test(args: string[]) {
        this.lastTestArgs = args;
        return new Promise((resolve, reject) => {
            this.outputChannel.clear();
            this.outputChannel.show(true);

            const rootPath = vscode.workspace.rootPath;
            if (!rootPath) {
                vscode.window.showInformationMessage('No project is open.');
                return;
            }
            this.cp = cp.spawn('mix', ['test'].concat(args), { cwd: vscode.workspace.rootPath });
            this.cp.stdout.on(
                'data',
                chunk => this.outputChannel.append(chunk.toString())
            );
            this.cp.stderr.on(
                'data',
                chunk => this.outputChannel.append(chunk.toString())
            );
            this.cp.on('close', code => {
                if (code) {
                    this.outputChannel.append('Error: Tests failed.');
                } else {
                    this.outputChannel.append('Success: Tests passed.');
                }
                resolve(code === 0);
            });
        });
    }

    private currentTestEditor(): vscode.TextEditor | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No editor is active.');
            return;
        }
        // TODO: Make this pattern configurable (like mix test)
        if (!editor.document.fileName.endsWith('_test.exs')) {
            vscode.window.showInformationMessage('Current file is not a test file.');
            return;
        }
        return editor;
    }
}
