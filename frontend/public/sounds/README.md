# Sounds of Chatterly-Renewed

Every sound of the app is a file in this folder, organised by what it is for. **To change one, replace the file with
another one of the same name** (WAV, MP3 and OGG all work; if the extension changes, change it too in
`frontend/src/app/core/sound-library.ts`, the only place that lists them). Nothing else needs to change.

The files are loaded only after the first press on the page, once, and kept by the browser (a week). They are small on
purpose: the interface sounds are tiny WAV files (3 to 16 KB), the longer ones are 48 kbps mono MP3.

**Loudness:** the sounds of the interface are quiet before the volume of the settings is applied (about −38 dB). If a
sound you add is louder than the others, lower its `trim` in `sound-library.ts` (1 = as it is, 0.5 = half as loud).

## `ui/` — the interface

| File                   | When it plays                                         |
| ---------------------- | ----------------------------------------------------- |
| `message-received.wav` | A message arrives in a chat you are not looking at    |
| `message-sent.wav`     | You send a message                                    |
| `menu-open.wav`        | A menu opens                                          |
| `toggle-switch.wav`    | A switch is turned on or off                          |
| `notice-success.wav`   | Something went well (copied, saved…)                  |
| `notice-error.wav`     | Something went wrong                                  |
| `click-*.wav/.ogg`     | The sound of pressing a button; one file per style, chosen in Settings > Sounds. The same sound is the tick of a slider (higher as the slider goes up). |

## `call/` — calls

| File                       | When it plays                                  |
| -------------------------- | ---------------------------------------------- |
| `you-join.wav`             | You join a call                                |
| `you-leave.wav`            | You hang up                                    |
| `user-joined.wav`          | Somebody else joins your call                  |
| `user-left.wav`            | Somebody else leaves your call                 |
| `mic-mute.wav`             | You mute your microphone                       |
| `mic-unmute.wav`           | You unmute your microphone                     |
| `headphones-deafen.wav`    | You deafen (stop hearing the call)             |
| `headphones-undeafen.wav`  | You hear the call again                        |

## `ringtones/` — the default ringtones (they repeat while a call rings)

`classic.mp3`, `christmas.mp3`, `halloween.mp3` and `newyear.mp3`. The pause between repetitions is `gap` in
`sound-library.ts`. The person can also upload their own ringtone in Settings > Sounds & notifications.

## `auth/` — the animations of arriving (each file is the whole soundtrack of its animation)

| File                     | Animation                                          |
| ------------------------ | -------------------------------------------------- |
| `intro.mp3`              | The introduction when the page opens               |
| `sign-in-unlock.mp3`     | Signing in: the padlock opens                      |
| `sign-out-lock.mp3`      | Signing out: the padlock shuts                     |
| `sign-up-fireworks.mp3`  | Creating an account: the fireworks                 |

## `soundboard/` — the default effects of the soundboard of a call

`chime`, `doorbell`, `siren`, `air-horn`, `boing`, `sad-trombone`, `coin`, `ta-da`, `drum-roll`, `rimshot`, `cymbal`,
`applause`, `wave`, `wind`, `rain`, `thunder`, `sparkle` and `spell`. Everybody in the call hears the one that is played.

## Origin and licence

The four button clicks `ui/click-tap.ogg`, `click-switch.ogg`, `click-pluck.ogg` and `click-bubble.ogg` are from
"Interface Sounds" by Kenney (<https://www.kenney.nl>), Creative Commons Zero (CC0). All the other files were generated
for this project (synthesised and rendered to files) and are covered by the licence of the project.
