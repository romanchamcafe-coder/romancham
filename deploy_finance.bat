@echo off
cd /d D:\romancham-final
if exist .git\index.lock del /f /q .git\index.lock
(
echo === git add ===
git add -A
echo === git commit ===
git commit -m "Ops Phase 3 (Finance): P&L dashboard + daily cash reconciliation"
echo === git push ===
git push rc main 2>&1
echo === git log ===
git log --oneline -3
echo === DONE ===
) > D:\romancham-final\deploy_result.txt 2>&1
