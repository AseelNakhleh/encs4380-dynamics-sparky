
CC     ?= gcc
CFLAGS ?= -O2 -std=c99 -Wall -Wextra
HAL     = main_sim.c hal_sim.c mm_common.c
HDRS    = mouse_hal.h mm_internal.h

solver: $(HAL) solver.c $(HDRS)
	$(CC) $(CFLAGS) -o $@ $(HAL) solver.c

example: $(HAL) example_wallfollow.c $(HDRS)
	$(CC) $(CFLAGS) -o $@ $(HAL) example_wallfollow.c

# copy the shared files into the Arduino sketch folder
sync:
	cp mouse_hal.h mm_internal.h mm_common.c solver.c esp32/micromouse/

clean:
	rm -f solver example solver.exe example.exe

.PHONY: sync clean
