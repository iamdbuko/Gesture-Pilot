# gesture-pilot

Figma plugin + hosted UI for camera-based gesture controls.

## Structure
- `src/` Figma plugin source
- `dist/` plugin build output (generated)
- `web-ui/` hosted UI (static)

## Build plugin
```bash
npm install
npm run build
```

## Watch plugin
```bash
npm run watch
```

## Hosted UI (Vercel)
Deploy the `web-ui/` folder as a static site. After deploy:
1. Set the URL in `src/ui/index.html`
2. Add the domain to `manifest.json` `networkAccess.allowedDomains`
3. Rebuild plugin
