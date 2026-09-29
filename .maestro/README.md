# End-to-end flows (Maestro)

These drive the real app on a phone or emulator, the way a person would.

## Run them

1. Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro
   (on Windows, inside WSL, or use Maestro Studio).
2. Install a **preview** build of the app on an Android phone or emulator and
   connect it (`adb devices` should list it).
3. Create a test account in the app (a normal Libot account you don't mind
   using for tests), then run:

```bash
maestro test .maestro/ -e LIBOT_EMAIL=you+test@example.com -e LIBOT_PASSWORD='the password'
```

Run a single flow with `maestro test .maestro/03-offline.yaml -e …`.

## Flows

| File | Checks |
|---|---|
| `01-sign-in.yaml` | Fresh install → welcome screens → municipality → sign in → Home |
| `02-browse-spot.yaml` | Search for a spot and open its page |
| `03-offline.yaml` | Airplane mode shows the offline banner; reconnecting shows "Back online" |
| `04-location-foreground-only.yaml` | The app never asks for "Allow all the time" location |
| `05-delete-account-reachable.yaml` | Settings → Edit Profile → Delete Account is reachable (does **not** delete) |

If a flow fails because a label changed, update the text in the YAML to match
the screen. `appId` must match `android.package` in app.json.
