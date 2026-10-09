# Changelog

## 2.2.0

- New arrival animations, much bigger. The first visit opens with an aurora of moving light over a glowing floor in perspective; a hundred and fifty points of light spiral in from the edges of the screen and gather into a ring around the logo, which spins in from the side while its outline draws itself in a gradient; the lock snaps shut, and the ring explodes in a flash, a shockwave and a burst of sparks; the name rises letter by letter with a shine that sweeps across it, and the whole scene leaves with a zoom. Signing in opens like an iris from the centre, the lock of the logo opens and the lights burst out as the app appears. Creating an account ends with fireworks over the aurora, a gradient check mark and the welcome. They are still only code (CSS, SVG and a small canvas), load only when they play and are skipped for people who asked for no motion.
- The warning limit for the style size of a component was raised from 4 kB to 6 kB for these animations (the error limit stays at 8 kB).

## 2.1.0

- Arriving in the app, with animation: the very first visit opens with an introduction (a chat bubble with a lock that draws itself, the name rising letter by letter, rings of light; a click skips it); signing in opens the app behind a wipe with a lock that opens and a welcome by name; creating an account ends in a celebration (a check that draws itself, a burst of confetti and the words "your keys were made on this device and never left it"). They are made only of CSS and SVG, load only when they play, are not shown to people who asked for no motion, and the page underneath changes while they cover it.
- Passwords: the proof of the password is now mixed with a secret of the server (a "pepper" that is not in the database) before the slow hash, so a stolen database alone can not even be attacked by guessing passwords. Accounts made before get their hash upgraded the next time they sign in. (The password itself still never leaves the browser: it is stretched 600,000 times there, and the server only ever sees and stores a hash of a proof derived from it.)
- Session: the tokens kept on the device are encrypted with a key that cannot be copied out of the browser (stored in IndexedDB as a non-extractable key), so a copy of the files of the browser shows nothing usable. The app sets no cookies at all, so there is nothing to steal or to forge from another site.
- Speed of the first visit: the font of the first paint is requested at once, the app starts right after the page is painted, and unused styles were removed. Lighthouse of the sign-in page in a production build: Accessibility, Best practices and SEO 100; Performance 100 on a fresh server start (94 to 95 on repeated runs on the same machine, because of how Lighthouse simulates a phone over localhost).

## 2.0.1

- Code: every function of the app, the server and the test now says what it does and why (about 340 were missing it); the names that were in Spanish are in English; the pieces that were written twice were unified (the class of the font of a name, the decibels of a level, the nickname window, the id of the caller and the cleaning of texts in the server).
- Security, a second full pass over the server and the browser:
  - an access token of an account that no longer exists stops working at once, not after 15 minutes;
  - a person keeps at most 20 open sessions (the oldest close);
  - guessing the old password through "change password" with a stolen session is locked like the sign-in is;
  - in a direct chat that is no longer between friends nobody can edit or react;
  - the picture of an uploaded animated cursor is checked before it is written in the page.
- Checked on screen, on a computer and on a phone (390 px), with no sideways scroll: the friends, the chat, the tournament of Spinly in the chat (the wheel is there from the start), the call, the soundboard, the Spinly panel of the call (the Space key spins it) and the settings.

## 2.0.0

- **Chatterly 2.0.** The look is the one you chose; this version gathers and polishes the work of the 1.x line.
- Cursors: Solid, Soft and Elegant have silhouettes of their own now (a folded corner, a drop and a ring on a stick, next to the classic arrow, the neon dart, Halo and Pixel), and over something that can be pressed every family shows a hand in its own style, drawn on the same point as the arrow so the pointer never jumps.
- Soundboard: three columns, always full rows (12 effects and 6 ambient sounds; the "Bubbles" sound is gone).
- Groups: the Administrator section is there from the moment the group is created, not only once a tag exists. Going from one group to another has a soft entrance.
- Spinly: the tournament of the chat shows the wheel from the start and spins it slowly enough to follow; the bracket of a finished tournament folds and unfolds smoothly; the background of its windows is darker and blurred.
- The titles of the settings no longer show up in English as a tooltip when the language is Spanish.
- Lighthouse of the sign-in page in a production build: Accessibility 100, Best practices 100, SEO 100, Performance 94 (the first paint takes about 2 s on the throttled phone profile; the initial bundle is 500 kB, the one that sets the limit).

## 1.26.0

- Cursors, redone: every family has an arrow of its own (Classic, a neon dart, a bold one, a chubby one, a thin outline, plus the dot of Halo and the pixels). Over a link the arrow lights up in the same place, so the pointer does not seem to jump; the cards of the settings show them.
- Calls: the call bar and the music card move the same way (they follow the pointer while you drag, the free place lights up and they glide into it when you let go; an entrance animation was holding the call bar). The call bar cannot be selected as text. The music card has more room for its buttons and a button to fold it to one line.
- The side bar stays on the group when you join one of its voice channels (it used to jump to Home), and the group stays marked in the left bar.
- The soundboard and the Activities menu cannot be open at the same time.
- "Your messages" in the chat bubbles uses the gradient controls of the profile (two to five colors on a thin bar, angle).
- Spinly: the background of its windows is a grid of lines that moves by itself; the cards of the chat and the call have a band of color in their heads.
- The channels of a group have calmer rows and hover.
- Deploying: the guide explains how to run your own STUN and TURN (coturn) in the same machine, how the signalling and the encryption fit, and a table of the usual failures (CORS, proxy, microphone, calls).

## 1.25.0

- Spinly: Space spins the wheel and the tournament again (the cursor drawn by the page was counted as an open window and blocked the key); the background of the Spinly windows moves by itself (a drifting glow and a grid that lights up in waves) and no longer follows the pointer; the score has a clean type and the button just says "Spin"; the wheel takes less room and needs no scrolling; the cards of the chat appear with a soft entrance.
- Groups: the tags are in a list you order (up and down), and that order is the order of the sections; the administrator is always the first section. In the window of tags, opened from the menu of a member, each tag is a switch for that person and a tag you create there is given to them at once. The tags are squarer and the color picker opens next to its button.
- Music: the bar of the shared player has a whole row for the timeline; any video of a playlist can be taken out (for everybody). The cards of the menus of activities are more compact. The soundboard has two categories (Effects and Ambient) plus yours, and it keeps its size when you change category.
- The cursor goes back to the real one as soon as the window loses the pointer or the focus (it vanished when another window was in front). The call bar and the music card glide to the place they are dropped on.
- Looks: the icons of the settings menu turn and shine again on hover; the links to the documents of the encryption systems are in About too; the effect ring of the avatars grows with their size, and the dot of the state sits on the edge of the picture; the stickers card is smaller and does not stretch; Plum and Tangerine's Pop swapped places.
- Deploying: `deploy/` has the guide to run the app on a free Oracle Cloud server with HTTPS (Caddy), a systemd service and a GitHub Action that updates the server after every push to main.

