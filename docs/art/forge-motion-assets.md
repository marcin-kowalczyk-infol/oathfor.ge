# Forge motion assets

Local selection, 2026-09-27 (MVP-18-T12). The owner asked for animation of every touchable place in the Forge room and for a better Żaromir walk. This set replaces the 4-frame sheets in the [places manifest](forge-places-assets.md). It is provisional development art for owner review, not final production art.

## Provenance

Generated on 2026-09-27 with the built-in `image_gen` tool from the prompts in ignored `graphics/forge-motion/requests/chatgpt-prompts-2026-09-27.md`. Model version and seed were not exposed. Each master in `graphics/forge-motion/incoming/` has a `.prompt.txt` with the exact prompt, references and date. Some masters are follow-up edits of an earlier attempt, for example a lantern moved back to the right hand. `generation-review-2026-09-27.md` beside them lists the candidates and known limits.

Terms source checked 2026-09-26 for the same tool: [OpenAI Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/), updated 2026-01-16. Output rights are assigned between the parties subject to law, and uniqueness is not promised. The account-specific contract was not inspected. No exclusivity is claimed. Remote backup of masters remains pending under the [pipeline](pipeline.md) exception.

## Derived exports

`graphics/forge-motion/export-motion-v01.py` writes every file in `apps/mobile/assets/forge/motion/` from the masters, deterministically with Pillow 12.2.0, and records sizes and checksums in `graphics/forge-motion/exports-v01.json`. It never modifies a master.

Character sheets use 288 × 320 cells. Each frame is scaled to one figure height (282 px) and placed with its torso centre at x 144 and its soles at y 312. Station poses keep one scale per sheet so a lean stays visible. Faint alpha haze below 8 is cleared. Sprites are never mirrored, so the lantern stays in his right hand.

Light sheets are 4 × 2 on black and use a screen blend in the app. The near-black floor is lifted to exact black. The page sheet is RGBA with a normal blend. Its 9 degree tilt toward the lectern book is baked into the export, because a runtime rotation made the page blink on iOS.

