@echo off
chcp 65001 >nul
title 云上展馆 · 本地服务器
cd /d "%~dp0"
set PORT=8123

set PYEXE=
if exist "C:\Users\watch\AppData\Local\Programs\Python\Python313\python.exe" set PYEXE=C:\Users\watch\AppData\Local\Programs\Python\Python313\python.exe
if not defined PYEXE where python >nul 2>nul && set PYEXE=python
if not defined PYEXE where py >nul 2>nul && set PYEXE=py

if defined PYEXE goto :usepython

where node >nul 2>nul
if errorlevel 1 goto :nofound
start "" http://127.0.0.1:%PORT%/
node "%~dp0server.js" %PORT%
goto :eof

:usepython
start "" http://127.0.0.1:%PORT%/
%PYEXE% -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0site"
goto :eof

:nofound
echo.
echo 没有找到 Python 或 Node，无法启动本地服务器。
echo 你也可以在 site 目录下手动执行: python -m http.server 8123
echo.
pause