## 1.24.0

- Effects (the ring of the profile): only your own avatar (bottom left) and the profile cards show them; the friends, the chats list and the members list do not. The dot of the state sits outside the ring so it no longer eats part of it, and the card with your name at the top of the state menu is gone (the name is already below).
- Groups: right click a member and choose their tags straight from the menu (the ones they have show a check); "Manage tags" makes or deletes tags. The members list has more space between people and a section for each tag.
- Calls: joining a group while you are in a call now switches the call at once: the late answer of the server to the old call no longer ends the new one, and the call page no longer sends you home in the middle of the switch.
- The music card only rests on the top corners, the top middle and, when the stage is wide enough, at the left or the right of the bar of controls (otherwise just above it, and above the strip of small tiles when somebody is pinned). Dropping it chooses the nearest of those places and it glides there smoothly.
- Gradients (name and banner): from two to five colors; each color is a marker on a thin bar that can be chosen and dragged, with its own color and the angle. The controls are folded away until you press Edit.
- About me: Control+Z and Control+Y (or Control+Shift+Z) undo and redo, also after formatting.
- Cursors: every family now has every state (text, hand, grab, forbidden, wait, help, zoom, move, resize, crosshair) drawn in its own style, and Solid and Sleek no longer look alike. The default cursor is the Classic one (first in the list, called Default) and the old "Themed" is called Neon.

## 1.23.0

- Listen together: the music card can no longer be resized; it is dropped on the corners of the stage (and the middle of the top and the bottom) like the bar of the call, with targets while you drag, and it stays above the strip of small tiles when somebody is pinned. It no longer slides under the edges, and times with hours (2:34:02) are aligned. The link window has no "Paste" button. The Activities menu and the "+" menu of the chat have richer cards.
- Soundboard: in a call it opens upward from its button, smoothly, and the categories wrap instead of being cut.
- In full screen the right click on a person works (the menu lives inside the full-screen stage) and only the people showing a camera or a screen float over the big tile.
- Messages: a deleted message fades and folds away for everybody instead of popping out.
- Spinly: Space spins the wheel and the tournament of the call even when a button has the focus; the window to make a wheel or a tournament and the Spinly panel of the call have the glowing, pointer-following grid of the real Spinly; the tournament in the chat has a fixed, readable width on a computer and fits a phone.
- Names: the color, the gradient and the font of a name show everywhere it appears (chat header, call, friends, groups, replies, incoming calls). The avatar of the bar at the bottom left, the chats and the members shows the profile effect too.
- Gradients (name and banner): the second color, an optional third color in the middle, the angle and where the gradient starts and ends (instead of the opacity). The color picker has no quick colors, no color dot and squarer corners.
- Groups: tags show in the members list (a section for each tag, like Discord) and in the profile of a member; the owner makes them with the color picker.
- Looks: the friends page has the tabs in one dark bar, a darker "Add friend" and a better search; the stickers import is a big drop card; Settings > Privacy & security names the encryption systems as links inside its texts (the "Encryption used" card of About is gone).
- Cursors: the themed cursor is now the neon one; Glass and Neon are gone and Solid (the old themed one) and Sleek are new. New melodies with a bass line for the call (Deck the Halls, Ode to Joy, a spooky waltz and a bouncy classic).
- The wallpaper is drawn as an image element, so a GIF keeps moving.

## 1.22.0

- Listen together: the music card can be dragged anywhere on the screen by its header and made bigger (never smaller) from its corner; where it is stays remembered. The queue button counts everything still to come (a playlist is counted too, it showed 0 before). The link window lost the "Paste" button and looks better.
- Soundboard: the categories are a row of pills on top and the sounds of the chosen one open below, like Discord.
- Shortcuts: any single key or any combination can be used (a bare Space or Enter on a button still presses the button; inside a text field a plain key does not trigger anything).
- Settings: the four sliders of Motion have the same size and go in the order Background visibility, Background blur, Background motion, Animations; the sections of Appearance and of Sounds are grouped under titles (Interface: corner style and text size; Chat: message style, actions over a message and bubbles; Cursor; Volume, Sounds and Notifications), and a section opens smoothly the first time too.
- The backgrounds Topography (lines of height that breathe), Sunset (a low sun, clouds and hills) and Waves (with a bright crest) were redrawn; the cursors Glass, Neon and Classic too.
- Add friend sits at the end of the row of tabs of the friends page. A GIF or an animated WebP (up to 2 MB) can be a profile picture, a banner or a group icon and keeps moving.
- Groups: only the owner creates tags and gives them to the members (right click a member, Tags); they show under the name in the members list. The server checks it is the owner, the limits (12 tags per group, 5 per member) and the color.
- On a phone a block of code no longer makes its message wider than the screen. New melodies for the call (Silent Night, Auld Lang Syne, a music box waltz and a lighter classic).
- Security: the link-preview address check was widened, each person can keep at most eight connections, and the upload of files has a daily quota (done in 1.21.0).

## 1.21.0

