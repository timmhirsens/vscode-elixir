import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';

export class ElixirSenseSignatureHelpProvider implements vscode.SignatureHelpProvider {

    constructor(private elixirSenseClient: ElixirSenseClient) { }

    provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.SignatureHelp> {
        return new Promise((resolve, reject) => {

            if (!this.elixirSenseClient) {
                console.log("ElixirSense client not ready");
                console.error('rejecting');
                reject();
                return;
            }

            this.elixirSenseClient.send("signature", { buffer: document.getText(), line: position.line + 1, column: position.character + 1 }, result => {

                if (token.isCancellationRequested) {
                    console.error('rejecting');
                    reject();
                    return;
                }

                if (result === 'none') {
                    console.error('rejecting');
                    reject();
                    return;
                }

                let paramPosition = result.active_param;
                let pipeBefore = result.pipe_before;
                let signatures = result.signatures.filter(sig => sig.params.length > paramPosition);
                if(signatures.length == 0 && result.signatures.length > 0)
                {
                    signatures = result.signatures.slice(result.signatures.length - 2, 1);
                    if(signatures[0].params[signatures[0].params.length - 1].includes("\\ []"))
                        paramPosition = signatures[0].params.length - 1;
                }

                let vsSigs = this.processSignatures(signatures)

                let sig = new vscode.SignatureHelp();
                sig.activeParameter = paramPosition;
                sig.activeSignature = 0;
                sig.signatures = vsSigs;

                resolve(sig);
            });
        });
    }

    processSignatures(signatures): vscode.SignatureInformation[] {
        return Array.from(signatures).map(s => this.genSignatureInfo(s));
    }

    genSignatureInfo(signature): vscode.SignatureInformation {
        let si = new vscode.SignatureInformation(signature.name + "(" + signature.params.join(", ") + ")", signature.documentation + '\n' + signature.spec);
        si.parameters = Array.from(signature.params).map(p => this.genParameterInfo(p));
        return si;
    }

    genParameterInfo(param): vscode.ParameterInformation {
        let pi = new vscode.ParameterInformation(param);
        return pi;
    }
}