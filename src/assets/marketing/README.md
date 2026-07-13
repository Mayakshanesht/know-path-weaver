# Marketing media

Drop the GIFs (or short MP4s) of real course output here. They are picked up automatically —
`src/lib/marketingMedia.ts` globs this directory, so no import needs editing. A file that is
not here simply does not render; nothing breaks.

## Filenames

The name before the extension is the key. Use exactly these:

| File                        | Shows                                                        | Used by |
|-----------------------------|--------------------------------------------------------------|---------|
| `motion-planning.gif`       | Global route + local trajectories, behaviour state (CRUISE)  | Motion Planning, landing page |
| `aeb.gif`                   | The AEB predictor: distance, relative speed, SAFE/BRAKE      | ADAS, landing page |
| `acc.gif`                   | Adaptive cruise control following a lead vehicle             | Vehicle Dynamics, landing page |
| `perception.gif`            | Segmentation / detection / lane estimation on real frames    | Perception Lab, AI Bootcamp |
| `rl.gif`                    | The PPO agent driving in MetaDrive                           | Vehicle Dynamics |

## Keep them small

The existing hero GIF is 4.5MB, which is most of the landing page's weight and is downloaded
before anything is visible. Aim for **under 1.5MB** each:

    # trim, resize, and cut the palette down
    ffmpeg -i in.mp4 -t 6 -vf "fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif

An MP4 is 5-10x smaller than a GIF for the same clip and is worth preferring — name it
`motion-planning.mp4` and it is used the same way, as a muted autoplaying loop.
