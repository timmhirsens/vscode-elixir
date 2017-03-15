import * as vscode from 'vscode';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { configuration } from './elixirConfiguration';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirServer } from './elixirServer';
import { ElixirTest } from './elixirTest';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };

export function activate(ctx: vscode.ExtensionContext) {
    this.elixirServer = new ElixirServer();
    this.elixirServer.start();
    ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, new ElixirAutocomplete(this.elixirServer), '.'));
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELIXIR_MODE, new ElixirDefinitionProvider(this.elixirServer)));
    ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elixir', configuration));

    this.elixirTest = new ElixirTest();
    ctx.subscriptions.push(vscode.commands.registerCommand('elixir.test.cursor', () => {
        return this.elixirTest.testAtCursor();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('elixir.test.file', () => {
        return this.elixirTest.testCurrentFile();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('elixir.test.previous', () => {
        return this.elixirTest.testPrevious();
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('elixir.test.project', () => {
        return this.elixirTest.testProject();
    }));
}

export function deactivate() {
    this.elixirServer.stop();
}
