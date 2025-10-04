# Full-screen scrollable sections

This is a minimal webpage with multiple full-screen panels ("windows") you can scroll through. It uses CSS scroll-snap for smooth, section-by-section navigation and includes keyboard and dot navigation.

## Features

- Full-height sections (100vh) that snap neatly when you scroll
- Smooth scrolling and support for PageUp/PageDown and Arrow keys
- Dot navigation on the right to jump between sections
- Accessible, responsive, and honors `prefers-reduced-motion`

## Run it

You can open the `index.html` file directly in your browser:

- In File Explorer, double-click `index.html`, or
- From VS Code, right-click `index.html` and choose "Open with Live Server" (if you have the extension), or
- Serve it locally (optional, only if you want an `http://` URL):

```powershell
# If you have Python installed
py -m http.server 8080 ; Start-Process http://localhost:8080

# Or with Node (requires Node.js)
npx serve . -l 8080 ; Start-Process http://localhost:8080
```

## Customize

- Add or duplicate `<section>` blocks in `index.html`
- Change colors by editing the `.theme-*` backgrounds in `styles.css`
- Adjust behavior (e.g., keys or active dot logic) in `script.js`

Enjoy!
