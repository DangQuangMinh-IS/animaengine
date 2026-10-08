@echo off
title Anima Engine Launcher
echo ==============================================
echo   Khoi dong Anima Engine - Blue Archive Mascot
echo ==============================================
cd /d "%~dp0"

taskkill /f /im animaengine.exe 2>nul
taskkill /f /im app.exe 2>nul

if exist "%~dp0animaengine.exe" (
    start "" "%~dp0animaengine.exe"
    echo Da khoi chay Anima Engine (Portable) thanh cong!
    goto done
)

if exist "%~dp0app.exe" (
    start "" "%~dp0app.exe"
    echo Da khoi chay Anima Engine (Portable) thanh cong!
    goto done
)

if exist "%~dp0src-tauri\target\release\animaengine.exe" (
    start "" "%~dp0src-tauri\target\release\animaengine.exe"
    echo Da khoi chay Anima Engine thanh cong!
    goto done
)

if exist "%~dp0src-tauri\target\release\app.exe" (
    start "" "%~dp0src-tauri\target\release\app.exe"
    echo Da khoi chay Anima Engine thanh cong!
    goto done
)

echo [LOI] Khong tim thay tep thuc thi animaengine.exe hoac app.exe!
echo Vui long kiem tra ban da build hoac tai bo phat hanh giai nen chua.
pause

:done
