
@echo off
cd /d "C:\Users\ahlag\Desktop\Micromouse_M1_Official_HAL_Ready\Micromouse_M1_Official_Integrated"
set "PATH=C:\msys64\ucrt64\bin;%PATH%"

"C:\msys64\ucrt64\bin\gcc.exe" -O2 -std=c99 -Wall -Wextra -o solver_new.exe main_sim.c hal_sim.c mm_common.c solver.c

exit /b %errorlevel%
