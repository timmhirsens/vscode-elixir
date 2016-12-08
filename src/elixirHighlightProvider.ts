import * as vscode from 'vscode';

export class ElixirHighlightProvider implements vscode.DocumentHighlightProvider {

  balancedPairs: BalancedPair[];

  constructor() { }

  provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.DocumentHighlight[] {
    const result = this.balancedPairs.find(pair => (
      pair.entry.start.line === position.line ||
      pair.end.start.line === position.line));
    if (result) {
      return [new vscode.DocumentHighlight(result.entry, 2), new vscode.DocumentHighlight(result.end, 2)];
    }
  }

  balanceEvent(event: vscode.TextEditor) {
    if (event && event.document) {
      this.balancePairs(event.document);
    }
  }

  balancePairs(document: vscode.TextDocument) {
    this.balancedPairs = [];
    if (document.languageId !== 'elixir') {
      return;
    }
    const waitingEntries: vscode.Range[] = [];
    let entry: vscode.Range;
    let end: vscode.Range;
    for (let i = 0; i < document.lineCount; i++) {
      if ((entry = this.getEntry(document.lineAt(i)))) {
        waitingEntries.push(entry);
      } else if (waitingEntries.length && (end = this.getEnd(document.lineAt(i)))) {
        this.balancedPairs.push({
          entry: waitingEntries.pop(),
          end: end
        });
      }
    }


  }

  getEntry(line: vscode.TextLine): vscode.Range {
    let match = line.text.match(/^(?!.*do\:)(\s*)(def|defp|defmodule|defmacro|quote|case|cond|if|unless|try)\b.*$/);
    if (match) {
      return new vscode.Range(line.lineNumber, match[1].length, line.lineNumber, match[1].length + match[2].length);
    } else {
      match = line.text.match(/\b(do)\b\s*(\|.*\|[^;]*)?$/);
      if (match) {
        return new vscode.Range(line.lineNumber, match.index, line.lineNumber, match.index + 2);
      } else {
        match = line.text.match(/(?!.*do\:)\b(fn)\b.*$/);
        if (match) {
          return new vscode.Range(line.lineNumber, match.index, line.lineNumber, match.index + 2);
        }
      }
    }
  }

  getEnd(line: vscode.TextLine): vscode.Range {
    //end must be on a line by itself, or followed directly by a dot
    const match = line.text.match(/^(\s*)end\b[\.\s#]?\s*$/);
    if (match) {
      return new vscode.Range(line.lineNumber, match[1].length, line.lineNumber, match[1].length + 3);
    }

  }

}

interface BalancedPair {
  entry: vscode.Range;
  end: vscode.Range;
}