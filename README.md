# port-solana

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kucingubioon/port-solana/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kucingubioon/port-solana/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Port Solana — Sun, Cash & Sirens is an original open-world crime game that runs in a desktop browser. Explore the sun-soaked city of Port Solana on foot and by car: steal cars, outrun the Solana PD as your wanted level climbs, and work through a six-mission story for fixer Marisol Vega as Rio Valdez, with traffic, pedestrians, combat, a HUD with a minimap, synthesized sound, and save/continue included. Everything — city, characters, vehicles, story, art, sounds, music — is original. Resubmitted 24 November 2026 with the current make.fun kit: this README is the final change, written inside the recorded resubmission session, and it follows the gta6-01 README template exactly, bounty link included: https://make.fun/bounty/gta6-01

## Screenshots

Four screenshots live in `screenshots/`: the start screen, open-world play, a police chase, and a completed mission. They were captured from this build of the game running in a desktop browser.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Keyboard and mouse. The game makes no network request; every file it loads lives under `game/`. The entrypoint `main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4cyqp7fh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
