@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ReyesFruitHub - servidor local
echo  ------------------------------
echo  Abre en el navegador:  http://localhost:8080
echo  Para detenerlo: cierra esta ventana o presiona Ctrl+C
echo.
start "" "http://localhost:8080"
php -S localhost:8080 servidor.php
