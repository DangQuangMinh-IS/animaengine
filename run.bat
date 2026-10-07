@echo off
title Anima Engine Launcher
echo ==============================================
echo   Khoi dong Anima Engine - Hina Desktop Mascot
echo ==============================================
cd /d "%~dp0"

taskkill /f /im app.exe 2>nul
start "" "%~dp0src-tauri\target\release\app.exe"
echo Da khoi chay Anima Engine thanh cong!
