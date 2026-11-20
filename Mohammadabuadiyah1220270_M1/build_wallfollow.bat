
@echo off
cd /d "C:\Users\ahlag\Desktop\Micromouse_M1_Official_HAL_Ready\Micromouse_M1_Official_Integrated"
set "PATH=C:\msys64\ucrt64\bin;%PATH%"

"C:\msys64\ucrt64\bin\gcc.exe" -O2 -std=c99 -o wallfollow.exe main_sim.c hal_sim.c mm_common.c example_wallfollow.c

exit /b %errorlevel%
