# Demo of the harness CLI on a copy of the fixture. Reproduce from the repository root:
#
#   vhs docs/demo/demo.tape
#
# Needs vhs (https://github.com/charmbracelet/vhs), git, node and jq. Nothing in the
# recording is simulated: every line on screen is the CLI's own output. The one shortcut
# is intake, which in a live run is the model reading the handoff and writing three files;
# here those three files are copied from recorded run 2 (docs/runs/2026-10-14-fixture-run-2),
# and the copy is shown on screen. The harness itself is `git archive HEAD` unpacked under
# /tmp so that the paths the briefs print do not depend on where the checkout lives.

Output docs/demo/goal-card.gif

Set Shell bash
Set FontSize 14
Set Width 1000
Set Height 480
Set Padding 16
Set Framerate 15
Set TypingSpeed 35ms

Hide
Type 'REPO=$PWD; DEMO=$(mktemp -d /tmp/hh-demo.XXXX); mkdir -p $DEMO/handoff-harness $DEMO/lantern; git archive HEAD | tar -x -C $DEMO/handoff-harness; cp -R fixture/. $DEMO/lantern; RUN2=$REPO/docs/runs/2026-10-14-fixture-run-2; cd $DEMO/lantern; git init -q -b main; git config user.email demo@example.com; git config user.name demo; git config commit.gpgsign false; git add .gitignore .harness README.md handoff openspec package.json public src tests; git commit -q -m "fixture: initial"; harness() { node "$DEMO/handoff-harness/scripts/cli.mjs" "$@"; }; clear'
Enter
Sleep 1s
Show

Type 'harness goal new --sentence "build all of the handoff" --source handoff/HANDOFF.md'
Enter
Sleep 2.5s

Type 'cp $RUN2/inventory.json $RUN2/plan.json $RUN2/goal-card.md .harness/   # the intake files recorded in run 2'
Enter
Sleep 1s

Type 'cat .harness/goal-card.md'
Enter
Sleep 6s

Type 'harness next'
Enter
Sleep 2.5s

Type 'harness goal approve'
Enter
Sleep 2.5s

Type 'harness next | jq -r .brief'
Enter
Sleep 6s
