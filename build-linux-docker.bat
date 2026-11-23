@echo off
echo ===================================================
echo Building Linux packages via Docker (electronuserland)
echo ===================================================
docker run --rm -ti -v "%cd%:/project" -w /project electronuserland/builder:wine npm run build:linux
pause
