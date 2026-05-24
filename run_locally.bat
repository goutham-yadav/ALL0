@echo off
title Allo Inventory - Local Server Runner
cls

echo ============================================================
echo           Allo Inventory - Starting Local Environment
echo ============================================================
echo.

:: 1. Verify that .env exists
if not exist .env (
    echo [WARNING] No .env file found in the root directory!
    echo Please make sure to create a .env file containing your DATABASE_URL,
    echo UPSTASH_REDIS_REST_URL, and UPSTASH_REDIS_REST_TOKEN.
    echo.
    pause
    exit /b 1
)

:: 2. Run Prisma migrations
echo [1/3] Running database migrations...
call npx prisma migrate dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Database migration failed.
    echo Please verify your DATABASE_URL in the .env file.
    echo.
    pause
    exit /b %errorlevel%
)

:: 3. Seed Database
echo.
echo [2/3] Seeding the database with initial products...
call npx prisma db seed
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Database seeding failed.
    echo.
    pause
    exit /b %errorlevel%
)

:: 4. Start Next.js server
echo.
echo [3/3] Launching Next.js development server...
echo.
echo ------------------------------------------------------------
echo 👉 Open http://localhost:3000 in your browser to get started!
echo ------------------------------------------------------------
echo.
call npm run dev

pause
