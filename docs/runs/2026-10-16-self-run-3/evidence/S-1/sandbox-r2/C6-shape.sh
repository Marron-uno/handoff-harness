tee a.md <<'EOF' >/dev/null
x
EOF
tee b.md <<'X' >/dev/null
EOF
echo RAN-AFTER-CR-TERMINATOR-TEE
X