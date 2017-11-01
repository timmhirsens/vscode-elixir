# Elixir Support for Visual Studio Code

[![Download](https://vsmarketplacebadge.apphb.com/version-short/mjmcloug.vscode-elixir.png)](https://marketplace.visualstudio.com/items?itemName=mjmcloug.vscode-elixir)
[![Download](https://vsmarketplacebadge.apphb.com/installs-short/mjmcloug.vscode-elixir.png)](https://marketplace.visualstudio.com/items?itemName=mjmcloug.vscode-elixir)
[![Gitter](https://img.shields.io/gitter/room/vscode-elixir/Lobby.png)](https://gitter.im/vscode-elixir/Lobby)
[![Build Status](https://semaphoreci.com/api/v1/fr1zle/vscode-elixir/branches/master/shields_badge.png)](https://semaphoreci.com/fr1zle/vscode-elixir)

Read the [CHANGELOG](https://github.com/fr1zle/vscode-elixir/blob/master/CHANGELOG.md) to see what has changed in this extension over time.

This extension adds rich elixir language support to VS Code including:

* Syntax Coloring
* Snippets
* Intellisense

### Features

#### Autocomplete
![example](https://raw.githubusercontent.com/fr1zle/vscode-elixir/master/images/example.gif)
#### Problems
![problems](https://raw.githubusercontent.com/fr1zle/vscode-elixir/master/images/problems.gif)

Theme used in the examples: 'Atom One Dark'

## Using

Make sure you have installed elixir with all its dependencies correctly and make sure it's in your path. You can check this by typing `elixir --version` into a terminal.

There currently is no option to change the path of the `elixir` executable. If you feel like there is a need for this, feel free to open up a pull request.

### Autocomplete

Autocomplete/Intellisense is implemented using the wonderful [ElixirSense](https://github.com/msaraiva/elixir_sense) project. For the auto complete to work properly, you will have to recompile your source code from time to time (using `mix compile`) for it to pick up the latest changes to your source code.

If your are having issues with the new implmentation you can switch back to the old one (alchemist server) by setting the property `elixir.useElixirSense` to `false`

### Problem Reporting

To get compile warning / errors and test failures in your problem view, add the following to your `.vscode/tasks.json`:

```json
{
  "version": "0.1.0",
  "command": "mix",
  "isShellCommand": true,
  "showOutput": "always",
  "suppressTaskName": true,
  "tasks": [
    {
      "taskName": "build",
      "args": [
        "compile"
      ],
      "problemMatcher": [
        "$mixCompileError",
        "$mixCompileWarning"
      ],
      "isBuildCommand": true
    },
    {
      "taskName": "test",
      "args": [
        "test"
      ],
      "problemMatcher": [
        "$mixCompileError",
        "$mixCompileWarning",
        "$mixTestFailure"
      ],
      "isTestCommand": true
    }
  ]
}
```

See https://go.microsoft.com/fwlink/?LinkId=733558 for the documentation about the tasks.json format

### Emmet completions

To get Emmet support in `html.eex` files add the following to your user settings (`Ctrl + ,`):

```json
"emmet.includeLanguages": {"HTML (Eex)": "html"}
```

## Contributors

These wonderful people have so far contributed to this extension. Feel free to add your name here:

* [mat-mcloughlin](https://github.com/mat-mcloughlin)
* [PotterDai](https://github.com/PotterDai)
* [Fahrradflucht](https://github.com/Fahrradflucht)
* [bill-mybiz](https://github.com/bill-mybiz)
* [securingsincit](https://github.com/securingsincity)
* [toddharding](https://github.com/toddharding)
* [mackenza](https://github.com/mackenza)
* [samuelsuarezsanchez](https://github.com/samuelsuarezsanchez)
* [untra](https://github.com/untra)

(This list is in no particular order.)
