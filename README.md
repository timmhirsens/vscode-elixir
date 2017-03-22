# Elixir Support for Visual Studio Code 

[![Download](https://vsmarketplacebadge.apphb.com/version-short/mjmcloug.vscode-elixir.svg)](https://marketplace.visualstudio.com/items?itemName=mjmcloug.vscode-elixir)
[![Download](https://vsmarketplacebadge.apphb.com/installs-short/mjmcloug.vscode-elixir.svg)](https://marketplace.visualstudio.com/items?itemName=mjmcloug.vscode-elixir)
[![Gitter](https://img.shields.io/gitter/room/vscode-elixir/Lobby.svg)](https://gitter.im/vscode-elixir/Lobby)
[![Build Status](https://semaphoreci.com/api/v1/fr1zle/vscode-elixir/branches/master/shields_badge.svg)](https://semaphoreci.com/fr1zle/vscode-elixir)

Read the [CHANGELOG](https://github.com/fr1zle/vscode-elixir/blob/master/CHANGELOG.md) to see what has changed in this extension over time.

This extension adds rich elixir language support to VS Code including:

* Syntax Coloring
* Snippets
* Intellisense

### Features

![example](https://raw.githubusercontent.com/fr1zle/vscode-elixir/master/images/example.gif)

## Using

Make sure you have installed elixir with all its dependencies correctly and make sure it's in your path. You can check this by typing `elixir --version` into a terminal.

There currently is no option to change the path of the `elixir` executable. If you feel like there is a need for this, feel free to open up a pull request.

### Autocomplete

Autocomplete/Intellisense is implemented using an older version of [alchemist-server](https://github.com/tonini/alchemist-server) with some patches applied. For the auto complete to work properly, you will have to recompile your source code from time to time (using `mix compile`) for it to pick up the latest changes to your source code.

## Contributors

These wonderful people have so far contributed to this extension. Feel free to add your name here:

* [mat-mcloughlin](https://github.com/mat-mcloughlin)
* [Fahrradflucht](https://github.com/Fahrradflucht)
* [bill-mybiz](https://github.com/bill-mybiz)
* [securingsincit](https://github.com/securingsincity)
* [toddharding](https://github.com/toddharding)
* [mackenza](https://github.com/mackenza)
* [samuelsuarezsanchez](https://github.com/samuelsuarezsanchez)

(This list is in no particular order.)