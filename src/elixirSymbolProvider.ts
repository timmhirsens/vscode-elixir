import * as vscode from 'vscode';
import { WorkspaceSymbolProvider, DocumentSymbolProvider, commands } from 'vscode';
import * as fs from 'fs';

enum ElixirSymbol {
    FUNCTION,
    MACRO,
    VALUE,
    MODULE
}

export class ElixirSymbolExtractor {
    keywords = ['defmodule', 'def', 'defp', 'defmacro', 'require', 'alias', 'do', 'end', 'case', 'try', 'rescue', 'do:', 'import', '=']
    tracked = ['defmodule', 'def', 'defp', 'defmacro', '=']
    line
    symbols
    i

    public extractSymbols(src) {
        this.symbols = []
        this.i = 0
        this.line = 1
        let tokens = this.tokenize(this.eraseComments(src))
        let groups = this.processTokens(tokens)
        let foo = this.processGroups(groups)
        return this.symbols
    }

    public extractSymbolsFromFile(file) {
        const src = fs.readFileSync(file, 'utf8')
        return this.extractSymbols(src)
    }

    eraseComments(src) {
        let lines = src.split("\n")
        let erase = false
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim()
            if (line.startsWith("#"))
                lines[i] = ""
            if (line.indexOf("\"\"\"") > -1 && !erase)
                erase = true
            if (line.startsWith("\"\"\"") && erase) {
                lines[i] = ""
                erase = false
            }
            if (erase)
                lines[i] = ""
        }
        return lines.join("\n")
    }

    isValidToken(token: string) {
        return /^[a-z0-9_\?\(\)\,\.\{\}!\=\:"]+$/i.test(token)
    }

    tokenize(src: string) {
        let tokens = []
        let source = src.replace(/\"\"\"w+\"\"\"/, "")
        while (this.i < source.length) {
            const token = this.nextToken(source)
            tokens.push([token, this.line])
        }
        return tokens
    }

    nextToken(source: string) {
        let token = ''
        while (!this.isValidToken(source.charAt(this.i))) {
            this.i++
            if (source.charAt(this.i - 1) == '\n') this.line++
            if (this.i > source.length) break
        }
        while (this.isValidToken(source.charAt(this.i))) {
            token += source.charAt(this.i)
            this.i++
            if (this.i > source.length) break
        }
        return token
    }

    processTokens(tokens) {
        let groups = []
        let current = []
        for (let i = 0; i < tokens.length; i++) {
            const [token, line] = tokens[i]
            if (this.keywords.indexOf(token) > 0) {
                if (current.length > 0) {
                    groups.push(current)
                    current = []
                }
                if (this.tracked.indexOf(token) > 0)
                    current.push([token, line])
            } else {
                current.push([token, line])
            }
        }
        return groups
    }

    processGroups(groups) {
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i]
            const first = group[0]
            const ff = first[0]
            switch (ff) {
                case 'defmodule':
                    this.handleDefmodule(group)
                    break
                case 'def':
                    this.handleDef(group, groups[i - 1], ElixirSymbol.FUNCTION)
                    break
                case 'defp':
                    this.handleDef(group, groups[i - 1], ElixirSymbol.FUNCTION)
                    break
                case 'defmacro':
                    this.handleDef(group, groups[i - 1], ElixirSymbol.MACRO)
                    break
                case '=':
                    this.handleAssignment(groups[i - 1], group)
                    break
                default:
            }
        }
    }

    isValidValue(value) {
        return /^[a-z0-9_\?]+$/i.test(value) && value != '_'
    }

    handleAssignment(g1, g2) {
        const val = g1[g1.length - 1][0]
        const line = g1[g1.length - 1][1]
        if (this.isValidValue(val))
            this.symbols.push([ElixirSymbol.VALUE, val, line])
    }

    handleDefmodule(g) {
        const line = g[0][1]
        const moduleName = g[1][0]
        this.symbols.push([ElixirSymbol.MODULE, moduleName, line])
    }

    parseSignature(sig) {
        if (sig.includes("(")) {
            const bracketStart = sig.indexOf("(")
            const bracketEnd = sig.indexOf(")")
            const args = sig.substring(bracketStart, bracketEnd > -1 ? bracketEnd + 1 : sig.length)
            let arity
            if (args.includes(','))
                arity = args.split(',').length
            else
                arity = 1
            const name = sig.substring(0, bracketStart)
            return [name, arity]
        } else
            return [sig.trim(), 0]
    }

    handleDef(g, g2, type) {
        const line = g[0][1]
        let args = ''
        for (let j = 1; j < g.length; j++) {
            args += g[j][0]
        }
        const sig = args
        const [name, arity] = this.parseSignature(sig)
        this.symbols.push([type, name, arity, line])
    }

    parseModules(m) {
        const x = m.indexOf('{')
        const y = m.indexOf('}')
        if (x >= 0 && y >= 0) {
            const foo = m.substring(0, m.indexOf('.'))
            const z = m.substring(x + 1, y)
            var names = z.split(',')
            for (var j = 0; j < names.length; j++) {
                names[j] = foo + '.' + names[j]
            }
            return names
        }
        return [].push(m)
    }
}

export class ElixirDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument,
        token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise((resolve, reject) => {
            let src = document.getText()
            let symbolExtractor = new ElixirSymbolExtractor()
            let symbols = []
            let foo = symbolExtractor.extractSymbols(src)
            for (let i = 0; i < foo.length; i++) {
                let symbol = foo[i]
                switch (symbol[0]) {
                    case ElixirSymbol.FUNCTION: {
                        let [_, name, arity, line] = symbol
                        symbols.push({
                            name: name + '/' + arity,
                            kind: vscode.SymbolKind.Function,
                            location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                        });
                        break
                    }
                    case ElixirSymbol.MACRO: {
                        let [_, name, arity, line] = symbol
                        symbols.push({
                            name: name + '/' + arity,
                            kind: vscode.SymbolKind.Function,
                            location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                        });
                        break
                    }
                    case ElixirSymbol.MODULE: {
                        let [_, name, line] = symbol
                        symbols.push({
                            name: name,
                            kind: vscode.SymbolKind.Class,
                            location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                        });
                        break
                    }
                    case ElixirSymbol.VALUE: {
                        let [_, name, line] = symbol
                        symbols.push({
                            name: name,
                            kind: vscode.SymbolKind.Field,
                            location: new vscode.Location(document.uri, new vscode.Position(line - 1, 1))
                        });
                        break
                    }
                    default:
                }
            }
            resolve(symbols);
        });
    }
}