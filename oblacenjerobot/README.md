# Simulacija robotske ćelije – oblačenje suncobrana

- `index.html` – 3D/2D simulacija (IRB 6640-235/2.55)
- `koncept.html` – tabla s prijedlozima koncepta

## Postavljanje na GitHub Pages
1. Napravite novi repozitorij i u njegov korijen kopirajte **cijeli sadržaj** ove fascikle (uključujući skriveni fajl `.nojekyll` – bez njega GitHub ne objavljuje fasciklu `_ds`).
2. Settings → Pages → Source: *Deploy from a branch*, grana `main`, fascikla `/ (root)`.
3. Nakon 1–2 minute stranica je na `https://<korisnik>.github.io/<repozitorij>/`.

Simulacija učitava three.js s esm.sh i fontove s Google Fonts, pa je potreban internet.
Lokalno otvaranje direktno iz fajla (file://) neće raditi – koristite lokalni server, npr. `python3 -m http.server`.
