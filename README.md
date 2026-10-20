# ARENA FPS

**V0.1 is an offline FPS controls / aiming prototype, not yet an online multiplayer release.**

Browser-based 3D arena shooter for iPad Safari and desktop. The goal is simple rules, smooth movement, and Apex-style longer fights where tracking aim matters.

## Included

- Three.js 3D map (loaded from jsDelivr CDN)
- PC mouse / keyboard and iPad dual-touch controls
- Automatic rifle: 30 rounds, reload, hit markers, recoil
- Three moving 200-HP practice bots, headshots, respawn, basic counterfire
- Jumping, sprinting and sliding; FPS counter for performance testing
- No server, account, Firebase or online matchmaking in this version

## Controls

| iPad | PC |
| --- | --- |
| Left stick: move (full tilt to sprint) | WASD / Shift |
| Drag right: look | Mouse (click canvas to lock pointer) |
| FIRE (hold and drag to aim while firing) | Left click |
| JUMP | Space |
| SLIDE | C while moving |
| ↻ | R (reload) |

## Run

Use a web server because ES modules are loaded via HTTP(S):

    python3 -m http.server 8000

Then open http://localhost:8000. The app can be deployed as static files with GitHub Pages after Pages is enabled under repository Settings. The published URL can later be embedded in Google Sites. Test directly in iPad Safari before embedding.

## Next

1. Test touch responsiveness, frame rate and weapon feeling on an actual iPad.
2. Tune sensitivity, cover layout, movement and time-to-kill.
3. Implement separately tested, server-authoritative online 1v1 networking with prediction/interpolation.
4. Test multiplayer from different devices and Google Sites embedding before calling it a public online version.

**No claim of iPad or Google Sites real-device validation has been made yet.**

## Input reliability improvements

- Forward/strafe movement now matches the camera direction at any yaw.
- Release held keys, firing, and touch controls on focus loss and input cancellation.
- On desktop, Escape pauses the action and displays the start/resume dialog until the pointer is locked again.
- On iPad, place the movement joystick where the left finger first touches; the right shoot button also supports dragging to aim while holding fire.
