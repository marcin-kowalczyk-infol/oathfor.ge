# Forge scene assets

Local selection, 2026-09-28 (MVP-20-T10). These are exports for the [Forge scene](../product/forge-scene.md): Żaromir's bust, the dialogue panel, the seal and book responses and the object layers cut from the room. The player figures are not part of this set. Owner visual acceptance is pending. This is development art for review, not final production art.

## Provenance

Generated on 2026-09-28 with the built-in `image_gen` tool from the prompts in ignored `graphics/mvp-20/requests/chatgpt-prompts-2026-09-28.md`. Model version and seed were not exposed. Each master in `graphics/mvp-20/incoming/` has a `.prompt.txt` with the exact prompt, references and date. `fx-book-flutter-v02` and `panel-rune-v02` are follow-up edits of the v01 attempts. `generation-review-2026-09-28.md` and `agent-review-2026-09-28.md` beside them list the candidates, the selection and known limits. The selection matches the owner's gallery `graphics/mvp-20/incoming/index.html`.

Terms source checked 2026-09-26 for the same tool: [OpenAI Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/), updated 2026-01-16. Output rights are assigned between the parties subject to law, and uniqueness is not promised. The account-specific contract was not inspected. No exclusivity is claimed. Remote backup of masters remains pending under the [pipeline](pipeline.md) exception.

The five `room-*` layers are cut from the tracked `room-prototype-v03.png`. They are not new generations.

## Derived exports

`graphics/mvp-20/export-scene-v01.py` writes every file in `apps/mobile/assets/forge/scene/` from the masters, deterministically with Pillow 12.2.0, and records sizes, boxes, cells and checksums in `graphics/mvp-20/exports-v01.json`. Two runs gave identical checksums. It never modifies a master.

Alpha below 8 is cleared and the generator's 250 to 254 alpha ceiling is lifted to 255, as in the preset export. Light sheets are RGB on exact black for the screen blend that `Sprite.tsx` already applies to `blend: 'screen'` sheets. The near-black floor is lifted to exact black. Their cells follow the 3 : 4 shape of the existing effect sheets. Cells were cut by measured luminance or alpha and re-packed into a uniform 4 × 2 grid, because the 1774 × 887 masters do not divide evenly. First and last frames of every one-shot light sheet are near black (mean luminance under 10 percent of the peak frame).

Boxes are in room artwork pixels of `room-prototype-v03` (887 × 1774) as x, y, width, height.

