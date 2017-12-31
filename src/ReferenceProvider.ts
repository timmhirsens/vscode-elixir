'use strict';

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { EngineOptions } from './EngineOptions';


export class ReferenceProvider implements vscode.ReferenceProvider {
    public provideReferences(
        document: vscode.TextDocument, position: vscode.Position,
        options: { includeDeclaration: boolean }, token: vscode.CancellationToken):
        Thenable<vscode.Location[]> {

        return this.getEngineOptions().then((engineOptions) => {
            return this.processSearch(document, position, engineOptions);
        });
    }

    private getEngineOptions(): Promise<EngineOptions> {
        return new Promise<EngineOptions>((resolve, reject) => {

            const engine = vscode.workspace.getConfiguration().get<string>('find.all.references.engine');
            let engine_options = vscode.workspace.getConfiguration().get<string>('find.all.references.options');
            if (engine && engine.length<1) {
                reject(new Error('Error'));
            }
            if (!engine_options) { engine_options = ""}
            // --column is hardcoded because its mandatory for now
            const options = '--column '+engine_options;

            // Note to self: if we pass in the additional space after the shell execution, command doesn't get executed correctly when the argument has an extra space.
            // `rg --column` and not `rg --column `
            return resolve(new EngineOptions(engine === undefined? 'rg': engine, options.trim()));
        });
    }

    private processSearch(document, position, options): Thenable<vscode.Location[]>
    {
        return new Promise<vscode.Location[]>((resolve, reject) => {
            let searchTerm = document.getText(document.getWordRangeAtPosition(position));
            
            //Added by Speedkore for search selected test if exist, instead of word under cursor
            let editor =  vscode.window.activeTextEditor
            let selection = editor.selection
            let selectedText = editor.document.getText(selection); 
            if(selectedText){searchTerm = selectedText}
            // End Speedkore


            let args = options.getOptions().split(' ');
            args.push(searchTerm);
            args.push(vscode.workspace.rootPath);
            // TODO : Introduce the ability to choose different search options ripgrep, silver searcher, git grep, platinum searcher etc
            let rg = child_process.spawnSync(options.getEngine(), args);
            let lines = rg.stdout.toString().split('\n');
            let list = [];

            lines.forEach((item) => {
                let arr = item.split(":");

                if (arr.length>2) {
                    // In case of drive letter
                    if (arr[0].length == 1)
                    {
                        let path = arr.shift() + ':' + arr.shift();
                        arr.unshift(path);
                    }
                    
                    // Position starts from zero refer to vscode.d.ts
                    let line_no = parseInt(arr[1])-1;
                    let col_no = parseInt(arr[2])-1;

                    let start_pos = new vscode.Position(line_no, col_no);
                    let end_pos = new vscode.Position(line_no, col_no+searchTerm.length);
                    let loc = new vscode.Location(vscode.Uri.file(arr[0]), new vscode.Range(start_pos, end_pos));

                    list.push(loc);
                }
            });

            return resolve(list);
        });
    }
}