- Chat: when something new arrives (a sticker, a GIF, a picture, a block of code) the conversation glides to the end by itself, smoothly and without jerks, if you were at the end, if you sent it, or if you are writing; if you scroll up it leaves you alone. The Spinly tournament in the chat is shown with its champion, the number of participants and duels, and a button to see or hide the bracket.
- Emoji: a message of only emoji enters with one of six animations (a different one for each message) and does not tremble when you point at it. The emoji picker opens at once (the list is downloaded in advance when the browser is idle and drawn section by section), and the soundboard uses the same emoji and the same look as the chat.
- Groups: drag them in the bar at the far left to put them in the order you like (it is remembered). Pointing at a group, at a member or at anything inside a button shows the themed cursor, and the themed and the system cursor no longer show together over a scrollbar.
- Wallpaper: GIFs, animated WebP and short videos (MP4 or WebM, up to 25 MB; pictures up to 12 MB) can be used as the background and they move. They are kept only on the device.
- Link previews that play in the chat without signing in: Instagram, X (and its mirrors, Nitter among them), TikTok, Bluesky, Reddit, Twitch, SoundCloud, Dailymotion and Streamable, besides YouTube, Vimeo and Spotify.
- Looks: the "Add friend" button follows the theme; the friends in the list rest in a slightly darker tone; the hover of servers, groups and channels is calmer; the dot of the state in the profile preview sits on the picture's edge; Shortcuts is before Integrations in Settings; the music note is for Listen together and the soundboard has its own icon. Every place where a file can be uploaded now says its size limit.
- Security: the link-preview server refuses more reserved addresses (IPv4 inside IPv6 in hexadecimal, translation and documentation ranges, multicast); each person can keep at most eight open connections; and the upload of files has a daily quota per person (bytes and number of files).

## 1.20.0

- Settings: the motion of the background no longer turns off the other animations. "Background motion" (Off, Slow, Normal, Fast) only moves or freezes the background, and the new "Animations" (Off, Quick, Full) controls the transitions and movement of the interface. A new slider, "Background visibility" (Solid to Open), sets how much of the animated background shows through the big blocks of the interface; the list of the settings is opaque again. The theme is "Tangerine's Pop" and sits second to last. The new Shortcuts section lets you choose the keys to mute, deafen, turn the camera on or off, share the screen, open the soundboard and hang up (they work while the tab is in front).
- Menus and windows leave smoothly: the Spinly window, the soundboard, the menus of the call, the lists and the pickers fade out instead of vanishing.
- Calls: the floating bar of the call (when you are on another page) no longer sits over the box where you write: it rests at the top right and can be dragged to six places (the corners and the middle of the top and the bottom), with targets shown while you drag; it also shows what is playing, with a pause button. Names with a color or a gradient show it in the call, in the sidebars, in the friends and in the groups too.
- Calls, Listen together and Watch together: skipping only exists when there is something to skip to, and a song or video that ends with nothing queued simply ends. Videos can be queued too, and a YouTube playlist is shown as a list (with the one that plays marked, and any of them can be chosen). The activities menu is opaque and roomier, with a "Paste" button.
- Sharing the screen opens a menu of the page first: what to share (a screen, a window or a tab), the quality (720p, 1080p, 1080p at 60) and whether to share the sound; the browser then asks to confirm, already narrowed to that. (The picker of the browser itself cannot be replaced.)
- Spinly: its logo is an SVG inside the page (no request, so it never waits to load) and is used everywhere. The tournament in a call was redone like the real Spinly: round, progress, a card for each side with its color and points, the bracket with colors and scores, and a champion card with confetti and the podium.
- The color picker no longer closes by itself when you press inside it in the Spinly window.
- About: a card lists every encryption system the app uses with a link to its specification.
- It also works in browsers without Web Audio: the app stays silent instead of stopping (it was checked in Firefox, WebKit and phones).

## 1.19.0

- Calls: the call keeps running when you leave its page (the music, the video, Spinly and the shared screens go on, and everything is there when you come back): the call now lives in the layout and its page only hides it. The bar of buttons is mute and deafen | camera and screen | activities and soundboard | hang up (a red phone button, no word, no crossed phone), and its buttons stay still on hover. A tile shows a red icon for muted or deafened instead of the word "Muted", does not say "(you)" and has its name lower and further from the edge; the buttons over a tile (pin and full screen) light up softly instead of jumping.
- Music card: a volume button with a slider that clings to 0, 25, 50, 75 and 100 and moves freely in between; the card only sits at the left of the controls when there is room for it.
- Soundboard: 19 effects in folding categories (alerts, fun, drums and crowd, nature, magic) and your own sounds (any audio file, up to 8 seconds). Everybody in the call hears your sounds: they are sent once, encrypted, to each person and kept only on their device while the call lasts.
- Color picker: redone and smooth to open and close; no number arrows, a round hue handle, an RGB row of plain fields. A press outside closes only the picker, and so does Escape (the menu or window under it stays); the click that closes it is not passed to what is under it. In the Spinly window, pressing a slice, the arrow or the lights opens this normal picker where you pressed.
- Settings: the Sand theme is gone; the new Tangerine Pop (orange) is there instead. The backgrounds are clearly visible now (the big blocks of the interface are translucent over them, and the scenes are brighter); the grid is a lit grid whose lines light up in waves; the motion of the background is a slider (Off, Slow, Normal, Fast).
- Buttons and cards no longer move when you point at them (they only change color or glow): a hover that lifts the element made it flicker when the pointer was on its edge, and it was the "dance" of some buttons.
- Other: the default voice channel is called "Voice"; the video call button is gone from a chat (call and turn the camera on); "Clear styles" is gone from About me; the logo of Spinly is fetched early; flag emojis are drawn with a flag font on systems that draw only letters (Windows); the sticker packs can be opened in browsers without 'deflate-raw' in DecompressionStream (older Safari) thanks to an own decoder.

## 1.18.1

- Everything made to open the app from another computer (VPN, LAN) is gone: the https door with its own certificate, the proxy of `/api` and `/ws`, the door in front of `pnpm dev`, the extra allowed origin and the message about plain http. `pnpm app` serves the build on port 4200 and `pnpm dev` works as it did.

## 1.18.0

- Spinly in a call: the wheel (and the duel wheel of a tournament) shrinks to the height of its tile, so the button that appears after a spin no longer makes the tile scroll. The space bar spins the wheel or the next duel (not while you type, or when a window or a menu is open).
- Drop-down lists (microphone, speakers, trail, click point) are drawn by the page, not by the browser: they keep the themed cursor, look like the rest of the interface and work with the keyboard. The list of devices updates when one is plugged in or taken out, and asks for the microphone once (if the browser has not given the names yet) so that every input and output shows up.
- The diagnostics panel of a call slides in and out smoothly instead of disappearing at once.
- New switch in Settings > Appearance, "Actions over a message", to remove the bar of reactions and options that shows when you point at a message.
- The buttons of the friends list are rounded less. The themed cursor now leaves with the mouse: when the pointer goes out of the window it hides at once, and no frame that was already due brings it back.

