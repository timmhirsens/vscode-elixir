import * as vscode from 'vscode';

export const configuration: vscode.LanguageConfiguration = {
  wordPattern: /\w+[\.\w+]*/, //? is this correct?
  indentationRules: {
    increaseIndentPattern: new RegExp("(after|else|catch|rescue|fn|^.*(do|<\\-|\\->|\\{|\\[))\\s*$"),
    decreaseIndentPattern: new RegExp("^\\s*((\\}|\\])\\s*$|(after|else|catch|rescue|end)\\b)")
  },

}
