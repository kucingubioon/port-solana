# Port Solana

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kucingubioon/port-solana/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kucingubioon/port-solana/reward.svg)](https://make.fun/c/gta6-01)

**Port Solana — Sun, Cash & Sirens.** An original open-world crime game that runs in a desktop browser, built for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01).

Explore the sun-soaked city of Port Solana on foot and by car: steal cars, outrun the Solana PD as your wanted level climbs, and work through a six-mission story for fixer Marisol Vega as Rio Valdez. Traffic, pedestrians, combat, a HUD with a minimap, synthesized sound, and save/continue included. Everything — city, characters, vehicles, story, art, sounds, music — is original.

## Play

Serve `game/` with any static HTTP server and open `game/index.html` in desktop Chrome. Keyboard and mouse. No network request is made by the game; every file it loads lives under `game/`.

```sh
node serve.ts
```

then open http://localhost:8080

## Entry

This repository is the entry for the make.fun competition `gta6-01`. `main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json`; see the competition kit for the full rules.
