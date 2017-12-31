import * as vscode from 'vscode';
import { ElixirSenseClient } from './elixirSenseClient';

export function checkTokenCancellation(token: vscode.CancellationToken, result: any) {
  if (token.isCancellationRequested) {
    throw new Error('The request was cancelled');
  }
  return result;
}

export function checkElixirSenseClientInitialized(elixirSenseClient: ElixirSenseClient) {
  if (!elixirSenseClient) {
    throw new Error('Elixirsense client not ready');
  }
  return elixirSenseClient;
}
