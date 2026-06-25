@echo off
setlocal

echo Setting up the environment for AgentFlow Nebula
echo.

set /p project_name="Enter the project name: "
set "base_path=%cd%"

echo Select source code path:
for /f "delims=" %%i in ('powershell -noprofile -command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select the source code folder'; $f.SelectedPath = 'C:\Users'; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"') do set "source_code_path=%%i"

for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "created_date=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%"

echo.
echo Project Name:      %project_name%
echo Base Path:         %base_path%
echo Source Code Path:  %source_code_path%
echo.

(
    echo property,value
    echo application-name,AgentFlow Nebula
    echo version,2.0.0
    echo project-name,%project_name%
    echo base-path,%base_path%
    echo source-code-path,%source_code_path%
    echo timezone,Asia/Bangkok
    echo created-date,%created_date%
) > database\config\config.csv

mkdir output\report 2>nul
mkdir output\log 2>nul
mkdir output\archive 2>nul

echo Wrote database\config\config.csv
echo Created output\report, output\log, output\archive
echo Setup completed.
pause
