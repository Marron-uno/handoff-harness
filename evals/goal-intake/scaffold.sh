#!/bin/sh
# Scaffold for the goal-intake case: the plugin's fixture as a git repository with one commit,
# which is what the init and goal skills expect. Runs as you, only with --scaffold.
set -e
root="$(cd "$(dirname "$0")/../.." && pwd)"
if [ ! -d "$root/fixture" ]; then echo "scaffold: no fixture under $root" >&2; exit 1; fi
cp -R "$root/fixture/." .
git init -q -b main
git config user.email eval@example.com
git config user.name Eval
git config commit.gpgsign false
git add .
git commit -qm "fixture: initial"
