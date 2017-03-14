export const useRegex = /^\s+use\s+([A-Za-z0-9\.]+)'/gm;
export const aliasRegexAs = /^\s+alias\s+([-:_A-Za-z0-9,\.\?!]+)(\s*,\s*as:\s*)?([-_A-Za-z0-9,\.\?!]+)?/gm;
export const importRegex = /^\s+import\s+([A-Za-z0-9\.]+)/gm;

export function getUsedModules(documentText: string): Array<string> {
    return useRegex.exec(documentText);
}

export function getAliases(documentText: string): Array<string> {
    const aliasRegex = /^\s+alias\s+([-:_A-Za-z0-9,\.\?!]+)\.{([-:_A-Za-z0-9\s,\.\?!]+)}/gm;
    let m: RegExpExecArray;
    const aliases = new Array<string>();

    while ((m = aliasRegex.exec(documentText)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === aliasRegex.lastIndex) {
            aliasRegex.lastIndex++;
        }

        // The result can be accessed through the `m`-variable.
        const modulePrefix = m[1];
        m[2].split(',').forEach(name => {
            name = name.trim();
            aliases.push(`{${name}, ${modulePrefix}.${name}}`)
        });
    }
    return aliases;
}

export function getImports(documentText: string): Array<string> {
    return importRegex.exec(documentText);
}

export function buildContext(documentText: string): string {
    const aliasesTwoPlus = getAliases(documentText);
    const aliasesJoined = aliasesTwoPlus.join(', ');
    const aliasesString = `[${aliasesJoined}]`;
    return `[ context: Elixir, imports: [], aliases: ${aliasesString} ]`;
}