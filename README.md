# Phonics Teacher

An interactive English phonics course for children aged 7–11. Kids learn to hear, sort and blend the sounds of English with a friendly virtual teacher, word sorts, pronunciation practice and games.

**▶ Try it: https://oscarivanestrada.github.io/phonics-teacher/**

## What's inside

- **Course — 6 units, 42 word sorts** (Letter-Name Alphabetic stage)
  1. Initial consonants (Sorts 1–14)
  2. Digraphs and initial blends: ch, sh, th, wh, s-/l-/r-blends (15–19)
  3. Word families with one short vowel (20–24)
  4. Word families with mixed short vowels (25–30)
  5. Final -ck, -sh and double consonants (31–34)
  6. Short vowels in CVC words without a fixed rime (35–42)

  Children sort picture or word cards under sound headers, get spoken feedback on mistakes and earn stars. Sort 14 is a quick initial-consonant review; Sort 42 is an exit assessment (initial sound, short vowel and final sound, 80% to pass).
- **Sound Blackboard** — every sort as a board: tap the onset and the rime, blend them, or hear a word **sound by sound**.
- **Real phonics sounds, not letter names** — each of the 428 course words has an IPA transcription. "Sound by sound" says /k/ /æ/ /t/ the way a teacher does: vowels and continuous sounds held, stops clipped.
- **Speaking Challenge**, **Catch the Sound** game, and an **Album** of stickers unlocked with stars.
- **iPhone app** (Capacitor) using the device's own voices, with a voice picker to preview them.

## How the audio works

Speech is generated with local text-to-speech engines and **published to this repository** under [`audio/`](audio/), so the website and the iPhone app play it straight from GitHub instead of generating it again.

| Engine | Use |
|---|---|
| **Kokoro** (default) | Reads IPA directly, so isolated sounds are exact. The whole course is pre-generated for the three teacher voices. |
| **Chatterbox Turbo** | More natural voices cloned per teacher; isolated sounds use teacher-style spellings ("sss", "aah"). |
| **iPhone voice** | Fallback on iOS when an audio isn't published yet. |

Paths are deterministic (`audio/<engine>/<voice>/words/<word>.wav`, `.../sounds/<hash>.wav`), defined in [`src/services/audioPaths.ts`](src/services/audioPaths.ts).

## Run locally

**Prerequisites:** Node.js 20+, and for generating new audio the local TTS sidecars (Kokoro on port 8772, Chatterbox on 8773).

```bash
npm install
npm run dev        # http://localhost:3000
```

Create a `.env` (see [`.env.example`](.env.example)). Set `GITHUB_TOKEN` (fine-grained, *Contents: write* on this repo) if the server should publish newly generated audio to GitHub; without it, audio is still generated but not published.

Pre-generate every course audio for one engine and commit it in one go:

```bash
npx tsx scripts/generate-course-audio.ts kokoro
```

## Deploy the website (GitHub Pages)

The public site is a static build served from the `gh-pages` branch. It needs no server: audio comes from what is published in `audio/`, and anything missing falls back to the browser voice.

```bash
VITE_STATIC=true VITE_BASE=/phonics-teacher/ npx vite build --outDir dist-pages
```

Then publish the contents of `dist-pages/` to the `gh-pages` branch.

## iPhone app

```bash
npm run ios:build   # build the web app and sync it into ios/
npm run ios:open    # open in Xcode, choose your team, run on a device or simulator
```

For more natural voices, download *Enhanced* or *Premium* English voices on the iPhone in Settings → Accessibility → Spoken Content → Voices.

## Project structure

```
src/data/course.ts            Units and the 42 word sorts
src/data/wordBank.ts          IPA and picture for every course word
src/services/phonemes.ts      How each sound is said in isolation
src/services/audioService.ts  Playback: GitHub audio → engine → fallback
src/components/               Course map, sort activity, blackboard, games
server.ts                     Dev server: TTS endpoint and audio publishing
ios/                          Capacitor iOS project (native TTS plugin)
```