| Export | Master | Size / mode | Use | SHA-256 |
| --- | --- | --- | --- | --- |
| `zharomir-walk-back-v02.png` | `zharomir-walk-back-v01` | 1152 × 640 RGBA | Walk away, 8 frames | `e4acce1f4b7538bcd26bb704053f6a07d5b39026c4e5d12e81ad59a7865bce4e` |
| `zharomir-walk-back-left-v01.png` | `zharomir-walk-back-left-v03` | 1152 × 640 RGBA | Walk away to the left | `d7b02e5c857466a0c25f4e9884e00eb8f4f30ae9190a46bd31700b7683a4f5fc` |
| `zharomir-walk-back-right-v01.png` | `zharomir-walk-back-right-v01` | 1152 × 640 RGBA | Walk away to the right | `3c72a6115c1dae697c7b038127f5b471a11434c54182e9e5a66942ce288f7f67` |
| `zharomir-walk-front-v01.png` | `zharomir-walk-front-v01` | 1152 × 640 RGBA | Walk toward the viewer | `8951c25f420f59a15a479dcc9584612a8cdcd531ceb05bddeb00447403435264` |
| `zharomir-walk-front-left-v01.png` | `zharomir-walk-front-left-v03` | 1152 × 640 RGBA | Walk toward the viewer, left | `b8873f943ca2430ce500262a3819f59368c11f3ac3e8eb0c940b153be26a161c` |
| `zharomir-walk-front-right-v01.png` | `zharomir-walk-front-right-v01` | 1152 × 640 RGBA | Walk toward the viewer, right | `2d10f5b6dfcac87f17e607d8498852913b47f42c4379247d19a53c7f6ca6cacc` |
| `zharomir-walk-left-v02.png` | `zharomir-walk-left-v01` | 1152 × 640 RGBA | Side walk to the left | `0e4fea27a098c15c73a2748501753162723e656ac3f4034ad1292520426b0a47` |
| `zharomir-walk-right-v02.png` | `zharomir-walk-right-v02` | 1152 × 640 RGBA | Side walk to the right | `5c5a8439c87d28145e6ebb3d4cccf1bfe21f97956c4d577b1702a8976a04c1d6` |
| `zharomir-idle-v02.png` | `zharomir-idle-v01` | 1152 × 640 RGBA | Breathing, 8 frames | `e5f71b56128771a9d5df0a4b14f4f0a474ddb11c714b30a992918bad8fde0d89` |
| `zharomir-act-hearth-v01.png` | `zharomir-act-hearth-v03` | 576 × 640 RGBA | Stoking the fire, back view | `07135d500b6300f25e2de4450f171ea05023e9358eec931e2233a8722df6eaf6` |
| `zharomir-act-seals-v01.png` | `zharomir-act-seals-v03` | 576 × 640 RGBA | Lantern raised to the seals | `8f45ece75141067db8ddaad870c0f0310f36f94668d5e7aec8cd4c252cd2d2fa` |
| `zharomir-act-chronicle-v01.png` | `zharomir-act-chronicle-v03` | 576 × 640 RGBA | Reading at the lectern | `8860ebb46ea4552ded5e3b5a14fb502d0460c8d592df0e51649789d9d5f39714` |
| `zharomir-act-door-v01.png` | `zharomir-act-door-v01` | 576 × 640 RGBA | Lantern lifted into the doorway | `512e44a53d0654fcc8d3285567cc8d120b7d2d0aa9927d046808750183578fe4` |
| `zharomir-turn-v01.png` | `zharomir-turn-v01` | 576 × 640 RGBA | Turn from back to front, once | `75047da83e5846d11e111494b0d50fef6e1da34ab15bc344ebd18022e6a6c73e` |
| `zharomir-talk-v01.png` | `zharomir-talk-v02` | 576 × 640 RGBA | Explain, point left, point right, nod | `1ddd820463bcd2527c818f32d0eda0b61e8e12c28c4d76cd3d4cceb0616befc0` |
| `fx-hearth-loop-v01.png` | `fx-hearth-loop-v02` | 1152 × 768 RGB | Hearth flame loop | `8a7c66cce776891e961fc3162c2ced0ad5ed40593af371d092db863ab46464ba` |
| `fx-hearth-burst-v01.png` | `fx-hearth-burst-v03` | 1152 × 768 RGB | Hearth flare on arrival | `f3a6e8229e452703ca296a40bf0cf41ba5f8362791516a85198ce547593f6a23` |
| `fx-seal-glow-v01.png` | `fx-seal-glow-v02` | 768 × 512 RGB | Ring of light on each seal | `3c6d561686477757fb41b614532aca76a01177f0b439f5514db3834b9baceb71` |
| `fx-chronicle-page-v01.png` | `fx-chronicle-page-v02` | 768 × 512 RGBA | Turning page | `5fbd0c4aac30e2cb776701f1ee41bb66d2444d0395913d66524f95ec0f616844` |
| `fx-door-mist-v01.png` | `fx-door-mist-v02` | 768 × 512 RGB | Moonlight and mist at the door | `adea54c3812774defc1c39c8d94cd214868b702d97ceab97a9d4fd5e2e1fcbd6` |
| `fx-candle-loop-v01.png` | `fx-candle-loop-v02` | 384 × 256 RGB | Candle and lamp flames | `6d9df37690a24361a786f80da7c90e8c4eb9b765643c23d23b9cc544b6bc1a8e` |
| `fx-attract-wisp-v01.png` | `fx-attract-wisp-v02` | 384 × 256 RGB | Ember wisp over a station | `5eb59e171028586b5eea5967f05898ae2f8aac162db4669736fafd4d01f6079b` |
| `room-seals-front-v01.png` | `room-prototype-v03` | 280 × 115 RGBA | Seal drums drawn over Żaromir in the doorway | `c0bf33ffb8eb07a0686b17fdf7ac1c076b44f8ee50c3359dbc3ab4e346cfbdcb` |

The wisp master has an irregular grid, so its eight wisps are cut around their measured cores. `room-seals-front` is three feathered ellipses cut from the tracked room image. It is not a new generation.

## Runtime use

- Walk: one of eight sheets by the travel angle, 90 ms per frame, walk time from the distance (600 to 1800 ms). A small vertical bob per frame restores the step lost to height normalisation. Depth draws him at 86 to 100 percent size by changing the drawn size, because a transform scale blurred the sprite on iOS.
- Stations: on arrival he plays the pose facing the place and the place responds once: flare, three seals in turn, a page, or door mist. Touching the place again replays the response.
- Tutorial: at a told place he works, turns once and talks with explain and nod gestures. While the player chooses he explains and points left and right.
- Hearth close-up: the same loop at 0.24 of the screen width inside the arch.
- Ambient: the hearth loop, 20 candle and lamp flames at measured positions and an ember wisp above each station. The door keeps its cool mote.
- Reduce Motion shows the first frame of each pose and no response.

## Known limits

- The "front" and "front-right" walks read almost frontal at room size. Side and diagonal back walks read best.
- The wisp above the hearth blends into the fire.
- Only the seal drums have a foreground cut. The lectern and pedestal bowls do not.
- Native checks covered the iPhone 18 Pro only (owner instruction, 2026-09-27).

MVP-20 adds the player pilot sprites, the dialogue panel art, the seal and book light sheets and the room cut layers in the [Forge scene assets](forge-scene-assets.md).

MVP-21 adds the rule card icons, the sealing stamp and sparks and the countdown hourglass in the [Oath screens assets](oath-screens-assets.md).
