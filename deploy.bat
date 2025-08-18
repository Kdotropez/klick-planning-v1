@echo off
echo Forcing deployment to Vercel...
git add .
git commit -m "chore(deploy): force new deployment v3.6.1"
git push origin main
echo Deployment triggered!
pause
