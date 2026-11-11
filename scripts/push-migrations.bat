// scripts/push-migrations.bat
@echo off
setlocal

rem Apply pending migrations to the linked Supabase project.
supabase db push --remote
if errorlevel 1 exit /b %errorlevel%

echo Migrations applied successfully.