| Export | Master | Size / mode | Use | Cells or box | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `zharomir-bust-v01.png` | `zharomir-bust-v01` | 399 × 384 RGBA | Żaromir bust above the panel | Trimmed, soft bottom fade kept | `83d41700daeb2104f25153e543a610d2736a1e7a41f935bcec56412a8a6c9762` |
| `panel-corner-v01.png` | `panel-frame-v01` | 96 × 96 RGBA | Panel corner, top-left | See panel layout | `b035085cc2cbfe496c8fd78bf13100d5546775ed52409b0ea4cfeff36f91cb4d` |
| `panel-edge-h-v01.png` | `panel-frame-v01` | 142 × 80 RGBA | Top edge tile, bottom when flipped | 2 braid periods | `817f373cfce6ce94ddb205c4f5ba1d1a68bd62edf0d0f4826a7c31298b1ae01f` |
| `panel-edge-v-v01.png` | `panel-frame-v01` | 80 × 127 RGBA | Left edge tile, right when flipped | 2 braid periods | `22f75f2ec0b593019464e31d52b71ddf83157c96551720a95f62e22e2a2e1d85` |
| `panel-fill-v01.png` | `panel-frame-v01` | 1020 × 332 RGB | Panel wood under the frame | Master centre at 0.8 | `5779617a60431cb3e9eae1593dd137ae5da1f1117132f930cc7e28cf54ef4bdb` |
| `panel-plate-v01.png` | `panel-nameplate-v01` | 612 × 128 RGBA | Speaker name plate | Caps 64 px each side | `26c73d24e5774f5830074099f67f31efb32990d7641512b217df2ca6b8393c5a` |
| `panel-rune-v01.png` | `panel-rune-v02` | 384 × 192 RGB | More-text rune, pulse loop | 4 × 2 of 96 × 96, anchor 0.5, 0.5 | `ae1e553559cf598e9f4da55b24b3ff79aabf62184fba2a2b3783f01f610e4ab9` |
| `fx-seal-star-v01.png` | `fx-seal-star-v01` | 768 × 512 RGB | Star motif lights, sparks fall | 4 × 2 of 192 × 256, anchor 0.5, 0.4 | `30c7a3e48e708102bf1b310c7f1e5b1d62f1bfd3a52e6a9f65505b5827530cff` |
| `fx-seal-tree-v01.png` | `fx-seal-tree-v01` | 768 × 512 RGB | Tree motif lights, sparks fall | 4 × 2 of 192 × 256, anchor 0.5, 0.4 | `f8ab4c5bc3e373154505d48dda33f1cfdc21d893299358e05252bb317e686c90` |
| `fx-seal-wolf-v01.png` | `fx-seal-wolf-v01` | 768 × 512 RGB | Wolf motif lights, sparks fall | 4 × 2 of 192 × 256, anchor 0.5, 0.4 | `779640453ed3117982552f87f31f46f2ede75e6a73e630b4e62fd1a25ea6b2e4` |
| `fx-book-signs-v01.png` | `fx-book-signs-v01` | 1152 × 768 RGB | Signs rising from the book | 4 × 2 of 288 × 384, anchor 0.5, 0.94 | `0ec317aeedef14b93790f7a10059a08babc45b47164aef46bab62c9296e52e7e` |
| `fx-book-flutter-v01.png` | `fx-book-flutter-v02` | 1024 × 512 RGBA | Pages flutter over the book | 4 × 2 of 256 × 256, anchor 0.5, 0.806 | `df3a1578859d500768f325ef6fc99d8bf0c16c105d78ba3ca7a89afaa22d51f3` |
| `room-seal-star-v01.png` | `room-prototype-v03` | 89 × 95 RGBA | Star drum layer | 62, 867, 89, 95 | `512832e6561a5f3658b0c2c4d9baf71a5f58ee64fe61a96f00330fb465705ace` |
| `room-seal-tree-v01.png` | `room-prototype-v03` | 85 × 99 RGBA | Tree drum layer | 149, 861, 85, 99 | `94c83e8b7465dd6668368798d6b970f8262119b9e23ff3819ee9942453c80365` |
| `room-seal-wolf-v01.png` | `room-prototype-v03` | 85 × 101 RGBA | Wolf drum layer | 231, 857, 85, 101 | `1d6df67b4efce0969c7cfdb9363012382d2054679c9ffb3de58004bba4e2b1d1` |
| `room-book-v01.png` | `room-prototype-v03` | 159 × 79 RGBA | Lectern book layer | 660, 856, 159, 79 | `3e67e6c8962d5986bc74adf69c6fdb842ef97964a8fdb6cc7cd6008b3f922f89` |
| `room-door-leaf-v01.png` | `room-prototype-v03` | 94 × 395 RGBA | Door leaf layer | 31, 476, 94, 395 | `70b38426db5da42887355672331073eff9417c34c6265c3589eb6297b33817a6` |

## Panel layout

The panel frame is built from cut pieces, not a stretched nine-slice, because its edges carry a braid. All values are export pixels, meant for 3x screens (divide by 3 for points).