## 1.17.0

- Calls, buttons: the soundboard sits with the microphone and the headphones on the left, and Activities with the camera and the screen on the right.
- Listen together now has a queue everybody shares: anybody adds a song or a playlist (from the Activities form or from the card), anybody takes one out, and a vote of more than half of the call skips the song that plays; when a song ends the next one starts by itself. The titles are shown when YouTube or Spotify give them. The music card is no longer a bar in the middle: it sits at the bottom left, beside the controls (above them on a narrow screen), with pause, the vote to skip, the queue and the timeline.
- A video to watch together is as big as its 16:9 picture allows (the tile has the shape of the video instead of black sides) and sits in the middle of the stage.
- Calls: a right click on a person, a camera or a shared screen hides it from your screen only; a "Show hidden" button brings everything back. Full screen shows everybody who is not the big tile as a small window, whether they have the camera on or not.
- Cursor: the themed cursor no longer stays frozen when the pointer goes into a YouTube video (the page of another site hides where the pointer went; the cursor now notices the frame), and the wheel, the floating tiles and the other places that asked for a plain `pointer` or `grab` cursor now use the themed ones, so the system cursor does not show up there.
- Settings > Sounds & notifications uses a speaker instead of a bell. In a server, the people in a voice channel are listed under it with more room and a guide line. In the friends list the buttons are always visible and the row lights up with the accent when you point at it, and presses in.
- Spinly: "Write at least two" is gone and the wheel has a little more room above it.

## 1.16.2

- Spinly: a tournament that has a champion shows only the champion (the bracket and the rest go away). The rows of options and participants no longer have a color dot (the color is changed by pressing the slice on the wheel), the title field is gone, and the window is only as tall as its content (it scrolls when there is a lot), so it looks right at any screen size. In the plain wheel the result and the button have their own reserved space, so the wheel no longer jumps up when they appear.

## 1.16.0

- Settings > Sounds: you can upload your own click sound (a short audio file up to 1 MB and 3 seconds; it is kept on this device only), and the Mechanical click is gone.
- Settings > Appearance: two more mouse cursors, Neon (a hollow glowing arrow) and Pixel (a blocky retro arrow).
- Profile: the "Upload photo" button is gone (pressing the picture already changes it). The Name font and Profile effect menus have more room: they use fewer, wider cards depending on the space they really have.
- Spinly window: the "Add option / Add participant" button moved up next to Recolor, so it no longer moves down with every new row; the list of rows scrolls inside a fixed height. The text on the wheel is bigger, and so is the preview of the wheel.

## 1.15.0

- Listen together / Watch together: pausing, resuming, jumping on the timeline and changing song in a playlist are shared by everybody, from the same second; deafening only mutes the sound, so the player keeps going and never falls behind. The music bar has a timeline to move forward or back (on a phone it takes its own row). Playlists work: long playlist links are accepted, and a video that belongs to a playlist plays it. A jump made on the timeline of the YouTube player of a video is shared too.
- Calls in full screen: pressing full screen puts the whole stage on the screen, with the shared screen or video big and everybody else (cameras, Spinly) as small windows at the top right. They can be dragged and resized by any corner (also with a finger), and stay where you leave them. Spinly cannot be put in full screen (it is pinned big by itself when it starts, with the others small).
- Spinly window: the color of a slice opens the real color picker in place (no placeholder swatches); the pointer and the lights are colored by tapping the arrow or the rim of the wheel (the rows for them are gone); Recolor really shuffles the colors; Look and Your Spinly presets are two sections that open and close, one under the other; a tournament offers just its three modes (Fast, Classic, Epic).
- Spinly in a call: "Play them all" is gone; the champion has a proper card; the content is centered in its tile instead of leaving the empty black space; when the tile is wide the wheel and the bracket sit side by side.

## 1.14.1

- Calls: the first spin of a tournament in a call now turns (the wheel was drawn already at its final position and stood still). The tournament tile uses two columns when it is wide (the wheel and its buttons, and the bracket beside it) instead of squeezing the bracket under the wheel.
- Listen together and Watch together: pausing or resuming (from the music bar, or in the YouTube player of the video) pauses or resumes it for everybody, from the same second. Closing it with the X now only closes it for the person who pressed it; "Stop" in the Activities menu still ends it for everybody.
- The music bar is thinner and no longer shows the YouTube picture: only the title, who put it, a play/pause button and the close button. The player is invisible, so it never catches the mouse.

## 1.14.0

- Calls: "Listen together" is only sound now. Music no longer takes a tile of the stage: it plays in a small player (with a moving equalizer and the stop button) above the controls, and the tiles make room for it smoothly. A video to watch together keeps a true 16:9 picture inside its tile, as big as the tile allows and never cropped or stretched, in the grid, enlarged, in full screen and on a phone.
- Spinly window: when you click a slice of the wheel the others dim, so it is clear which one you are editing; its color is edited right below with a bigger palette, the live color and the name of the option. "Paste a list" is gone (it was clutter next to the rows).
- Settings > Integrations: the Spinly card follows the colors of the app (the amber tint is gone; it uses the accent), shows whether the account is linked, the themes and presets that came over as two big numbers with a preview of each, the buttons to update or unlink, and what Spinly does in a chat and in a call. Before linking it is a single sentence and one button. It also fits a phone.
- The Spanish dictionary is downloaded only for people who use Spanish (the first page is no longer slowed for everybody else); the initial bundle went from 515 kB to 466 kB.

## 1.13.0

- Calls: Listen together, Watch together and Spinly now start from one "Activities" menu in the call bar. Each activity becomes a tile of the stage, laid out and animated like the camera tiles, so nothing opens stretched any more: the wheel, the video and the music adapt to the space they get, in the grid, in the focus strip and on a phone. A video or a wheel takes the stage by itself when it starts, and the music stays as a small tile.
- Watch together: share a YouTube video and everybody sees it in sync (the music player no longer stretches over the screen either). Starting a video replaces the music, and the other way round.
- Spinly window: click a slice of the wheel to pick it and change its color right under the wheel. The tournament is split in two tabs, Participants and Rules, so each one fits without scrolling.
- Ringtones: pressing one ringtone and then another no longer plays both; the notes already queued are silenced at once. Pressing the one that plays stops it. The cards show which one plays (dancing bars) and what Automatic plays today.
- Settings > Audio: a slider for the volume of the sound effects of a call.
- Mobile: the call stage, the Activities menu and the Spinly tile adapt to small screens.

