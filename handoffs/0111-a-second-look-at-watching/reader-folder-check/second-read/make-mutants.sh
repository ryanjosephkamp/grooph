#!/bin/bash
# Reader's script: makes copies of pin2 under reader2/, each with one change to what a session is handed, and runs the runner's test file in each; writes only under reader2/.
S="$1"; R="$S/reader2"; P=scripts/lib/watching-second-look-paid.mjs
for m in m0 mA mB mC mD mH; do rm -rf "$R/$m"; cp -Rc "$S/pin2" "$R/$m"; done
echo "// a comment and nothing else" >> "$R/m0/$P"
sed -i '' '959s/minutes: watchdog.minutes, closed/minutes: watchdog.minutes * 2, closed/' "$R/mA/$P"
sed -i '' '959s/^    call = await runSession/    writeFileSync(join(layout(home).profile, "CLAUDE.md"), "A recorder is watching this session.\\n"); call = await runSession/' "$R/mB/$P"
sed -i '' '698s/$/ if (run.arm === "outside") for (const pkg of task.packages) spawnSync("chmod", ["a-w", join(cwd, pkg.folder, "package.json")]);/' "$R/mC/$P"
sed -i '' '246s/$/ command.env.TERM = "xterm"; command.env.LANG = "C";/' "$R/mD/scripts/lib/study-three-paid.mjs"
sed -i '' '702s/^/  spawnSync("git", ["-C", project.cwd, "config", "grooph.watched", "true"], { env: { PATH: process.env.PATH ?? "" } });\n/' "$R/mH/$P"
for m in m0 mA mB mC mD mH; do diff <(cd "$S/pin2" && cat $P scripts/lib/study-three-paid.mjs) <(cd "$R/$m" && cat $P scripts/lib/study-three-paid.mjs) | grep -c '^[<>]' | sed "s/^/$m changed lines: /"; done
for m in m0 mA mB mC mD mH; do (cd "$R/$m" && node --test scripts/lib/watching-second-look-paid.test.mjs > "$R/$m-out.txt" 2>&1; echo "exit $?" >> "$R/$m-out.txt") & done; wait
for m in m0 mA mB mC mD mH; do echo "== $m: $(grep -c '^✔' $R/$m-out.txt) pass, $(grep -c '^﹣' $R/$m-out.txt) skipped"; grep "^✖" "$R/$m-out.txt" | sort -u | grep -v "failing tests" | cut -c1-110; done
