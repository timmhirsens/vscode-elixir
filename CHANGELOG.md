### v1.1.0: 01 Nov 2017
 - internal refactorings
 - different highlight for variables starting with underscore
 - provide a way to specify the path of a Mix project inside a vscode project (`elixir.projectPath`)
 - merged latest elixir syntax file from atom
 - more details in problem view for compiler warnings
 - support for espec test failures in problem view

### v1.0.0: 04 Sep 2017
 - many internal refactorings
 - fix for starting elixir_sense on windows
 - support elixir_sense in multi folder workspaces
 - fixes to the html / eex language configuration

### v0.5.1: 27 Jul 2017
 - small bugfix for windows
 - update elixir_sense

### v0.5.0: 13 Jun 2017
 - Switched to using Elixir Sense for autocomplete/intellisense.
   If your are having issues with the new implmentation you can switch back to the old one by setting the property
   `elixir.useElixirSense` to `false`

   This feature was implemented by [PotterDai](https://github.com/PotterDai)

### v0.4.1: 04 May 2017
  - Problem matchers for compile warnings fixed

### v0.4.0: 01 May 2017
  - Problem matchers for compile and test errors
  - describe snippet

### v0.3.1: 06 Apr 2017
  - Small bugfix for Windows users

### v0.3.0: 20 Mar 2017
  - implemented a documentation lookup when hovering over code

### v0.2.0: 15 Mar 2017
  - minor fixes for autocompletion issues

### v0.1.2: 09 Mar 2017
  - fix startup issues
  - remove completion of paremter indices for macros
  - fix elixir warnings
  - added braces to autoclosing pairs
  - Enable emmet completion in html.eex files

### v0.1.1: 03 Dec 2016
  - Added autoclosing quotes