## 1.11.0

- Calls: the tiles are laid out like Discord. Everybody gets a tile of the same size, the biggest that fits, in a symmetric grid (the last row centered). Click a tile (or its pin button) to enlarge it: it fills the stage and everybody else, webcams included, becomes a small strip below; click it again to go back to the grid. A shared screen takes the stage by itself when it starts (and again whenever someone shares a new one), and you can still go back to the grid. Double click a tile, or use its button, to see it in full screen. Every tile moves to its new place smoothly (when someone joins or leaves, when you enlarge one, when the layout changes), and follows the window at once while you resize it. The buttons of a tile show on hover (always on a touch screen).
- Messages: the bar of actions over a message is as it was before (smaller radius, on the side of the message), keeping only its short spring-in.
- Side bars: more air between the Friends entry, the lists and their titles, and between the items of a list.
- "Members", "Groups in common" and the other list titles use a count pill instead of a dash.

## 1.10.0

- About: every card leads somewhere (Zero knowledge opens Privacy & security, Open source and No tracking open the repository and its security notes, every technology opens its own site); the page keeps its stacked layout, a little more compact so that it, like Privacy & security, fits a 2K screen without scrolling.
- Integrations: shorter and tidier (the real Spinly logo, the themes and presets that came over as two numbers, one line about privacy, and two small cards for the chat and the call). The "Open Spinly" button is gone, and so is "Open the full Spinly" in the window that makes a wheel: Spinly is used from Chatterly, and the panel with the real Spinly only appears to link the account.
- Spinly window: the tournament rules follow Spinly's own (ready-made Fast, Classic and Epic rules, a stepper for the duels and another for the final with the points needed, who plays who, equal chances, third place, quick spins and a summary line); every theme is listed once (they were repeated); the window is as tall as the screen allows and the form scrolls as one piece (the rules were hidden below a small inner scroll); the ready-made rules show their whole description; "Skip to the result" is a real button; the preset chips show the colors of their theme; themes, presets and the numbers in Integrations have a smaller radius.
- About me: the "How it looks" box is gone (the profile card already shows it).
- Messages: the bar of actions over a message is anchored to the right edge for every message, springs in and its quick reactions grow under the pointer; while you type code only one preview shows (the code block); the formatted-text preview no longer repeats it.
- Friends: the tabs and count pills follow the corner style instead of being fully round, the search bar is flat (a line instead of a rounded box), list titles show a count pill instead of a dash, and Pending is two cards (received and sent) with their own icons and friendly empty states.
- Appearance: corner style is a folding section like its neighbours (with the shape of the chosen corner as its preview), motion speeds are Fast, Normal, Slow and Off, the bubble styles Pill and Floating became Gloss (a glossy 3D bubble) and Block (a hard-edged block with an offset shadow), and the cursor previews no longer blink when you choose one (they are still, and drawn once).
- Sounds: "Off" is translated as "Desactivado".

## 1.9.0

- Phones: the page height follows the visible area (it used to be taller than the screen, so the message box, the settings button and the end of pages hid behind the browser bar); the settings open as a list of sections with a back button (the strip that hid most sections is gone); the emoji picker is a sheet over the bottom; a tap on a message shows its actions; a long press opens the same menu as a right click (friends, messages and so on); setting rows wrap instead of overflowing; the Spinly window puts the form first with a small wheel.
- Call ringtones: a new "Automatic" ringtone (the default) that follows the season: Halloween in October, Christmas in December, New Year until the 6th of January and the classic one the rest of the year. All melodies were rewritten (a music box for the classic one, the full Jingle Bells, a haunted music box, the first lines of Auld Lang Syne) and every note now has an echo, so they sound like a room and not like a beep.
- Click sounds: choosing a click style played the sound twice; now once.
- Hover effects: icons no longer tilt. The tiles of the settings menu lift, glow in their own color and a band of light sweeps across them; flags lift with a soft shadow; the padlock of About rises.
- Corner style (Appearance): the preview is on top, as a small piece of the app (a message, a reply, an input and a button) that follows the slider, with a tile for each of the seven steps, the name in big letters and the slider with its guides.
- Spinly window: it keeps one size when switching between wheel and tournament (the form scrolls inside), the tabs have a sliding thumb, the wheel sits on a glow of its own colors and the themes are cards with their names. Spinly has its own wheel icon everywhere (it used to be a refresh arrow).
- Messages: when what you type looks like code, a preview shows it formatted, "It will be sent as code" (with a button to send it as plain text), and it is sent as a code block; more kinds of code are recognized (JSON, shell commands, Python blocks, prints).
- Friends: the tabs are pills inside the page (they used to be cut off at the right edge), with an icon and a count; Pending uses the same list as the friends, with round accept and decline buttons.
- Listen together: YouTube refused to play ("configuration error 153") because the player was embedded without telling YouTube who shows it; it now sends the referrer and the origin, and the player has the minimum size YouTube asks for.
- The text style button is now at the left of the message box (it used to be inside the "+" menu).

## 1.8.0

