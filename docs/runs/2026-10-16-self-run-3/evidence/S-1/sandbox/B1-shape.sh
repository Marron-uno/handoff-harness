git() { printf 'git-arg[%s]\n' "$@"; }
git push origin goal/G-3 $(
echo main
)
