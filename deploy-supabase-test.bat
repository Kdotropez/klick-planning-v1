@echo off
echo Deploying version 3.6.3 with Supabase debugging and async fix...
git add .
git commit -m "fix: correct async/await in handleManualSave v3.6.3"
git push origin main
echo Deployment triggered! Check Vercel for build status.
pause
