@echo off
chcp 65001 > nul
echo ===================================================
echo   🌅 HAZM - GitHub Uploader | رافع المشروع لجيت هاب
echo ===================================================
echo.

:: Check if git is initialized
if not exist .git (
    echo [ERROR] Git is not initialized here! Initializing...
    git init
)

set /p repolink="الرجاء إدخال رابط مستودع GitHub (مثال: https://github.com/moham/hazm.git): "

:: Remove quotes if any
set repolink=%repolink:"=%

if "%repolink%"=="" (
    echo [ERROR] Link cannot be empty!
    pause
    exit /b
)

:: Check if remote 'origin' already exists
git remote get-url origin >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Remote 'origin' already exists. Updating it...
    git remote set-url origin %repolink%
) else (
    echo [INFO] Adding remote 'origin'...
    git remote add origin %repolink%
)

:: Get the current branch name
for /f "tokens=*" %%i in ('git branch --show-current') do set current_branch=%%i
if "%current_branch%"=="" set current_branch=main

echo [INFO] Adding all files to git staging...
git add .

echo [INFO] Committing changes...
git commit -m "Update Hazm Life OS"

echo [INFO] Pushing code to branch: %current_branch%...
git push -u origin %current_branch%

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo   ✨ Done! Code uploaded successfully to GitHub! ✨
    echo ===================================================
) else (
    echo.
    echo [ERROR] Failed to push code to GitHub. Please check your credentials and internet connection.
)

pause
