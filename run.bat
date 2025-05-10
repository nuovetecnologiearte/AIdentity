@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr "IPv4"') do (
    set ip=%%A
    set ip=!ip:~1!
)

echo IPAddress=!ip! >> config.ini
echo IP saved in config.ini

set newline=const localIP = 'http://!ip!:3001';
(
    echo !newline!
    more +1 client_script.js
) > temp_script.js

move /Y temp_script.js client_script.js

echo client_script.js updated with localIP

start "Node Server" cmd /k "cd /d %SCRIPT_DIR% && node server.js"

start "Live Server" cmd /k "cd /d %SCRIPT_DIR% && live-server --host=0.0.0.0"

endlocal
