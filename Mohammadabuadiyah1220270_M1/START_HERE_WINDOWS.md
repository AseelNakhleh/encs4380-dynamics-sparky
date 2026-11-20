# ENCS4380 M1: Official HAL Integration — Windows/VS Code

This package combines the **professor's uploaded starter-kit HAL files unchanged** with an implemented **`solver.c`** that calls **only the official HAL**. This replaces the separate local-only project used for the first 56 tests.

## 1 — Extract and open

1. Extract `Micromouse_M1_Official_HAL_Ready.zip` to the Desktop. Avoid a path with spaces if possible (e.g. `C:\Users\ahlag\Desktop\Micromouse_M1_Official_Integrated`).
2. Open the extracted `Micromouse_M1_Official_Integrated` folder in VS Code (`File` → `Open Folder`).
3. Open `solver.c`; near the top replace `#define TEAM_ID "T00"` with the **real team ID** assigned on the course sign-up sheet.
4. Keep these professor files unchanged: `mouse_hal.h`, `hal_sim.c`, `mm_internal.h`, `mm_common.c`, `main_sim.c`, `example_wallfollow.c`.

## 2 — Compile in VS Code PowerShell

You have GCC 16.2.0 installed via MSYS2 UCRT64. In the VS Code **Terminal**, run:

```powershell
$env:Path += ";C:\msys64\ucrt64\bin"
gcc --version
gcc -O2 -std=c99 -Wall -Wextra -o solver.exe main_sim.c hal_sim.c mm_common.c solver.c
```

No output on the last line usually means compilation succeeded; `solver.exe` will appear in the same folder.

**IMPORTANT: DO NOT run `./solver.exe` by itself in PowerShell.** This is NOT the old standalone test program. It speaks the mms simulator protocol through stdin/stdout and needs the `mms` graphical program (or the supplied offline test harness) to respond.

## 3 — Test the official HAL without installing the graphical simulator (optional)

If Python is available:

```powershell
python tests\mock_mms.py --quick
python tests\mock_mms.py
```

This testing harness emulates `mms` protocol messages and validates the professor's map dump and shortest race. It is **not** an official GUI test and does not count as the final professor demonstration.

## 4 — Run inside the actual mms simulator

The professor's uploaded `README.md` calls for the `mms` simulator from https://github.com/mackorone/mms/releases, or the course Moodle VM.

1. Open `mms.exe` (download Windows release or use Moodle VM).
2. Click **+** in the **Mouse** section, and enter:
   - **Name:** your team ID / Micromouse name
   - **Directory:** the extracted **official integrated** folder containing `solver.c` and `mouse_hal.h`
   - **Build command (Windows):** `gcc -O2 -std=c99 -o solver.exe main_sim.c hal_sim.c mm_common.c solver.c`
   - **Run command:** `solver.exe`
3. Load **`mazes/mms_sample_8x8.txt`** using the **Maze** button (the `.txt` file, *not* the `.maze` file).
4. Click **Run**. The cells should show flood-fill numbers via `mm_label`; the mouse should reach the goal, explore, return, then make a shortest-known-path run.
5. Check the simulator output/debug panel for messages `GOAL REACHED`, `HOME REACHED`, `RACE COMPLETE`, and map lines beginning `@MAP` and ending `@END`.
6. Take a screenshot showing flood-fill numbers on the actual **mms** screen for your submission.

**Older mms versions:** If your mms build rejects `moveForward 1`, add `-DMM_SIM_SINGLE_STEPS` immediately after `gcc` in the build command.

## 5 — Set a different goal

The official HAL expects `mm_goal.txt` in the **simulator working directory**, with a comma-separated value (`4,4` or `3,3,4,4`). For example, in VS Code PowerShell **before starting a new run**:

```powershell
Copy-Item .\mazes\mms_changed_goal_10x7.goal .\mm_goal.txt -Force
```

Now load `mazes/mms_changed_goal_10x7.txt` in mms and run. **Remove `mm_goal.txt` after that run** to return to the default center goal:

```powershell
Remove-Item .\mm_goal.txt
```

*The older standalone local test `.goal` files use spaces (e.g. `4 4`) and are NOT accepted by the professor's `mm_goal.txt` parser.* Use the `mms_*.goal` files or the comma format.

## 6 — What each file does

| File | Owner / purpose |
|---|---|
| `solver.c` | **Algorithm lead:** 4-bit map, pose, BFS flood, explore, home, race, majority sensing, map dump |
| `mouse_hal.h` | **Professor — do not edit.** Official C API and N/E/S/W bit layout |
| `hal_sim.c`, `main_sim.c`, `mm_common.c`, `mm_internal.h` | **Professor — do not edit.** mms protocol, log, map dump CRC |
| `mazes/mms_*.txt` | Custom ASCII mazes loadable via mms **Maze** button |
| `mazes/mms_*.goal` | Comma-separated goals for `mm_goal.txt` |
| `mazes/*.maze`, `mazes/*.goal` | Standalone **offline test harness** data only; not for mms GUI |
| `tests/mock_mms.py` | Simulates the real HAL's stdin/stdout messages to test before GUI |

## 7 — Submission / lab demo

- Show the **actual mms GUI** with flood-fill numbers and the mouse reaching the goal, returning home and racing.
- Verify the map dump (`@MAP`, `@C` for every cell, `@END`) using the official `mm_common.c`, which calculates a CRC checksum.
- Load a different-size maze and a different goal, and demo `mazes/mms_wall_follower_trap_8x8.txt` as your own maze.
- In the team Git repo, commit your actual `solver.c` contribution. The project lead creates the group `M1` tag once integration is validated.
- All four leads must be prepared to explain BFS and what happens after a bad wall reading.

## Verified here vs still required

**Verified by us:** Official sources compile as C99 with warnings enabled. 86 protocol-level offline tests passed (6 prepared + 70 random + 10 multi-cell-goal tests); all returned home, finished shortest paths, produced valid CRC dumps and correct wall maps.

**Not yet verified:** Running inside the actual mms graphical app, professor's hidden mazes, and submission to Moodle. Those steps require the student's computer/course environment.