- One scale for every piece: 0.5783 of the master. The four master corners are mirror-consistent, so one top-left corner is exported. Top-right is the corner with scaleX -1, bottom-left with scaleY -1, bottom-right with both. The bottom edge is `panel-edge-h` with scaleY -1, the right edge is `panel-edge-v` with scaleX -1. The mirror also flips the painted top-left light, which reads as frontal at this size.
- Corner square: 96. It includes the fitting that stands out past the band.
- Edge thickness: 80, measured from the panel's outer edge. The band's outer edge is 11 in from the top of the corner square and 8.7 in from its left. The bronze inner line ends at 49.7 (top) and 50.9 (left).
- Edge tile period: 70.99 horizontal, 63.27 vertical. Each tile holds 2 periods (142 and 127). Tiles repeat without a visible seam. The first tile continues the corner's braid. Fit a whole number of tiles between the corners and scale them by the small remainder, or clip the last one under the corner plate.
- Inside the bronze line the pieces are transparent with a baked black inner shadow (about 30 export pixels), so any fill can sit under the frame. Draw the fill in the panel rect inset by 12 on every side, under the frame pieces.
- `panel-fill` is the master's plain centre wood. Draw it with cover fit. Code may draw a flat colour instead: the measured master mean is `#31241d`, the spec's code colour `#2b1d13` is close.
- Name plate: rounded ends with the rivets are 64 wide on each side and must not stretch. The flat middle may stretch. Text sits between y 26 and 102.
- React Native reads an image without an `@3x` suffix as 1 point per pixel. Draw every piece with an explicit size, not with `resizeMode="repeat"` at its natural size.

## Room placement

Light sheets and flutter are drawn with their cell box at the given draw box. The anchor point in the room is where the sheet's anchor lands. Width is also given as a fraction of the artwork width, as `StationEffect.tsx` expects.

| Sheet | Room anchor | Draw box | Width fraction |
| --- | --- | --- | --- |
| `fx-seal-star` | 112, 921 (star motif centre) | 73.7, 880.1, 76.7, 102.2 | 0.0864 |
| `fx-seal-tree` | 195, 913 (tree motif centre) | 157.6, 873.1, 74.8, 99.8 | 0.0844 |
| `fx-seal-wolf` | 277, 908 (wolf motif centre) | 240.2, 868.8, 73.6, 98.1 | 0.0829 |
| `fx-book-signs` | 735, 900 (middle of the open pages) | 663.0, 719.5, 144.0, 192.0 | 0.1623 |
| `fx-book-flutter` | 739, 932 (bottom centre of the book) | 657.4, 800.4, 163.2, 163.2 | 0.1840 |

Each seal glow is scaled so its lit motif width matches the painted motif (star 54, tree 50, wolf 46 artwork pixels wide) and shifted per frame by cross-correlation with the peak frame. The flutter frames are registered to the open book of the `fx-book-flutter-v01` attempt, which v02 was edited from, and scaled so that book matches the room book width. The room book box is 662, 858, 154, 74.

Cut layers keep the room pixels exactly. Each is a supersampled mask with a one-pixel feather, like `room-seals-front-v01`.

| Layer | Box | Pivot |
| --- | --- | --- |
| `room-seal-star` | 62, 867, 89, 95 | Face 73, 879 to 148, 959, centre 110.5, 919, vertical axis |
| `room-seal-tree` | 149, 861, 85, 99 | Face 161, 874 to 231, 957, centre 196, 915.5, vertical axis |
| `room-seal-wolf` | 231, 857, 85, 101 | Face 242, 870 to 313, 955, centre 277.5, 912.5, vertical axis |
| `room-book` | 660, 856, 159, 79 | Pages and cover only, no lectern |
| `room-door-leaf` | 31, 476, 94, 395 | Hinge on the left edge at x 34, free edge at x 122 |

Each drum layer holds the face, the barrel side and the top knob. The stand stays in the room.

## Known limits

- Owner visual acceptance and native checks are pending. Composites were inspected only as still images.
- A moved or turned cut layer uncovers the same painted object in the room behind it. A turning drum or a swinging door needs a dark backing shape or a small turn, which code has to decide.
- The seal glows follow the painted motifs closely for the star and tree. The wolf glow is the generator's own wolf shape and only approximates the painted one.
- The flutter pages keep the generator's perspective, which is flatter than the room book. Registration is by book width and bottom centre, not by page corners.
- The book signs' size and height of rise are a proposal. The signs rise about 160 artwork pixels above the pages at their highest.
- The edges are mirrored at runtime. Earlier native checks found blur with fractional transform scales. A flip by -1 was not checked on device.
