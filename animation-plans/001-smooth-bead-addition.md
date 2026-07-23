# 001 — Make bead addition continuous and interruptible

- **Status**: DONE
- **Commit**: 621f0b7
- **Severity**: HIGH
- **Category**: Easing & duration, physicality, interruptibility
- **Estimated scope**: 2 files, about 90 lines

## Problem

The H5 and mini-program renderers currently place a new bead at its final X/Z
position, hide it until the existing beads have nearly finished moving, and then
scale it from almost zero for 520ms with an overshooting back easing:

```ts
// src/composables/useBracelet3d.ts:1235 — current
const fromX = x;
const fromZ = z;
const startDelay = hasExistingBeads
	? ADD_REVEAL_DELAY_MS + addOrdinal * Math.round(ADD_STAGGER_MS * 0.72)
	: index * ADD_STAGGER_MS;
root.position.set(fromX, 0, fromZ);
root.scale.setScalar(0.01);
```

```ts
// src/composables/useBracelet3d.ts:1450 — current
const move = easeOutCubic(t);
const scale = anim.fromScale + (1 - anim.fromScale) * easeOutBack(t);
```

The same implementation is duplicated in
`src/composables/useBracelet3dMp.ts`. Because `fromX === toX` and
`fromZ === toZ`, there is no spatial entry motion. The long hidden delay and
`scale(0.01)` create a pause followed by a sudden pop, while the back easing
overshoots the physical bead size. Rapid additions also restart the full 520ms
duration when retargeted.

## Target

Use the same motion model in H5 and the WeChat mini-program:

- Existing beads reflow over `280ms`.
- A new bead begins after `110ms` when the bracelet already contains beads.
- It starts `0.24` world units radially outside its target and `0.12` world
  units above the bracelet plane.
- It starts at `scale(0.9)`, never at or near zero.
- It follows a shallow arc with maximum extra lift `0.045`.
- Position and scale use the strong UI ease-out
  `cubic-bezier(0.23, 1, 0.32, 1)`.
- Addition duration is `280ms`; retargeting an already visible addition uses
  `180ms` from its current transform.
- There is no overshoot or bounce.
- Multiple additions remain interruptible by mutating the existing animation
  from its current position rather than creating a second mesh.

Implement a dependency-free cubic-bezier evaluator shared locally in each
renderer. Given normalized time `x`, solve the curve's X component with four
Newton-Raphson iterations and return its Y component. Clamp input and output to
`0..1`.

For a target `(x, z)`, calculate the radial start point as:

```ts
const distance = Math.hypot(x, z) || 1;
const fromX = x + (x / distance) * ADD_APPROACH_DISTANCE;
const fromZ = z + (z / distance) * ADD_APPROACH_DISTANCE;
```

## Repo conventions to follow

- Motion constants and easing helpers live at the top of each renderer:
  `src/composables/useBracelet3d.ts:20` and
  `src/composables/useBracelet3dMp.ts:22`.
- H5 and mini-program behavior must remain structurally identical.
- The existing `AddAnimation` object and `retargetAddAnimation` path already
  guarantee that one bead owns one mesh; extend this path instead of creating
  a separate flying proxy.

## Steps

1. In both renderers, change `ADD_BEAD_DURATION_MS` to `280`,
   `REFLOW_DURATION_MS` to `280`, and define
   `ADD_REVEAL_DELAY_MS = 110`, `ADD_RETARGET_DURATION_MS = 180`,
   `ADD_APPROACH_DISTANCE = 0.24`, `ADD_START_HEIGHT = 0.12`, and
   `ADD_START_SCALE = 0.9`.
2. Add a local cubic-bezier evaluator and an `easeAdd` curve using
   `(0.23, 1, 0.32, 1)`. Remove `easeOutBack` once unused.
3. In the new-bead branch, calculate the radial approach point, set the root to
   `(fromX, ADD_START_HEIGHT, fromZ)`, and set its scale to
   `ADD_START_SCALE`.
4. Keep the delayed `visible` gate to prevent the historical double-bead
   overlap, but use the new `110ms` delay.
5. In `tick`, apply `easeAdd(t)` to position and scale. Calculate Y as the
   eased interpolation from `fromY` to zero plus
   `sin(PI * t) * liftHeight`.
6. In `retargetAddAnimation`, preserve the current transform and use
   `ADD_RETARGET_DURATION_MS` when the mesh is already visible; hidden meshes
   retain the normal add duration and reveal delay.
7. Make the same changes in `useBracelet3dMp.ts`.

## Boundaries

- Do NOT alter material rendering, lighting, bracelet geometry, camera motion,
  drag/reorder motion, or removal motion.
- Do NOT create a second mesh or DOM overlay for the incoming bead.
- Do NOT add dependencies.
- Do NOT change the recorded design-step schema or video API.
- If the cited add-animation structure has drifted since commit `621f0b7`,
  stop and report instead of improvising.

## Verification

- **Mechanical**:
  - Run `npm run build:h5`; it must complete without TypeScript or Vite errors.
  - Run `npm run build:mp-weixin`; it must complete without TypeScript or
    uni-app compilation errors.
  - Run `git diff --check`; it must report no whitespace errors.
- **Feel check**:
  - Open the empty DIY page in a 720×1280 viewport and add one 8mm bead.
    Confirm the bead travels a short continuous arc into its slot and does not
    grow from nothing.
  - Add five beads rapidly. Confirm there is never more than one mesh per new
    bead, no bead freezes before moving, and existing beads continuously retarget
    from their current positions.
  - Inspect at 10% playback speed. Confirm scale never exceeds `1`, the bead is
    visually settled by 280ms, and the final frame has Y=0 and exact target X/Z.
  - Generate a design-process video and confirm the same entry motion is
    present because the video captures the real workbench.
- **Done when**: H5 and mini-program builds pass, rapid additions show no
  duplicate bead, and the add motion is a continuous 280ms approach with no
  overshoot.