- Spinly is always the same Spinly (https://spinly-psi.vercel.app/): the address setting is gone, and so is "open in a window". Spinly is shown inside Chatterly, in its own panel; if it cannot load, the panel offers to try again.
- Linking the account is done inside that panel: sign in to Spinly there if you want your account and press "Use my themes and presets"; only the names and colors of your themes and presets come over.
- The window that makes a wheel or tournament is new: the wheel is drawn live while you build it, every option and participant is a row with its own color (pick any color), a name, and a remove button; you can paste a list, recolor everything from a theme, change the pointer and lights colors, pick Spinly's themes or your own, load your Spinly presets (with their colors), and the tournament rules are plain buttons and switches.
- The wheel now looks like Spinly's: same colors, rim with its wave of lights, hub, pointer and the names across each sector.
- About me (Settings, Profile): a tidier toolbar (bold, italic, strikethrough, a Color panel and a Gradient panel instead of a row of dots), a text box that grows as you write, a friendly placeholder, a counter that warns near the limit, "Clear styles", and a live "How it looks" preview.
- Spinly (the app): it answers Chatterly's request for the themes and presets (only from the page that framed it); the "&link=1" window mode is gone.
- Housekeeping: more dead strings out of the Spanish dictionary.

## 1.7.0

- Spinly is now part of Chatterly: wheels and tournaments are native, they do not need the Spinly app or its address, and anyone can use them.
- In a chat, the "+" menu opens a window to make a wheel (options one per line, a title, a theme) or a tournament (participants, best of N duels, third place, odds by seed) and sends it as a message, like a poll. Anyone in the conversation can run it, only once: it spins for everybody at the same time, lands on the same result everywhere and the result stays in the message. A tournament is started once and plays out duel by duel for everybody (or skips to the result).
- In a call, the Spinly button puts a wheel or a tournament right in the call screen for everybody. There everybody can spin it again, edit it, play the tournament duel by duel or all at once, start it over, send the result to the chat or close it. Late joiners get the current one. Everything travels inside the encrypted call signaling.
- Link your Spinly account in Settings, Integrations: Spinly hands over only the names and colors of your themes and presets, which then appear in the window that makes a wheel or tournament (presets fill in the options, themes color the wheel). The login never leaves Spinly. Two themes are built in for everybody.
- The whole Spinly app is still one click away ("Open the full Spinly" in the window, or Integrations) and its results still go to the chat. The old call mirroring of the framed Spinly is gone, replaced by the native wheel.
- Fixed the real spin being decided by whoever pressed: the result comes from a seed that nobody can choose beforehand (the random id the server gives the run).
- Spinly (the app): it can be opened to link the account (`&link=1`) and no longer carries the call mirroring code.
- Housekeeping: dead Spanish strings of removed features are gone from the dictionary, which also keeps the initial bundle under 500 kB.

## 1.6.0

- Spinly now lives inside Chatterly: the "+" menu of a chat and the Spinly button of a call open it in a large panel over the conversation (nothing of Spinly is copied here, it is the real app framed, with its own account and presets). "Send ... to the chat" posts the winner, and in a call "Show it to the call" shares it with everybody. If a Spinly does not allow being framed, the panel offers to open it in its own window. Spinly itself now accepts being framed by Chatterly.
- In a call, Spinly is shared with everybody without sharing the screen: when someone opens it the panel opens for the others too, and every spin of the wheel is replayed on their side with the same options, the same landing angle and the same winner (sent encrypted and signed like the rest of the call signaling). Tournaments are not mirrored live: their champion still goes to the chat. The call also opens the microphone more forgivingly (a missing chosen device no longer ends in "Constraints could not be satisfied").
- Settings menu: new order (profile, appearance, sounds and notifications, voice and video, stickers, language, integrations, privacy and security, about), no more small titles, a colored tile on every entry and thin lines between clusters.
- Sounds: every control of the settings menu has its sound; the sound keeps the chosen style but changes pitch and level with the importance of the button (main actions brighter, destructive lower, quiet icon buttons softer); sliders tick as they move, rising in pitch.
- Messages: the sent, delivered and read mark is a tiny dot beside the time (hover it for the word) instead of a caption; a message of one to three emoji is drawn big, without a bubble, with a springy pop (like WhatsApp); sent text is trimmed so a trailing line never makes a bubble taller; names no longer underline or glow on hover.
- The "End-to-end encrypted" label moved inside the shield button (its tooltip says it and whether the contact is verified); the group header uses the same shield.
- Friends page redone as a clean list: All is the first tab, a search box, rows with quick actions that appear on hover, and less rounded tabs and search.
- Members: the owner always stays first (nobody can be moved above them) and the list has more room under its title.
- Groups: more room above the group bar; the group menu has colored icons and descriptions; the status menu fits inside the side bar, no longer gets cut by the chat and opens with a stagger; the side bar text can no longer be selected by accident.
- Cursor: the system cursor no longer comes back in the gap between two items of a list that re-renders; more controls show the pointer on hover.
- Appearance: the shuffle menu has room to breathe, the custom color button is a multicolor wheel, the corner slider shows the name and size of the chosen step with tick marks, the old three names as a guide and a live sample.
- Language: cards with a big flag in a grid, and the time format in its own card. Ringtone cards use icons instead of emoji.
- About: a new animated logo (drawn stroke by stroke, a spinning star, ripples, orbiting sparks and a light sweep), a smaller name, more links (source, changelog, contributing) and the real GitHub address.
- Performance: the emoji, script and serif fonts are a separate stylesheet switched on when idle, so the initial bundle is under 500 kB again.
- The test output is in English, and the changelog now starts at the first upload.

## 1.5.0

- Chat: a message that is only a link no longer shows the link twice (the preview card replaces it). Messages that are clearly code are formatted as a code block automatically. YouTube players now work (they were refused for lacking a referrer). The "load videos automatically" option is gone: a video loads when you press play.
- The "Encrypted - key vN" label is now a lock button in the header (the tooltip says what it is and opens Privacy & security). Day separators ("Today", "Yesterday") and the About texts follow the language of the app.
- Message status is now a small word under your messages (Sent, Delivered, Read) that changes color as it travels, instead of the linked rings.
- Calls: the security code is eight digits ("1234 5678") instead of emoji, and it only appears in the "Verify this call" window, no longer on every tile.
- Ringtones: four melodies for incoming calls (Normal, Christmas, Halloween and New Year) and the option to upload your own sound (up to 2 MB and 30 seconds, kept on your device).
- Sounds are louder (more headroom plus a limiter so they never distort). Click sounds are down to Soft, Drop, Glass, Mechanical, Typewriter, Marimba and Kalimba (the last two are new, warm ones).
- Appearance: the typeface list is nine cards (System and the most used ones) with a last card to upload your own font, and the extra fonts are no longer bundled, so the page loads less. Corner style is a seven-step slider with the old names (Sharp, Soft, Round) as guides. Neon bubbles use a single color, and the previews of the other bubble styles no longer change when you pick one. Cursor shapes Prism and Tile are gone (they looked like the others).
- Name font: five fonts plus one to upload (only you see an uploaded font). Profile effects: ten distinct ones (Spin, Pulse, Orbit, Dashed, Double, Glow, Ticks, Glitch, Rainbow and None); all but Rainbow take two colors of your choice, saved in your profile.
- Profile: the About you section is redone with a status card and an editor with its toolbar on top.
- Friends page redone: pill tabs, a search box and cards with the friend's banner color and quick actions.
- Settings: the section list is grouped (Account, App, Calls & privacy, Chatterly); the version line under it is gone. About has the Jondals logo, principle cards and no copy button.
- Group settings: Save sits next to the name field, the "create channel" window opens on top of the settings window, and the placeholder is "General chat".
- The three buttons under your panel have a smooth hover; the status menu opens with an animation and no longer pushes the panel up.
- Collapsible sections open and fold smoothly and close when you press outside them. The emoji in the picker are bigger and only the emoji grows on hover.
- Project: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY and issue/pull request templates were added; the docs folder with screenshots was removed.
- The app version shown in Settings and About is 1.5.0.

## 1.4.0

- Spinly integration: the composer "+" menu now has "Spinly" instead of "Poll". It opens Spinly (https://spinly-psi.vercel.app/) in a pop-up, normal wheel or tournament, and the winner can be shared in the chat as a card. It works from a call too. Spinly is not part of Chatterly: only a small, origin-checked message bridge connects them, and Settings > Integrations shows whether your Spinly account (presets) is connected. The Spinly side (`src/scripts/chatterly-bridge.ts`) also plays the Chatterly tick and win sounds.
- Link previews with video (YouTube, Instagram, X...) are one block: the player on top, the link below. It plays on click, or at once if videos auto-load.
- Message status marks (sent, delivered, read) drawn as small elegant dots instead of ticks. Settings > Privacy has switches for the marks and for read receipts; turning receipts off hides your reads and theirs, and unread counts still work.
- Names and times in messages are bigger and more spaced; "End-to-end encrypted" and "Encrypted - key vN" moved to a quiet, less rounded label. The "Verified" tag is gone: the shield next to the name is marked instead.
- The group owner can drag members to reorder them.
- Clicking outside the settings menu closes it. No more background flash when moving between Home, groups and chats.
- Cursor: every state (links, text, busy, resize, drag...) is themed, none falls back to the Windows default.
- 12-hour time shows AM or PM after the time.
- Performance: pre-rendered login and register pages, inline critical CSS, delayed preloading of lazy routes and a stricter CSP; Lighthouse 100 on mobile and 100 on desktop for login and register.
- Code: all in English, a header comment in every script and a comment on functions, no lambda expressions, dead code removed (polls, unused helpers). One test: `pnpm test` or `test/chatterly-test.exe`.
- The app version shown in Settings and About is 1.4.0.

## 1.3.0

- Channels keep their order of arrival, and the group owner can reorder them: drag a channel up or down (text with text, voice with voice) or right-click it and pick "Move channel up/down". The order is saved on the server for everyone. The members list also follows order of arrival (no more reshuffling by online status).
- Cursor: the hover state is now the same arrow with a soft glow and a brighter fill (same hot spot, so it never jumps), and the two shapes cross-fade and scale smoothly instead of swapping. New "Cursor color" setting (also colors the trail), with a button to go back to the theme color.
- Emoji picker: bigger emoji (7 columns, larger glyphs) and a soft hover that only scales the emoji instead of a big button.
- Closing Settings no longer fades the dark backdrop away to the bare animated background; only the content fades.
- The channel sidebar has more color: a tinted group header, accent-colored text channels, a second color for voice channels, and colored hover and active rows.
- Appearance: the cursor try-it area is gone, and the collapsible sections are spaced apart with roomier headers.
- Cursor: the custom cursor and trail now go back on top whenever a menu, picker or dialog opens (checked after every click, key press and now and then while moving), so they never end up under the browser top layer.
- Cursor: over browser extensions and password-manager panels (iframes the page cannot track) the system cursor is shown again, so you can see and click them; the custom cursor comes back as soon as you return to the page. The cursor no longer re-checks the top layer while moving.
- Fixed: opening the site at the root (`/`) while signed out left the login box empty; it now goes to the login. The test covers it.
- Settings now open on top of the screen you were on (a secondary route), so the chat or call behind stays visible instead of vanishing; switching sections never touches it.
- Profile: the display name moved into "Name style" with its own row, pronouns are gone, the status has an emoji picker, "About me" allows 1000 characters and has the same 3 colours, 3 gradients and custom gradient as the chat (the caret lands inside the tag so you can type right away). The unsaved-changes bar now sticks to the bottom of the screen with Save and Reset side by side.
- Themes: Slate removed; the custom theme can now also set panels, text, soft text and the second accent.
- Hovers use a gentler curve and last longer; the cursor trails are shorter and drawn segment by segment, so they never glitch when they cross themselves.
- Sounds are much louder, with separate Effects and Music volume (Music controls YouTube; Spotify has its own volume). The upload icon is a cloud with an arrow.
- About: the closing line is replaced by an animated GitHub link (a lock that opens). The shared-media panel in direct chats is gone; "End-to-end encrypted" and "Encrypted - key vN" now link to Privacy & security; image and GIF captions appear as an overlay on hover; chat names light up on hover and the time is brighter with more space.
- The status menu opens right above your panel instead of jumping.
- Twelve chat bubble styles (new: Glass, Neon, Leaf, Ticket, Floating, Dashed).
- New colour picker window: bigger square, vertical hue bar, eyedropper, HEX and R/G/B fields, in the style of the site, and you can drag it anywhere by its title bar.
- Mouse wheel over any slider moves it one step up or down.
- The app version shown in Settings and About is 1.3.0.

## 1.2.0

- Comet, ribbon and rainbow trails are drawn as one smooth shape (no more beads); new Prism cursor; the custom cursor and trail now sit on the browser's top layer, so menus and pickers no longer cover them, and message text no longer hides them; the `+` menu icons no longer rotate.
- Cursor menu redesigned: a try-it area, shapes first, then behaviour rows; the pulsing outline is subtle and the trail has separate thickness and length sliders. About shows the technology logos; the composer `+` menu has coloured icons and descriptions.
- Cursor settings tidied into rows (animation, trail picker, trail size slider, cursor size); the animation is now an outline that pulses around the whole cursor shape instead of a ring at the tip.
- Composer: Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes, also after formatting or inserting emoji; picking a colour with no text leaves the cursor inside it ready to type; the link bar is one slim line and the format preview no longer appears just for a link; bigger emoji; the user panel has two roomier rows.
- Cursors v2: pointer families that match the site (Themed, Soft, Glass, Tile, Halo, Classic), a Static/Animated switch for every one, adjustable size (16-56 px) and a separate trail picker with 8 smooth trails (comet, ribbon, glow, ink, rainbow, stardust, bubbles, fire). The trail now comes out of the body of the cursor, not from its tip.
- Link previews are opt-in per message: type a link and choose "Add preview". The server opens the link once (https only, private addresses blocked) and the card travels inside the encrypted message. YouTube and Spotify use their official oEmbed, so they work too.
- Messages show the name first, then the time; clicking your name opens your profile settings, clicking someone else's opens their profile card. New Settings > Language > Time format (Automatic, 12 h, 24 h).
- Right-click a channel to rename or delete it (owner only); six bubble styles; pop-up notices are smaller, shorter and can be turned off; after a call you return to the screen you were on; the composer shrinks back after sending long text; code blocks no longer show lines when selected.
- Backgrounds: shuffle mode, a configurable solid colour, more scenes; 8 more typefaces and 6 more themes plus a custom theme from one colour.
- Polls (encrypted, votes are encrypted reactions), right-click menus (messages, groups, friends), friend nicknames that only you see, and listening to a YouTube or Spotify link together in a call.
- Login and register share one frame (no reload between them); the route loop that froze the page when already signed in is fixed. Lightweight particle background that reacts to the mouse (no trails, no parallax), much darker.
- Composer: one `+` menu on the right (attach, voice note, poll, text style and colours), 3 colours + 3 gradients + 1 custom gradient, opaque emoji picker with smaller cells, tidier message hover menu.
- Backgrounds: shuffle mode (on every reload or every N minutes) plus new scenes; solid first; waves and nebula redone.
- Cursors: new nicer presets (orb, sleek), cursors with trails (comet, ribbon, stardust), smaller size, and your own `.cur`, `.ani` and animated GIF/WebP cursors.
- Profile: name style above "About you", which now has formatting buttons and a live preview. Settings open and close with a fade. Custom accent colour is labelled.
- Soundboard opens centred, new softer built-in sounds and a general volume reduction; calm mute and deafen sounds.
- Calls: the lobby is gone; when a call ends you go back to the home screen. Channel names show as readable text ("Chat general").
- Security: refresh-token reuse detection, `Cache-Control: no-store`, `Permissions-Policy`.
- Every source file now starts with a comment saying what it does.

- Earlier in this release line: auth screens back to the original look with an animated particle network; colour picker fixed (it opened off-screen inside the chat; panels now use the browser top layer); gradients for the name colour and a custom gradient builder in the chat; density option removed; 9 more click sounds; 8 more animated backgrounds; cursor presets reworked and uploaded cursors are named entries; global tooltips that never get clipped; call grid sizes tiles to the available height and any participant can be pinned; About redesigned; GIFs through GIPHY (+ optional Tenor) merged; refresh-token reuse detection, `Cache-Control: no-store` and `Permissions-Policy` on the API; `pnpm app` serves the production build.


## 1.1.0

- End-to-end encrypted calls (voice and video frames), with a security code to verify.
- New interface: less rounded, themed cursor, UI sounds, smoother hovers, blurred animated background, settings menu, languages, animated credit.
- Profile pictures, banners and group icons are uploaded images; fonts and more profile options.
- Text and voice channel creation, own emoji picker, coloured text, GIF picker (GIPHY, needs `GIPHY_API_KEY`), stickers with WhatsApp import. Guilds are now called groups.
- Fix: the production build lost all styles under the strict CSP (critical CSS inlining uses an inline handler); it is now disabled.
- Fix: Tenor discontinued its API, so GIFs now use GIPHY.
- Performance: no backdrop blur anywhere and a GPU-only animated background (11 scenes, faster and more visible, blur softens the shapes); menus no longer stutter.
- Own colour picker with eyedropper that works in every browser (screen-capture fallback), used everywhere a colour is chosen.
- Banner gradients with opacity, 13 name fonts, 15 avatar rings, 5 more themes, 5 more interface fonts; fonts, themes, backgrounds and cursors are compact dropdowns with previews.
- Cursor presets (ring, dot, pixel, neon) and your own uploaded cursor.
- Mute and deafen work outside calls; soundboard reachable from the left bar with uploadable sounds; call screen redesigned (fixed 16:9 tiles that never jump, side drawer for chat, media and stats); voice lobby redesigned.
- Old login look restored; right click blocked; copy works when the clipboard API is blocked; search palette removed; fixed stray horizontal scrollbars and green pixels.
- All previous tests were replaced by a single self-cleaning test (`pnpm test`).

## 1.0.0 — Chatterly-Renewed 2026-09-04

First complete release.

- Zero-knowledge accounts (PBKDF2 → HKDF split, scrypt on the server, wrapped ECDH/ECDSA identity keys).
- End-to-end encrypted, signed direct messages and guild channels with group-key rotation.
- Encrypted attachments, voice notes, reactions, replies, edits, typing indicators.
- Friends, presence, guilds, voice channels and DM calls over full-mesh WebRTC with encrypted, signed signaling.
- Spatial audio, live call telemetry, screen sharing, soundboard.
- Angular 21 / Tailwind 4 UI with animated backgrounds, accent themes and aura frames.
- 117 automated tests plus a Playwright browser smoke test.

## 0.4.0 - 2026-05-23

- The three packages (root, backend and frontend) moved from npm to pnpm, with workspace files and a lockfile for each.

## 0.3.0 - 2026-05-16

- The signed-in layout: a social bar (friends and direct messages) and a user bar (avatar, status and quick settings). The first components were removed and rewritten around the new main layout.

## 0.2.0 - 2026-05-14

- Sign-in and registration pages rebuilt with Tailwind, and an auth guard that keeps signed-out visitors away from the private area.

## 0.1.0 - 2026-05-05

- First upload: the Angular frontend and the Fastify backend that later became Chatterly-Renewed.
