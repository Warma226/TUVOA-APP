# Modèle vidéo « La minute cyber »

Modèle validé à partir de l'épisode 6 (« Le message du Capitaine », usurpation d'identité).
Format vertical 9:16, environ 1 minute, rendu image par image depuis le code (film = fonction du temps).

## Structure d'un épisode

| Partie | Durée | Contenu |
|---|---|---|
| Accroche flash | 2,2 s | ~14 plans de 0,12 s (images de l'épisode, montants, tampon « FAUX COMPTE », bruit, « ATTENTION. »), puis titre « LA MINUTE CYBER » qui claque |
| Ouverture | ~5 s | Notification du faux message en 3D, « Mesdames, messieurs, … » |
| Histoire | ~30 s | Conversations en 3D (cartes alignées, la caméra glisse de l'une à l'autre), compteurs de montants, transferts « − 15 000 F », hésitation (battements de cœur), « plus personne ne répond » |
| Révélation | ~3 s | Fond orange, nom de la technique en grand avec glitch et impact |
| La technique | ~9 s | Image d'enquête (mur, silhouette), fiches qui fusionnent, « UN SEUL CYBERCRIMINEL » |
| Réflexes | ~8 s | Page claire, 3 cartes qui pivotent en 3D (Vérifiez / Signalez / Partagez) |
| Générique | 2,8 s | Fin de l'épisode 1 (logo TUVOA, alerte.bclcc.gov.bf, www.tuvoa.media) |

Style : caméra 3D (travellings, orbites, traversées), profondeur de champ, poussières lumineuses,
traînées de lumière orange, flares, repères discrets sur les bords, grain. Police Montserrat.
Couleurs : nuit #071018, orange #E94A06 / ambre #FF8A3D, bleu TUVOA #2563EB.

Son : voix off de Mara (prises mp3) + musique rythmée composée en code (score.py, 96 bpm,
la musique baisse sous la voix) + ~55 effets sonores calés sur l'image (HITS dans film.js).
Mixage à -14 LUFS.

## Fichiers

- `film.js` : toute la vidéo (moteur 3D, scènes, sous-titres, accroche flash, liste des effets sonores `HITS`).
  Les phrases de la voix off et leurs temps sont dans `PHRASES`.
- `audio/score.py` : musique + pose de la voix off (`VO = [(fichier, position)]`).
- `film.json` : durée, format.
- `lib/motion.js` : outils d'animation (ressorts, easing, bruit).
- `fonts/` : Montserrat.

À fournir pour chaque épisode (non versionnés) :
- `assets/img/` : images de l'épisode (dans l'ép. 6 : capitaine.jpg, mur.jpg, noir.jpg, fenetre.jpg, seul.jpg, cinema.jpg).
- `audio/vo/p1.mp3, p2.mp3, p3.mp3` : prises de voix.
- le générique : `outro.mov` extrait de la fin de l'épisode 1 (57,2 s → 60 s).

## Fabriquer un nouvel épisode

1. Écrire le texte, découper la voix en prises, mesurer les pauses (ffmpeg silencedetect) et remplir `PHRASES`.
2. Adapter les scènes (`sHook`, `chatWorld`, `sRevelation`, `sMur`, `sCriminel`, `sReflexes`) au nouveau récit.
3. `python3 audio/score.py` puis `sfx.mjs`, `mix.mjs --music-db 0 --sfx-db -2 --vo-db 2` (outil motion-reel).
4. `render.mjs --film <dossier> --format 9x16 --video-only --fps 30`, puis coller le générique (ffmpeg concat).
