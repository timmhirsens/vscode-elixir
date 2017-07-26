import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';
import { checkElixirSenseClientInitialized, checkTokenCancellation } from './elixirSenseValidations';

function validateResultIsNotNone(result: any) {
    if (result === 'none') {
        throw new Error();
    }
    return result;
}

export class ElixirSenseSignatureHelpProvider implements vscode.SignatureHelpProvider {

    constructor(private elixirSenseClient: ElixirSenseClient) { }

    provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.SignatureHelp> {
        return new Promise((resolve, reject) => {

            const payload = {
                buffer : document.getText(),
                line   : position.line + 1,
                column : position.character + 1
            };

            return Promise.resolve(this.elixirSenseClient)
            .then((elixirSenseClient) => checkElixirSenseClientInitialized(elixirSenseClient))
            .then((elixirSenseClient) => elixirSenseClient.send('signature', payload))
            .then((result) => checkTokenCancellation(token, result))
            .then((result) => validateResultIsNotNone(result))
            .then((result) => {
                let paramPosition = result.active_param;
                const pipeBefore = result.pipe_before;
                let signatures = result.signatures.filter((sig) => sig.params.length > paramPosition);
                if (signatures.length === 0 && result.signatures.length > 0) {
                    signatures = result.signatures.slice(result.signatures.length - 1, result.signatures.length);
                    if (signatures[0].params[signatures[0].params.length - 1].includes('\\ []')) {
                        paramPosition = signatures[0].params.length - 1;
                    }
                }
                const vsSigs = this.processSignatures(signatures);

                const signatureHelper = new vscode.SignatureHelp();
                signatureHelper.activeParameter = paramPosition;
                signatureHelper.activeSignature = 0;
                signatureHelper.signatures = vsSigs;

                resolve(signatureHelper);
            })
            .catch((err) => {
                console.error('rejecting', err);
                reject();
            });
        });
    }

    processSignatures(signatures): vscode.SignatureInformation[] {
        return Array.from(signatures).map((s) => this.genSignatureInfo(s));
    }

    genSignatureInfo(signature): vscode.SignatureInformation {
        const si = new vscode.SignatureInformation(signature.name + '(' + signature.params.join(', ') + ')', signature.documentation + '\n' + signature.spec);
        si.parameters = Array.from(signature.params).map((p) => this.genParameterInfo(p));
        return si;
    }

    genParameterInfo(param): vscode.ParameterInformation {
        return new vscode.ParameterInformation(param);
    }
}
